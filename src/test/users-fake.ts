import { vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import type { Page } from '@/types/api';
import type { Role } from '@/types/auth';
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserWithTemporaryPassword,
} from '@/types/user';

/** Senha provisória que a API simulada "gera". */
export const GENERATED_PASSWORD = 'Vq7#kT9m-Rw2xPz4';

/**
 * Usuário de teste.
 *
 * @param partial Campos que diferem do padrão (editor ativo, versão 1).
 */
export function buildUser(
  partial: Partial<User> & { id: string; name?: string },
): User {
  return {
    name: `Usuário ${partial.id}`,
    email: `${partial.id}@pauta.local`,
    role: 'content-brief-editor',
    status: 'ACTIVE',
    mustChangePassword: false,
    lockedUntil: null,
    lastLoginAt: '2026-11-14T12:00:00.000Z',
    version: 1,
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: { id: 'seed', name: 'Seed' },
    updatedAt: '2026-11-01T10:00:00.000Z',
    updatedBy: { id: 'seed', name: 'Seed' },
    ...partial,
  };
}

function apiError(status: number, code: string) {
  return new ApiError({ status, code, message: `texto da API (${code})` });
}

/**
 * API de usuários em memória que respeita o contrato do `docs/auth.md` no que
 * a tela usa: lista com `q`/`status`/`page`/`limit` ordenada por nome, `GET
 * /:id`, `POST` (e-mail repetido, senha provisória gerada ou `null`), `PATCH`
 * com checagem de versão, `deactivate`/`reactivate` e `reset-password`, com as
 * regras `CANNOT_MODIFY_SELF` e `LAST_ADMIN`.
 *
 * `failures` injeta o erro da próxima chamada que casar com `METODO path`.
 * `lists` guarda os parâmetros de cada `GET users`; `creations`, `updates` e
 * `actions` guardam o que chegou nas escritas.
 *
 * @param initialUsers Usuários iniciais (copiados: o fake os altera).
 * @param currentUserId Id de quem está logado (regra de "si mesmo").
 * @param failures Erros a injetar.
 */
export function createUsersApiFake(
  initialUsers: User[],
  currentUserId: string,
  failures: Record<string, ApiError> = {},
) {
  const users = initialUsers.map((u) => ({ ...u }));
  const lists: Record<string, string | number>[] = [];
  const creations: CreateUserInput[] = [];
  const updates: { id: string; body: UpdateUserInput }[] = [];
  const actions: string[] = [];
  const fetched: string[] = [];
  let sequence = 0;

  const find = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) throw apiError(404, 'USER_NOT_FOUND');
    return user;
  };

  const activeAdmins = () =>
    users.filter((u) => u.role === 'admin' && u.status === 'ACTIVE');

  function respond(key: string, produce: () => unknown) {
    return {
      json: async () => {
        const failure = failures[key];
        if (failure) {
          delete failures[key];
          throw failure;
        }
        return produce();
      },
    };
  }

  function guardLastAdmin(user: User) {
    if (
      user.role === 'admin' &&
      user.status === 'ACTIVE' &&
      activeAdmins().length === 1
    ) {
      throw apiError(409, 'LAST_ADMIN');
    }
  }

  const api = {
    get: vi.fn(
      (
        path: string,
        options: { searchParams?: Record<string, string | number> } = {},
      ) => {
        if (path === 'users') {
          const params = options.searchParams ?? {};
          lists.push(params);
          return respond('GET users', (): Page<User> => {
            const term = String(params.q ?? '').toLowerCase();
            const filtered = users
              .filter(
                (u) =>
                  !term ||
                  u.name.toLowerCase().includes(term) ||
                  u.email.toLowerCase().includes(term),
              )
              .filter((u) => !params.status || u.status === params.status)
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            const page = Number(params.page ?? 1);
            const limit = Number(params.limit ?? 50);
            return {
              data: filtered
                .slice((page - 1) * limit, page * limit)
                .map((u) => ({ ...u })),
              total: filtered.length,
              page,
              limit,
            };
          });
        }
        fetched.push(path);
        return respond(`GET ${path}`, () => ({
          ...find(path.split('/')[1] ?? ''),
        }));
      },
    ),
    post: vi.fn((path: string, options: { json?: CreateUserInput } = {}) => {
      if (path === 'users') {
        const body = options.json as CreateUserInput;
        creations.push(body);
        return respond('POST users', (): UserWithTemporaryPassword => {
          if (
            users.some(
              (u) => u.email.toLowerCase() === body.email.toLowerCase(),
            )
          ) {
            throw apiError(409, 'EMAIL_ALREADY_REGISTERED');
          }
          sequence += 1;
          const user = buildUser({
            id: `novo-${sequence}`,
            name: body.name,
            email: body.email.toLowerCase(),
            role: body.role as Role,
            mustChangePassword: true,
            lastLoginAt: null,
          });
          users.push(user);
          return {
            user: { ...user },
            temporaryPassword: body.password ? null : GENERATED_PASSWORD,
          };
        });
      }
      const [, id, action] = path.split('/');
      actions.push(`${action}:${id}`);
      return respond(`POST ${path}`, () => {
        const user = find(id ?? '');
        if (action === 'deactivate') {
          if (user.id === currentUserId)
            throw apiError(409, 'CANNOT_MODIFY_SELF');
          guardLastAdmin(user);
          user.status = 'DEACTIVATED';
          return { ...user };
        }
        if (action === 'reactivate') {
          user.status = 'ACTIVE';
          user.lockedUntil = null;
          return { ...user };
        }
        user.mustChangePassword = true;
        user.lockedUntil = null;
        return {
          user: { ...user },
          temporaryPassword: GENERATED_PASSWORD,
        } satisfies UserWithTemporaryPassword;
      });
    }),
    patch: vi.fn((path: string, options: { json: UpdateUserInput }) => {
      const id = path.split('/')[1] ?? '';
      updates.push({ id, body: options.json });
      return respond(`PATCH ${path}`, () => {
        const user = find(id);
        if (user.version !== options.json.version) {
          throw apiError(409, 'USER_VERSION_OUTDATED');
        }
        if (options.json.role && options.json.role !== user.role) {
          if (user.id === currentUserId)
            throw apiError(409, 'CANNOT_MODIFY_SELF');
          guardLastAdmin(user);
          user.role = options.json.role;
        }
        if (options.json.name) user.name = options.json.name;
        user.version += 1;
        return { ...user };
      });
    }),
  };

  return { api, lists, creations, updates, actions, fetched, users };
}

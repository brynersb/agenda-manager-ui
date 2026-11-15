import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApi } from '@/lib/api';
import type { Page } from '@/types/api';
import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserStatusFilter,
  UserWithTemporaryPassword,
} from '@/types/user';

/** Usuários por página na administração. */
export const USERS_PAGE_SIZE = 20;

/** Filtros da lista de usuários. */
export interface UsersFilters {
  /** Busca em nome ou e-mail (1 a 100 caracteres); vazio não filtra. */
  q?: string;
  status: UserStatusFilter;
  page: number;
}

/** Chaves de cache dos usuários; `['users']` invalida lista e detalhes. */
export const usersKeys = {
  all: ['users'] as const,
  list: (filters: UsersFilters) => ['users', 'list', filters] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
};

/**
 * Lista usuários (`GET /users`), ordenados por nome pela API.
 *
 * Mantém a página anterior na tela enquanto a nova carrega, para a tabela não
 * piscar a cada busca ou troca de página.
 *
 * @param filters Busca, situação e página.
 * @param options `enabled` para não consultar (ex.: sem `user:read`).
 * @returns O resultado da query com `Page<User>` em `data`.
 */
export function useUsers(
  { q, status, page }: UsersFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const api = useApi();
  const filters: UsersFilters = { q, status, page };

  return useQuery({
    queryKey: usersKeys.list(filters),
    queryFn: () => {
      const searchParams: Record<string, string | number> = {
        page,
        limit: USERS_PAGE_SIZE,
      };
      if (q) searchParams.q = q;
      if (status !== 'ALL') searchParams.status = status;
      return api.get('users', { searchParams }).json<Page<User>>();
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Devolve uma função que busca um usuário no servidor (`GET /users/:id`), para
 * o editor mostrar a versão atual depois de um `409`.
 *
 * @returns Função que recebe o id e resolve com o usuário.
 */
export function useFetchUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return (id: string) =>
    queryClient.fetchQuery({
      queryKey: usersKeys.detail(id),
      queryFn: () => api.get(`users/${id}`).json<User>(),
      staleTime: 0,
    });
}

/**
 * Cria um usuário (`POST /users`).
 *
 * `gcTime: 0`: a resposta traz a senha provisória, que não deve ficar no cache
 * de mutações depois de a tela mostrá-la.
 *
 * @returns A mutation; a variável é o corpo. Erros (`EMAIL_ALREADY_REGISTERED`,
 * `INVALID_USER_NAME`...) sobem para quem chamou mostrar no campo.
 */
export function useCreateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: (input: CreateUserInput) =>
      api.post('users', { json: input }).json<UserWithTemporaryPassword>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

/** Entrada do `PATCH` de nome e papel. */
interface UpdateUserVariables {
  id: string;
  input: UpdateUserInput;
}

/**
 * Altera nome e papel (`PATCH /users/:id`). A `version` vai no corpo; se outra
 * pessoa salvou antes a API responde `409 USER_VERSION_OUTDATED`.
 *
 * @returns A mutation; a variável é `{ id, input }`.
 */
export function useUpdateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateUserVariables) =>
      api.patch(`users/${id}`, { json: input }).json<User>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

/**
 * Desativa um usuário (`POST /users/:id/deactivate`, idempotente): ele perde o
 * login e os refresh tokens na hora.
 *
 * @returns A mutation; a variável é o `id`.
 */
export function useDeactivateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post(`users/${id}/deactivate`).json<User>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

/**
 * Reativa um usuário desativado (`POST /users/:id/reactivate`, idempotente) e
 * destrava a conta.
 *
 * @returns A mutation; a variável é o `id`.
 */
export function useReactivateUser() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post(`users/${id}/reactivate`).json<User>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

/**
 * Redefine a senha (`POST /users/:id/reset-password`): gera uma provisória
 * (devolvida uma única vez), destrava a conta e encerra as sessões da pessoa.
 *
 * `gcTime: 0` pelo mesmo motivo de `useCreateUser`.
 *
 * @returns A mutation; a variável é o `id`.
 */
export function useResetUserPassword() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: (id: string) =>
      api.post(`users/${id}/reset-password`).json<UserWithTemporaryPassword>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
  });
}

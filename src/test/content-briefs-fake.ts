import { vi } from 'vitest';

import type { ContentBriefBody } from '@/hooks/use-content-briefs';
import { ApiError } from '@/lib/api-error';
import type { Page } from '@/types/api';
import type {
  ContentBriefLink,
  ContentBriefResponse,
  ContentBriefStatus,
  ContentBriefSummary,
  DueStatus,
} from '@/types/content-brief';

/** "Hoje" de todos os testes de pauta (sábado). */
export const TODAY = '2026-11-14';

function days(dueDate: string): number {
  const ms =
    Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Soma `n` days a uma data `YYYY-MM-DD`. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Mesma tabela do ADR-005, para as fixtures nascerem coerentes. */
export function classify(
  dueDate: string | null,
  status: ContentBriefStatus,
): DueStatus {
  if (status === 'DONE') return 'completed';
  if (dueDate === null) return 'no-due-date';
  const n = days(dueDate);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'next-7-days';
  return 'later';
}

/**
 * Pauta de teste. Informe `dueInDays` (days a partir de hoje) em vez de
 * `dueDate` para a situação e `daysUntilDue` saírem coerentes.
 */
export function buildContentBrief(
  partial: Partial<ContentBriefResponse> & {
    id: string;
    dueInDays?: number | null;
  },
): ContentBriefResponse {
  const { dueInDays, ...rest } = partial;
  const dueDate =
    rest.dueDate !== undefined
      ? rest.dueDate
      : dueInDays === undefined
        ? addDays(TODAY, 10)
        : dueInDays === null
          ? null
          : addDays(TODAY, dueInDays);
  const status = rest.status ?? 'TODO';

  return {
    title: `Pauta ${rest.id}`,
    description: '',
    dueDate,
    dueStatus: classify(dueDate, status),
    daysUntilDue: dueDate === null ? null : days(dueDate),
    status,
    action: null,
    channel: null,
    estateDevelopment: null,
    owner: null,
    completedAt: null,
    version: 1,
    createdAt: '2026-11-01T10:00:00.000Z',
    createdBy: { id: 'u1', name: 'Dev Editor' },
    updatedAt: '2026-11-01T10:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Dev Editor' },
    ...rest,
  };
}

interface ConsultaGet {
  searchParams?: Record<string, string | number>;
}

function csv(value: string | number | undefined): string[] | null {
  return value === undefined ? null : String(value).split(',');
}

/**
 * API em memória que respeita o contrato §4 no que a tela usa: filtros
 * (`dueStatus`, `status`, `estateDevelopmentId`, `ownerId`, `action`, `q`),
 * `sort`, paginação, resumo, `GET /:id`, `POST`, `PUT` (com checagem de versão
 * e substituição total, como a API real), `PATCH` de status e `DELETE`.
 *
 * `failures` injeta o erro da próxima chamada que casar com `METODO path`.
 * `calls` guarda cada `GET content-briefs` com os parâmetros recebidos;
 * `creations`, `edits` e `deletions` guardam o que chegou nas escritas.
 * `vinculos` (id → empreendimento/responsável) permite devolver o nome dos
 * cadastros atribuídos.
 */
export function createContentBriefsApiFake(
  briefs: ContentBriefResponse[],
  failures: Record<string, ApiError> = {},
  vinculos: Record<string, ContentBriefLink> = {},
) {
  const calls: {
    path: string;
    params: Record<string, string | number>;
  }[] = [];
  const patches: { id: string; status: ContentBriefStatus; version: number }[] =
    [];
  const creations: ContentBriefBody[] = [];
  const edits: {
    id: string;
    body: ContentBriefBody & { version: number };
  }[] = [];
  const deletions: string[] = [];
  let sequence = 0;

  function link(id: string | null): ContentBriefLink | null {
    if (id === null) return null;
    return vinculos[id] ?? { id, name: id, active: true };
  }

  function apply(brief: ContentBriefResponse, body: ContentBriefBody) {
    brief.title = body.title;
    brief.description = body.description;
    brief.dueDate = body.dueDate;
    brief.status = body.status;
    brief.action = body.action;
    brief.channel = body.channel;
    brief.estateDevelopment = link(body.estateDevelopmentId);
    brief.owner = link(body.ownerId);
    brief.dueStatus = classify(brief.dueDate, brief.status);
    brief.daysUntilDue = brief.dueDate === null ? null : days(brief.dueDate);
  }

  function notFound() {
    return new ApiError({
      status: 404,
      code: 'CONTENT_BRIEF_NOT_FOUND',
      message: 'Pauta não encontrada.',
    });
  }

  function filter(
    params: Record<string, string | number>,
    withDueStatus: boolean,
  ) {
    const dueStatuses = withDueStatus ? csv(params.dueStatus) : null;
    const status = csv(params.status);
    return briefs.filter((p) => {
      if (dueStatuses && !dueStatuses.includes(p.dueStatus)) return false;
      if (status && !status.includes(p.status)) return false;
      if (
        params.estateDevelopmentId &&
        (params.estateDevelopmentId === 'none'
          ? p.estateDevelopment !== null
          : p.estateDevelopment?.id !== params.estateDevelopmentId)
      )
        return false;
      if (
        params.ownerId &&
        (params.ownerId === 'none'
          ? p.owner !== null
          : p.owner?.id !== params.ownerId)
      )
        return false;
      if (params.action && p.action !== params.action) return false;
      if (params.q) {
        const target = `${p.title} ${p.description}`.toLowerCase();
        if (!target.includes(String(params.q).toLowerCase())) return false;
      }
      return true;
    });
  }

  function summary(
    params: Record<string, string | number>,
  ): ContentBriefSummary {
    const base = filter(params, false);
    const byDueStatus: Record<DueStatus, number> = {
      overdue: 0,
      today: 0,
      'next-7-days': 0,
      later: 0,
      'no-due-date': 0,
      completed: 0,
    };
    const byStatus: Record<ContentBriefStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    for (const p of base) {
      byDueStatus[p.dueStatus]++;
      byStatus[p.status]++;
    }
    return { today: TODAY, total: base.length, byDueStatus, byStatus };
  }

  function list(
    params: Record<string, string | number>,
  ): Page<ContentBriefResponse> {
    const sorted = [...filter(params, true)].sort((a, b) => {
      const sign = params.sort === '-dueDate' ? -1 : 1;
      if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -sign : sign;
    });
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 50);
    return {
      data: sorted
        .slice((page - 1) * limit, page * limit)
        .map((p) => ({ ...p })),
      total: sorted.length,
      page,
      limit,
    };
  }

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

  const api = {
    get: vi.fn((path: string, options: ConsultaGet = {}) => {
      const params = options.searchParams ?? {};
      calls.push({ path, params });
      return respond(`GET ${path}`, () => {
        if (path === 'content-briefs/summary') return summary(params);
        if (path === 'content-briefs') return list(params);
        const brief = briefs.find((p) => `content-briefs/${p.id}` === path);
        if (!brief) throw notFound();
        return { ...brief };
      });
    }),
    post: vi.fn((path: string, options: { json: ContentBriefBody }) => {
      creations.push(options.json);
      return respond(`POST ${path}`, () => {
        sequence += 1;
        const brief = buildContentBrief({ id: `criada-${sequence}` });
        apply(brief, options.json);
        briefs.push(brief);
        return { ...brief };
      });
    }),
    put: vi.fn(
      (
        path: string,
        options: { json: ContentBriefBody & { version: number } },
      ) => {
        const id = path.split('/')[1] ?? '';
        edits.push({ id, body: options.json });
        return respond(`PUT ${path}`, () => {
          const brief = briefs.find((p) => p.id === id);
          if (!brief) throw notFound();
          if (brief.version !== options.json.version) {
            throw new ApiError({
              status: 409,
              code: 'CONTENT_BRIEF_VERSION_OUTDATED',
              message: 'Versão desatualizada.',
            });
          }
          apply(brief, options.json);
          brief.version += 1;
          return { ...brief };
        });
      },
    ),
    delete: vi.fn(async (path: string) => {
      const id = path.split('/')[1] ?? '';
      deletions.push(id);
      const failure = failures[`DELETE ${path}`];
      if (failure) {
        delete failures[`DELETE ${path}`];
        throw failure;
      }
      const index = briefs.findIndex((p) => p.id === id);
      if (index < 0) throw notFound();
      briefs.splice(index, 1);
    }),
    patch: vi.fn(
      (
        path: string,
        options: { json: { status: ContentBriefStatus; version: number } },
      ) => {
        const id = path.split('/')[1] ?? '';
        patches.push({ id, ...options.json });
        return respond(`PATCH ${path}`, () => {
          const brief = briefs.find((p) => p.id === id);
          if (!brief) throw new Error('pauta inexistente');
          brief.status = options.json.status;
          brief.version += 1;
          brief.dueStatus = classify(brief.dueDate, brief.status);
          return { ...brief };
        });
      },
    ),
  };

  return { api, calls, patches, creations, edits, deletions };
}

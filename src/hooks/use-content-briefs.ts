import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApi } from '@/lib/api';
import { getErrorStatus } from '@/lib/api-error';
import { OPEN_DUE_STATUSES } from '@/lib/labels';
import type { Page } from '@/types/api';
import type {
  CommonFilters,
  ContentBriefAction,
  ContentBriefChannel,
  ContentBriefFilters,
  ContentBriefResponse,
  ContentBriefStatus,
  QuickFilter,
} from '@/types/content-brief';

/**
 * Corpo de `POST /content-briefs` e `PUT /content-briefs/:id` (plan técnico §5.3).
 *
 * O `PUT` é substituição: todo campo vai sempre, com `null` para "vazio", ou a
 * API apaga o valor.
 */
export interface ContentBriefBody {
  title: string;
  description: string;
  /** `'YYYY-MM-DD'` ou `null` (sem prazo). */
  dueDate: string | null;
  status: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopmentId: string | null;
  ownerId: string | null;
}

/** Itens por consulta na visão por prazo (máximo da API, ADR-010). */
export const DUE_DATE_PAGE_LIMIT = 200;

/** Itens por página nas colunas do quadro e no grupo de concluídas. */
export const PAGE_LIMIT = 50;

const ONE_MINUTE_MS = 60_000;

/**
 * Opções comuns a toda consulta de pauta.
 *
 * `staleTime: 0` faz o `refetchOnWindowFocus` valer de fato (o padrão global
 * de 5 minutos o suprimiria): a pessoa volta para a aba e vê o que as outras
 * mudaram. O intervalo de 1 minuto cobre quem deixa a tela aberta.
 * `placeholderData` mantém a lista anterior na tela enquanto o filtro novo
 * carrega, sem piscar o "Carregando".
 */
export const CONTENT_BRIEF_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnWindowFocus: true,
  refetchInterval: ONE_MINUTE_MS,
  placeholderData: keepPreviousData,
} as const;

/**
 * Converte os filtros em query string, descartando o que está vazio.
 *
 * @param filters Filtros da consulta.
 * @returns Parâmetros prontos para o `searchParams` do `ky`.
 */
export function toSearchParams(
  filters: ContentBriefFilters,
): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params[key] = value;
  }
  return params;
}

/**
 * Situações pedidas pela visão por prazo para as pautas abertas.
 *
 * "Concluídas" não tem grupos abertos: quem chama nem faz a consulta.
 *
 * @param quickFilter Filtro rápido ativo.
 * @returns CSV de situações, como a API espera.
 */
export function openDueStatuses(quickFilter: QuickFilter): string {
  if (quickFilter === 'overdue') return 'overdue';
  if (quickFilter === 'next-7-days') return 'today,next-7-days';
  return OPEN_DUE_STATUSES.join(',');
}

/**
 * Situação que o filtro rápido impõe a cada coluna do quadro por status.
 *
 * @param quickFilter Filtro rápido ativo.
 * @returns CSV de situações, ou `undefined` para "Todas" (sem restrição).
 */
export function boardDueStatus(quickFilter: QuickFilter): string | undefined {
  if (quickFilter === 'overdue') return 'overdue';
  if (quickFilter === 'next-7-days') return 'today,next-7-days';
  if (quickFilter === 'completed') return 'completed';
  return undefined;
}

function nextPageOf(
  last: Page<ContentBriefResponse>,
  all: Page<ContentBriefResponse>[],
): number | undefined {
  const loaded = all.reduce((n, page) => n + page.data.length, 0);
  return loaded < last.total ? all.length + 1 : undefined;
}

function useContentBriefList(query: ContentBriefFilters, enabled = true) {
  const api = useApi();

  return useInfiniteQuery({
    queryKey: ['content-briefs', 'list', query],
    queryFn: ({ pageParam }) =>
      api
        .get('content-briefs', {
          searchParams: toSearchParams({ ...query, page: pageParam }),
        })
        .json<Page<ContentBriefResponse>>(),
    initialPageParam: 1,
    getNextPageParam: nextPageOf,
    enabled,
    ...CONTENT_BRIEF_QUERY_OPTIONS,
  });
}

/**
 * Pautas abertas da visão por prazo: uma consulta só, ordenada por prazo; o
 * agrupamento por situação é feito por quem chama.
 *
 * @param filters Filtros comuns (empreendimento, responsável, ação, busca).
 * @param quickFilter Filtro rápido; define as situações pedidas.
 * @param enabled `false` com o chip "Concluídas", que não mostra abertas.
 * @returns A query infinita; `hasNextPage` indica "Mostrar mais".
 */
export function useOpenContentBriefs(
  filters: CommonFilters,
  quickFilter: QuickFilter,
  enabled = true,
) {
  return useContentBriefList(
    {
      ...filters,
      dueStatus: openDueStatuses(quickFilter),
      sort: 'dueDate',
      limit: DUE_DATE_PAGE_LIMIT,
    },
    enabled && quickFilter !== 'completed',
  );
}

/**
 * Pautas concluídas, mais recentes primeiro. Só consulta quando o grupo está
 * aberto: concluídas acumulam e quase nunca interessam.
 *
 * @param filters Filtros comuns.
 * @param enabled Se o grupo "Concluídas" está aberto.
 * @returns A query infinita (50 por página).
 */
export function useCompletedContentBriefs(
  filters: CommonFilters,
  enabled: boolean,
) {
  return useContentBriefList(
    {
      ...filters,
      dueStatus: 'completed',
      sort: '-dueDate',
      limit: PAGE_LIMIT,
    },
    enabled,
  );
}

/**
 * Uma coluna do quadro por status, paginada.
 *
 * @param status Status da coluna.
 * @param filters Filtros comuns.
 * @param quickFilter Filtro rápido; restringe a situação quando não é "Todas".
 * @returns A query infinita (50 por página).
 */
export function useContentBriefsByStatus(
  status: ContentBriefStatus,
  filters: CommonFilters,
  quickFilter: QuickFilter,
) {
  return useContentBriefList({
    ...filters,
    status,
    dueStatus: boardDueStatus(quickFilter),
    sort: status === 'DONE' ? '-dueDate' : 'dueDate',
    limit: PAGE_LIMIT,
  });
}

type CachedList = InfiniteData<Page<ContentBriefResponse>, number>;

function isCachedList(data: unknown): data is CachedList {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as CachedList).pages)
  );
}

function updateContentBriefInCache(
  client: QueryClient,
  id: string,
  apply: (brief: ContentBriefResponse) => ContentBriefResponse,
) {
  client.setQueriesData({ queryKey: ['content-briefs'] }, (data: unknown) => {
    if (!isCachedList(data)) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.map((p) => (p.id === id ? apply(p) : p)),
      })),
    };
  });
}

/** Entrada do `PATCH` de status. */
export interface ChangeStatusInput {
  id: string;
  status: ContentBriefStatus;
  /** `version` da pauta como exibida, para detectar edição concorrente. */
  version: number;
}

/**
 * Troca o status de uma pauta (`PATCH /content-briefs/:id/status`).
 *
 * Otimista: muda o campo `status` onde a pauta estiver em cache e desfaz tudo
 * se der erro. Não tenta mover a pauta de grupo ou coluna no cache; a
 * invalidação do `onSettled` traz as listas e o resumo reposicionados.
 * Em sucesso, grava a resposta da API na pauta (para a próxima troca já ir
 * com a `version` nova, sem esperar o refetch).
 *
 * @returns A mutation; a variável é `{ id, status, version }`.
 */
export function useChangeContentBriefStatus() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, version }: ChangeStatusInput) =>
      api
        .patch(`content-briefs/${id}/status`, { json: { status, version } })
        .json<ContentBriefResponse>(),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['content-briefs'] });
      const previous = queryClient.getQueriesData({
        queryKey: ['content-briefs'],
      });
      updateContentBriefInCache(queryClient, id, (p) => ({ ...p, status }));
      return { previous };
    },
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (brief) =>
      updateContentBriefInCache(queryClient, brief.id, () => brief),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['content-briefs'] }),
  });
}

/** Entrada do `PUT`: o corpo completo mais a `version` carregada. */
export interface UpdateContentBriefInput {
  id: string;
  body: ContentBriefBody;
  /** `version` da pauta como o editor a carregou (ADR-006). */
  version: number;
}

/**
 * Uma pauta pelo id (`GET /content-briefs/:id`), para o editor.
 *
 * Fica fora da chave `['content-briefs']` e sem refetch automático: o editor
 * tira uma foto da pauta ao abrir, e uma releitura no meio da digitação não
 * pode trocar o que a pessoa está editando (a `version` mudaria sem ela ver).
 * `gcTime: 0` descarta a cópia ao fechar, então reabrir sempre lê o servidor.
 * Não repete o `404`: a pauta não existe mais e o editor fecha.
 * A chave `['content-brief', id]` não começa em `['content-briefs']`, então
 * invalidar as listas depois de gravar não dispara releitura da pauta aberta.
 *
 * @param id Id da pauta, ou `null` para não consultar (pauta nova).
 * @returns A query com `ContentBriefResponse` em `data`.
 */
export function useContentBrief(id: string | null) {
  const api = useApi();

  return useQuery({
    queryKey: ['content-brief', id],
    queryFn: () => api.get(`content-briefs/${id}`).json<ContentBriefResponse>(),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: (attempts, error) => getErrorStatus(error) !== 404 && attempts < 1,
  });
}

function useInvalidateContentBriefs() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: ['content-briefs'] });
}

/**
 * Cria uma pauta (`POST /content-briefs`) e invalida listas e resumo.
 *
 * @returns A mutation; a variável é o `ContentBriefBody`.
 */
export function useCreateContentBrief() {
  const api = useApi();
  const invalidate = useInvalidateContentBriefs();

  return useMutation({
    mutationFn: (body: ContentBriefBody) =>
      api.post('content-briefs', { json: body }).json<ContentBriefResponse>(),
    onSuccess: () => invalidate(),
  });
}

/**
 * Edita uma pauta (`PUT /content-briefs/:id`) com o corpo completo e a `version`.
 *
 * `409 CONTENT_BRIEF_VERSION_OUTDATED` sobe para o editor, que mantém o texto
 * digitado e oferece recarregar (ADR-006).
 *
 * @returns A mutation; a variável é `{ id, body, version }`.
 */
export function useUpdateContentBrief() {
  const api = useApi();
  const invalidate = useInvalidateContentBriefs();

  return useMutation({
    mutationFn: ({ id, body, version }: UpdateContentBriefInput) =>
      api
        .put(`content-briefs/${id}`, { json: { ...body, version } })
        .json<ContentBriefResponse>(),
    onSuccess: () => invalidate(),
  });
}

/**
 * Exclui uma pauta (`DELETE /content-briefs/:id`, `204`) e invalida listas e
 * resumo.
 *
 * @returns A mutation; a variável é o `id`.
 */
export function useDeleteContentBrief() {
  const api = useApi();
  const invalidate = useInvalidateContentBriefs();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`content-briefs/${id}`);
    },
    onSuccess: () => invalidate(),
  });
}

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ useApi: vi.fn() }));

import { useApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import {
  buildContentBrief,
  createContentBriefsApiFake,
} from '@/test/content-briefs-fake';
import { createTestQueryClient } from '@/test/render-with-providers';
import type { QuickFilter } from '@/types/content-brief';
import { useContentBriefSummary } from './use-content-brief-summary';
import {
  boardDueStatus,
  type ContentBriefBody,
  openDueStatuses,
  useChangeContentBriefStatus,
  useCompletedContentBriefs,
  useContentBrief,
  useContentBriefsByStatus,
  useCreateContentBrief,
  useDeleteContentBrief,
  useOpenContentBriefs,
  useUpdateContentBrief,
} from './use-content-briefs';

function prepareApi(
  briefs = [buildContentBrief({ id: 'a' })],
  failures: Record<string, ApiError> = {},
) {
  const fake = createContentBriefsApiFake(briefs, failures);
  vi.mocked(useApi).mockReturnValue(
    fake.api as unknown as ReturnType<typeof useApi>,
  );
  return fake;
}

function createWrapper() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('situações pedidas por chip', () => {
  it('visão por prazo: abertas conforme o chip', () => {
    expect(openDueStatuses('all')).toBe(
      'overdue,today,next-7-days,later,no-due-date',
    );
    expect(openDueStatuses('overdue')).toBe('overdue');
    expect(openDueStatuses('next-7-days')).toBe('today,next-7-days');
  });

  it('quadro por status: "Todas" não restringe a situação', () => {
    expect(boardDueStatus('all')).toBeUndefined();
    expect(boardDueStatus('overdue')).toBe('overdue');
    expect(boardDueStatus('next-7-days')).toBe('today,next-7-days');
    expect(boardDueStatus('completed')).toBe('completed');
  });
});

describe('consultas de pauta', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each<[QuickFilter, string]>([
    ['all', 'overdue,today,next-7-days,later,no-due-date'],
    ['overdue', 'overdue'],
    ['next-7-days', 'today,next-7-days'],
  ])('abertas com o chip %s pedem prazo, limite 200 e as situações certas', async (chip, dueStatus) => {
    const { calls } = prepareApi();
    const { wrapper } = createWrapper();

    renderHook(() => useOpenContentBriefs({ q: 'bora' }, chip), { wrapper });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.path).toBe('content-briefs');
    expect(calls[0]?.params).toEqual({
      q: 'bora',
      dueStatus,
      sort: 'dueDate',
      limit: 200,
      page: 1,
    });
  });

  it('com o chip Concluídas as abertas não são consultadas', async () => {
    const { calls } = prepareApi();
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useOpenContentBriefs({}, 'completed'), {
      wrapper,
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('abertas pedem a próxima página enquanto houver mais que o limite', async () => {
    const briefs = Array.from({ length: 205 }, (_, i) =>
      buildContentBrief({
        id: `p${i}`,
        title: `P ${String(i).padStart(3, '0')}`,
      }),
    );
    const { calls } = prepareApi(briefs);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useOpenContentBriefs({}, 'all'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(result.current.data?.pages[0]?.data).toHaveLength(200);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(calls.at(-1)?.params.page).toBe(2);
    await waitFor(() =>
      expect(result.current.data?.pages[1]?.data).toHaveLength(5),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('concluídas só consultam quando habilitadas, mais recentes primeiro, 50 por página', async () => {
    const { calls } = prepareApi();
    const { wrapper } = createWrapper();

    const { rerender } = renderHook(
      ({ open }) => useCompletedContentBriefs({}, open),
      { wrapper, initialProps: { open: false } },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toHaveLength(0);

    rerender({ open: true });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.params).toEqual({
      dueStatus: 'completed',
      sort: '-dueDate',
      limit: 50,
      page: 1,
    });
  });

  it('cada coluna do quadro consulta o seu status, com a situação do chip', async () => {
    const { calls } = prepareApi();
    const { wrapper } = createWrapper();

    renderHook(
      () => ({
        fazer: useContentBriefsByStatus('TODO', {}, 'all'),
        concluida: useContentBriefsByStatus(
          'DONE',
          { action: 'CREATE' },
          'overdue',
        ),
      }),
      { wrapper },
    );

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.map((c) => c.params)).toContainEqual({
      status: 'TODO',
      sort: 'dueDate',
      limit: 50,
      page: 1,
    });
    expect(calls.map((c) => c.params)).toContainEqual({
      status: 'DONE',
      dueStatus: 'overdue',
      action: 'CREATE',
      sort: '-dueDate',
      limit: 50,
      page: 1,
    });
  });

  it('resumo leva só os filtros comuns, sem situação nem paginação', async () => {
    const { calls } = prepareApi();
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useContentBriefSummary({
          estateDevelopmentId: 'none',
          action: 'CHASE',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.today).toBe('2026-11-14'));
    expect(calls[0]).toEqual({
      path: 'content-briefs/summary',
      params: { estateDevelopmentId: 'none', action: 'CHASE' },
    });
  });
});

describe('useAlterarStatusPauta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muda o status no cache na hora, manda a version e invalida as consultas ao fim', async () => {
    const { api, patches } = prepareApi([
      buildContentBrief({ id: 'a', version: 3 }),
    ]);
    const { client, wrapper } = createWrapper();
    const query = renderHook(() => useOpenContentBriefs({}, 'all'), {
      wrapper,
    });
    await waitFor(() => expect(query.result.current.data).toBeDefined());
    const invalidar = vi.spyOn(client, 'invalidateQueries');

    let liberar: () => void = () => {};
    const original = api.patch.getMockImplementation();
    api.patch.mockImplementationOnce((...args) => {
      const resposta = original?.(...args);
      return {
        json: () =>
          new Promise((resolve) => {
            liberar = () => resolve(resposta?.json());
          }),
      } as ReturnType<typeof api.patch>;
    });

    const mutation = renderHook(() => useChangeContentBriefStatus(), {
      wrapper,
    });
    act(() => {
      mutation.result.current.mutate({
        id: 'a',
        status: 'IN_REVIEW',
        version: 3,
      });
    });

    await waitFor(() =>
      expect(query.result.current.data?.pages[0]?.data[0]?.status).toBe(
        'IN_REVIEW',
      ),
    );
    expect(patches).toEqual([{ id: 'a', status: 'IN_REVIEW', version: 3 }]);

    await act(async () => liberar());
    await waitFor(() => expect(mutation.result.current.isSuccess).toBe(true));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
    expect(query.result.current.data?.pages[0]?.data[0]?.version).toBe(4);
  });

  it('desfaz a troca e invalida quando a API recusa', async () => {
    const erro = new ApiError({
      status: 409,
      code: 'CONTENT_BRIEF_VERSION_OUTDATED',
      message: 'versão',
    });
    prepareApi([buildContentBrief({ id: 'a', status: 'TODO' })], {
      'PATCH content-briefs/a/status': erro,
    });
    const { client, wrapper } = createWrapper();
    const query = renderHook(() => useOpenContentBriefs({}, 'all'), {
      wrapper,
    });
    await waitFor(() => expect(query.result.current.data).toBeDefined());
    const invalidar = vi.spyOn(client, 'invalidateQueries');

    const mutation = renderHook(() => useChangeContentBriefStatus(), {
      wrapper,
    });
    await act(async () => {
      await mutation.result.current
        .mutateAsync({ id: 'a', status: 'DONE', version: 1 })
        .catch(() => undefined);
    });

    await waitFor(() => expect(mutation.result.current.error).toBe(erro));
    expect(query.result.current.data?.pages[0]?.data[0]?.status).toBe('TODO');
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });

  it('atualiza a pauta em todas as listas em cache (prazo e quadro)', async () => {
    prepareApi([buildContentBrief({ id: 'a', status: 'TODO' })]);
    const { wrapper } = createWrapper();
    const listas = renderHook(
      () => ({
        dueDate: useOpenContentBriefs({}, 'all'),
        quadro: useContentBriefsByStatus('TODO', {}, 'all'),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(listas.result.current.dueDate.data).toBeDefined();
      expect(listas.result.current.quadro.data).toBeDefined();
    });

    const mutation = renderHook(() => useChangeContentBriefStatus(), {
      wrapper,
    });
    await act(async () => {
      await mutation.result.current.mutateAsync({
        id: 'a',
        status: 'IN_PROGRESS',
        version: 1,
      });
    });

    await waitFor(() =>
      expect(
        listas.result.current.dueDate.data?.pages[0]?.data[0]?.status,
      ).toBe('IN_PROGRESS'),
    );
  });
});

const CORPO: ContentBriefBody = {
  title: 'Nova',
  description: '',
  dueDate: null,
  status: 'TODO',
  action: null,
  channel: null,
  estateDevelopmentId: null,
  ownerId: null,
};

describe('usePauta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lê a pauta pelo id e não consulta quando o id é nulo', async () => {
    const fake = prepareApi([buildContentBrief({ id: 'a', title: 'Alvo' })]);
    const { wrapper } = createWrapper();

    const vazio = renderHook(() => useContentBrief(null), { wrapper });
    expect(vazio.result.current.fetchStatus).toBe('idle');

    const lido = renderHook(() => useContentBrief('a'), { wrapper });
    await waitFor(() => expect(lido.result.current.data?.title).toBe('Alvo'));
    expect(fake.api.get).toHaveBeenCalledWith('content-briefs/a');
  });

  it('não repete a consulta quando a pauta não existe (404)', async () => {
    const fake = prepareApi([]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useContentBrief('fantasma'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fake.api.get).toHaveBeenCalledTimes(1);
  });
});

describe('escritas de pauta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('criar manda o corpo e invalida as listas e o resumo', async () => {
    const fake = prepareApi([]);
    const { client, wrapper } = createWrapper();
    const invalidar = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateContentBrief(), { wrapper });

    let criada: { id: string } | undefined;
    await act(async () => {
      criada = await result.current.mutateAsync(CORPO);
    });

    expect(fake.creations).toEqual([CORPO]);
    expect(criada?.id).toBe('criada-1');
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });

  it('editar manda o corpo completo com a version e invalida', async () => {
    const fake = prepareApi([buildContentBrief({ id: 'a', version: 4 })]);
    const { client, wrapper } = createWrapper();
    const invalidar = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateContentBrief(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'a', body: CORPO, version: 4 });
    });

    expect(fake.edits).toEqual([{ id: 'a', body: { ...CORPO, version: 4 } }]);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });

  it('editar com version velha sobe o 409 sem invalidar', async () => {
    prepareApi([buildContentBrief({ id: 'a', version: 5 })]);
    const { client, wrapper } = createWrapper();
    const invalidar = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateContentBrief(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'a', body: CORPO, version: 4 }),
      ).rejects.toMatchObject({ code: 'CONTENT_BRIEF_VERSION_OUTDATED' });
    });

    expect(invalidar).not.toHaveBeenCalled();
  });

  it('excluir chama DELETE e invalida', async () => {
    const fake = prepareApi([buildContentBrief({ id: 'a' })]);
    const { client, wrapper } = createWrapper();
    const invalidar = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteContentBrief(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('a');
    });

    expect(fake.deletions).toEqual(['a']);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });
});

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '@/lib/api';
import { createTestQueryClient } from '@/test/render-with-providers';
import type { Registry } from '@/types/registry';
import {
  useArchiveRegistry,
  useCreateRegistry,
  useReactivateRegistry,
  useRegistries,
  useRenameRegistry,
} from './use-registries';

const IPE: Registry = {
  id: 'e1',
  name: 'Residencial Ipê',
  active: true,
  version: 1,
  openContentBriefs: 2,
};

function createApiMock(resposta: unknown = IPE) {
  const resultado = () => ({ json: () => Promise.resolve(resposta) });
  const api = {
    get: vi.fn(resultado),
    post: vi.fn(resultado),
    patch: vi.fn(resultado),
  };
  vi.mocked(useApi).mockReturnValue(api as never);
  return api;
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useCadastros', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReset();
  });

  it('lista só os ativos por padrão, no recurso informado', async () => {
    const api = createApiMock([IPE]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRegistries('estate-developments'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.data).toEqual([IPE]));
    expect(api.get).toHaveBeenCalledWith('estate-developments', {
      searchParams: { includeArchived: false },
    });
  });

  it('pede os arquivados quando includeArchived é verdadeiro e guarda em outra chave', async () => {
    const api = createApiMock([IPE]);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRegistries('owners', { includeArchived: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('owners', {
      searchParams: { includeArchived: true },
    });
    expect(
      queryClient.getQueryData([
        'registries',
        'owners',
        { includeArchived: true },
      ]),
    ).toEqual([IPE]);
  });
});

describe('mutations de cadastro', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReset();
  });

  it('criar faz POST com o nome e invalida só a lista do mesmo recurso', async () => {
    const api = createApiMock();
    const { queryClient, wrapper } = createWrapper();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateRegistry('estate-developments'),
      {
        wrapper,
      },
    );
    await result.current.mutateAsync('Residencial Ipê');

    expect(api.post).toHaveBeenCalledWith('estate-developments', {
      json: { name: 'Residencial Ipê' },
    });
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: ['registries', 'estate-developments'],
    });
    expect(invalidar).not.toHaveBeenCalledWith({
      queryKey: ['content-briefs'],
    });
  });

  it('renomear faz PATCH com nome e version e invalida também as pautas', async () => {
    const api = createApiMock();
    const { queryClient, wrapper } = createWrapper();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRenameRegistry('owners'), {
      wrapper,
    });
    await result.current.mutateAsync({ id: 'r1', name: 'Ana', version: 3 });

    expect(api.patch).toHaveBeenCalledWith('owners/r1', {
      json: { name: 'Ana', version: 3 },
    });
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: ['registries', 'owners'],
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });

  it('arquivar faz POST em /archive e invalida cadastros e pautas', async () => {
    const api = createApiMock();
    const { queryClient, wrapper } = createWrapper();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useArchiveRegistry('estate-developments'),
      {
        wrapper,
      },
    );
    await result.current.mutateAsync('e1');

    expect(api.post).toHaveBeenCalledWith('estate-developments/e1/archive');
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: ['registries', 'estate-developments'],
    });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
  });

  it('reativar faz POST em /reactivate e atualiza a lista', async () => {
    const api = createApiMock();
    const { queryClient, wrapper } = createWrapper();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useReactivateRegistry('estate-developments'),
      {
        wrapper,
      },
    );
    await result.current.mutateAsync('e1');

    expect(api.post).toHaveBeenCalledWith('estate-developments/e1/reactivate');
    expect(invalidar).toHaveBeenCalledWith({
      queryKey: ['registries', 'estate-developments'],
    });
  });

  it('deixa o erro da API subir para quem chamou', async () => {
    const erro = new Error('duplicado');
    const api = createApiMock();
    api.post.mockReturnValue({ json: () => Promise.reject(erro) });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useCreateRegistry('estate-developments'),
      {
        wrapper,
      },
    );

    await expect(result.current.mutateAsync('X')).rejects.toBe(erro);
  });
});

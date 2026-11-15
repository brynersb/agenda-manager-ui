import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  createApi: vi.fn(),
}));

import { createApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { createTestQueryClient } from '@/test/render-with-providers';
import { useAuthUserInfo } from './use-auth-user-info';

const mockCreateApi = createApi as Mock;

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, retryDelay: 0 },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const USER_INFO = {
  sub: 'user-123',
  name: 'Dev Editor',
  email: 'dev.editor@bora.test',
  roles: ['content-brief-editor'],
  permissions: ['content-brief:read', 'content-brief:write'],
};

function mockApiResponse(response: unknown) {
  const get = vi.fn().mockReturnValue({
    json: () => Promise.resolve(response),
  });
  mockCreateApi.mockReturnValue({ get });
  return get;
}

function mockApiError(status: number) {
  const get = vi.fn().mockReturnValue({
    json: () => Promise.reject(new ApiError({ status })),
  });
  mockCreateApi.mockReturnValue({ get });
  return get;
}

describe('useAuthUserInfo', () => {
  beforeEach(() => {
    mockCreateApi.mockReset();
  });

  it('busca auth/user-info e devolve o corpo do contrato', async () => {
    const get = mockApiResponse(USER_INFO);

    const { result } = renderHook(
      () => useAuthUserInfo('user-123', 'token-abc', true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(get).toHaveBeenCalledWith('auth/user-info');
    expect(result.current.data).toEqual(USER_INFO);
  });

  it('não repete a busca em 401', async () => {
    const get = mockApiError(401);

    const { result } = renderHook(
      () => useAuthUserInfo('user-123', 'token-abc', true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('repete até 2 vezes em erro que não é 401', async () => {
    const get = mockApiError(500);

    const { result } = renderHook(
      () => useAuthUserInfo('user-123', 'token-abc', true),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(get).toHaveBeenCalledTimes(3);
  });

  it('não chama a API quando está desabilitado', () => {
    renderHook(() => useAuthUserInfo('user-123', 'token-abc', false), {
      wrapper,
    });

    expect(mockCreateApi).not.toHaveBeenCalled();
  });

  it('trata a busca pausada por falta de conexão como falha de carregamento, e não como usuário sem permissões', async () => {
    onlineManager.setOnline(false);
    try {
      mockApiResponse({ ...USER_INFO, permissions: [] });

      const { result } = renderHook(
        () => useAuthUserInfo('user-1', 'token', true),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeInstanceOf(Error);
    } finally {
      onlineManager.setOnline(true);
    }
  });
});

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ useApi: vi.fn() }));

import { useApi } from '@/lib/api';
import { createTestQueryClient } from '@/test/render-with-providers';
import {
  buildUser,
  createUsersApiFake,
  GENERATED_PASSWORD,
} from '@/test/users-fake';
import {
  useCreateUser,
  useDeactivateUser,
  useReactivateUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from './use-users';

function usar(
  users = [
    buildUser({ id: 'a', name: 'Ana' }),
    buildUser({ id: 'b', name: 'Beto' }),
  ],
) {
  const fake = createUsersApiFake(users, 'nao-sou-eu');
  vi.mocked(useApi).mockReturnValue(
    fake.api as unknown as ReturnType<typeof useApi>,
  );
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { fake, queryClient, wrapper };
}

describe('use-users', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReset();
  });

  describe('useUsers', () => {
    it('lista com página e limite e omite q e status quando vazios', async () => {
      const { fake, wrapper } = usar();

      const { result } = renderHook(
        () => useUsers({ status: 'ALL', page: 1 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fake.lists[0]).toEqual({ page: 1, limit: 20 });
      expect(result.current.data?.data.map((u) => u.name)).toEqual([
        'Ana',
        'Beto',
      ]);
    });

    it('manda q e status quando informados', async () => {
      const { fake, wrapper } = usar();

      const { result } = renderHook(
        () => useUsers({ q: 'ana', status: 'ACTIVE', page: 2 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fake.lists[0]).toEqual({
        q: 'ana',
        status: 'ACTIVE',
        page: 2,
        limit: 20,
      });
    });

    it('não consulta quando desabilitado (sem user:read)', () => {
      const { fake, wrapper } = usar();

      renderHook(
        () => useUsers({ status: 'ALL', page: 1 }, { enabled: false }),
        {
          wrapper,
        },
      );

      expect(fake.lists).toHaveLength(0);
    });
  });

  describe('mutações', () => {
    it('criar devolve a senha provisória e invalida a lista', async () => {
      const { queryClient, wrapper } = usar();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useCreateUser(), { wrapper });

      let resposta:
        | Awaited<ReturnType<typeof result.current.mutateAsync>>
        | undefined;
      await act(async () => {
        resposta = await result.current.mutateAsync({
          name: 'Nova',
          email: 'nova@b.co',
          role: 'content-brief-viewer',
        });
      });

      expect(resposta?.temporaryPassword).toBe(GENERATED_PASSWORD);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
    });

    it('a senha provisória não fica no cache de mutações (gcTime 0)', async () => {
      const { queryClient, wrapper } = usar();
      const { result, unmount } = renderHook(() => useResetUserPassword(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync('a');
      });
      unmount();

      await waitFor(() =>
        expect(queryClient.getMutationCache().getAll()).toHaveLength(0),
      );
    });

    it('editar manda nome, papel e versão ao PATCH', async () => {
      const { fake, wrapper } = usar();
      const { result } = renderHook(() => useUpdateUser(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          id: 'a',
          input: { name: 'Ana Lima', version: 1 },
        });
      });

      expect(fake.updates).toEqual([
        { id: 'a', body: { name: 'Ana Lima', version: 1 } },
      ]);
    });

    it('desativar e reativar chamam os endpoints do usuário', async () => {
      const { fake, wrapper } = usar();
      const desativar = renderHook(() => useDeactivateUser(), { wrapper });
      const reativar = renderHook(() => useReactivateUser(), { wrapper });

      await act(async () => {
        await desativar.result.current.mutateAsync('a');
        await reativar.result.current.mutateAsync('a');
      });

      expect(fake.actions).toEqual(['deactivate:a', 'reactivate:a']);
    });
  });
});

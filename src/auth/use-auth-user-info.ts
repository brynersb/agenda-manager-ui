import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createApi } from '@/lib/api';
import { getErrorStatus } from '@/lib/api-error';
import type { UserInfo } from '@/types/auth';

/**
 * Busca `GET /auth/user-info`, a única fonte das permissões (a decisão de
 * acesso nunca olha os papéis do token).
 *
 * @param sub Identificador da pessoa; faz parte da chave de cache para que
 * trocar de usuário no mesmo navegador não reaproveite permissões alheias.
 * @param accessToken Access token vigente.
 * @param enabled Só busca com sessão OIDC pronta.
 * @returns `data`, `isLoading`, `isError` e `error`. Busca pausada por falta de
 * rede conta como erro de carregamento.
 */
export function useAuthUserInfo(
  sub: string,
  accessToken: string,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: ['auth', 'userInfo', sub],
    queryFn: async () => {
      const api = createApi(() => accessToken);
      return api.get('auth/user-info').json<UserInfo>();
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: (failureCount, error) => {
      if (getErrorStatus(error) === 401) return false;
      return failureCount < 2;
    },
  });

  // Sem rede o React Query PAUSA a busca em vez de falhar: `isLoading` vira
  // false, não há erro nem dados, e as permissões vazias seriam lidas como
  // "usuário sem acesso". Busca pausada sem dados é falha de carregamento, não
  // uma negativa.
  const isPausedWithoutData =
    query.isPending && query.fetchStatus === 'paused' && !query.data;
  const error = useMemo(
    () =>
      query.error ??
      (isPausedWithoutData
        ? new Error('Sem conexão com o servidor para carregar as permissões.')
        : null),
    [query.error, isPausedWithoutData],
  );

  return useMemo(
    () => ({
      data: query.data,
      isLoading: query.isLoading,
      isError: query.isError || isPausedWithoutData,
      error,
    }),
    [query.data, query.isLoading, query.isError, isPausedWithoutData, error],
  );
}

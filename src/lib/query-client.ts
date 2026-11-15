import { QueryClient } from '@tanstack/react-query';

/** Cliente de cache do TanStack Query compartilhado pela aplicação. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Descarta todo o cache de servidor.
 *
 * Chamado ao encerrar a sessão para que a próxima pessoa a entrar no mesmo
 * navegador não veja dados da anterior.
 */
export function clearSession(): void {
  queryClient.clear();
}

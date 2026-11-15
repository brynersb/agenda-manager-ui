import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { useAuthContext } from '@/auth/use-auth';
import { createAuthMock } from '@/test/auth-mock';

interface ProvidersOptions {
  /** Rota inicial do `MemoryRouter`; padrão `/`. */
  route?: string;
  /** Cliente de cache; padrão um novo, com `retry: false`. */
  queryClient?: QueryClient;
  /**
   * Cenário de auth. Quando informado, o helper programa
   * `useAuthContext`; o arquivo de teste precisa ter
   * `vi.mock('@/auth/use-auth')`.
   */
  auth?: Parameters<typeof createAuthMock>[0];
}

/** Cliente de cache de teste: sem retry, para o erro aparecer de imediato. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function prepararAuth(auth: ProvidersOptions['auth']) {
  if (auth) vi.mocked(useAuthContext).mockReturnValue(createAuthMock(auth));
}

/**
 * Renderiza um componente com os provedores globais da aplicação: TanStack
 * Query e roteador em memória, com auth simulável.
 *
 * @param ui Elemento a renderizar.
 * @param options Rota inicial, cliente de cache e cenário de auth.
 * @returns O resultado do `render` mais o `queryClient` usado.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', queryClient, auth }: ProvidersOptions = {},
) {
  prepararAuth(auth);
  const client = queryClient ?? createTestQueryClient();

  return {
    queryClient: client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

/**
 * Renderiza uma árvore de rotas (ex.: `appRoutes`) com os mesmos provedores.
 *
 * @param routes Rotas a montar.
 * @param options Rota inicial, cliente de cache e cenário de auth.
 * @returns O resultado do `render`, o `queryClient` e o `router` em memória
 * (`router.state.location` diz onde a navegação terminou).
 */
export function renderRoutes(
  routes: RouteObject[],
  { route = '/', queryClient, auth }: ProvidersOptions = {},
) {
  prepararAuth(auth);
  const client = queryClient ?? createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  return {
    queryClient: client,
    router,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

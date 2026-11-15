import { RouterProvider } from 'react-router';

import { useAppearance } from '@/hooks/use-preferences';
import { router } from '@/router';

/**
 * Raiz da interface: entrega o roteador. Provedores globais (OIDC, TanStack
 * Query) ficam em `main.tsx`.
 *
 * Também mantém o tema visual (`data-ui-theme`) aplicado no `<html>` em todas
 * as telas, inclusive as públicas, que não têm o menu do usuário.
 *
 * @returns O `RouterProvider` com as rotas da aplicação.
 */
export function App() {
  useAppearance();
  return <RouterProvider router={router} />;
}

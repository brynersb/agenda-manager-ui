import type { RouteObject } from 'react-router';
import { createBrowserRouter, Navigate } from 'react-router';

import { AuthCallback } from '@/auth/auth-callback';
import { ProtectedRoute } from '@/auth/protected-route';
import { RequirePermission } from '@/auth/require-permission';
import { AppLayout } from '@/components/layout/app-layout';
import { ContentBriefsPage } from '@/pages/content-briefs/content-briefs-page';
import { LoginPage } from '@/pages/login/login-page';
import { NoPermissionPage } from '@/pages/no-permission/no-permission-page';
import { NotFoundPage } from '@/pages/not-found/not-found-page';

/**
 * Rotas da aplicação (plan técnico §6.2).
 *
 * `RequirePermission` é a barreira de navegação; o gate por permissão também é
 * aplicado nos controles de cada tela, porque bloquear a rota não impede uma
 * ação disparada de dentro de um painel.
 */
export const appRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/no-permission', element: <NoPermissionPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/content-briefs" replace /> },
      {
        path: 'content-briefs',
        element: (
          <RequirePermission permission="content-brief:read">
            <ContentBriefsPage />
          </RequirePermission>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

/** Roteador do navegador usado em produção. */
export const router = createBrowserRouter(appRoutes);

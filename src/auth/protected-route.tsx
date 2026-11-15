import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuthContext } from '@/auth/use-auth';
import {
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';

/**
 * Barra quem não está autenticado ou ainda não tem permissão alguma.
 *
 * Sem sessão vai para `/login`; sem nenhuma permissão, para `/no-permission`;
 * falha ao carregar permissões mostra tela de recarregar, nunca "sem acesso".
 *
 * @param props.children Conteúdo liberado para quem tem acesso.
 * @returns Os filhos, um redirecionamento ou uma tela de estado.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading,
    permissions,
    isLoadingPermissions,
    permissionsError,
  } = useAuthContext();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoadingPermissions) return <LoadingScreen />;
  if (permissionsError) return <PermissionsLoadError />;
  if (permissions.length === 0) {
    return <Navigate to="/no-permission" replace />;
  }

  return <>{children}</>;
}

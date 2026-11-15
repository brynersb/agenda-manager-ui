import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { getLandingRoute } from '@/auth/landing-route';
import { useAuthContext } from '@/auth/use-auth';
import type { Permission } from '@/types/auth';

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

/**
 * Barreira de navegação por permissão.
 *
 * Quem não tem a permissão vai para a rota de entrada que lhe cabe. Bloquear a
 * rota não impede ação disparada de dentro de uma tela, então os controles
 * também checam `hasPermission`.
 *
 * @param props.permission Permissão exigida para ver o conteúdo.
 * @param props.children Conteúdo protegido.
 * @returns Os filhos ou o redirecionamento.
 */
export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const { hasPermission, permissions } = useAuthContext();

  if (!hasPermission(permission)) {
    return <Navigate to={getLandingRoute(permissions)} replace />;
  }

  return <>{children}</>;
}

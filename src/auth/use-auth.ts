import { useCallback, useMemo } from 'react';
import { useAuth as useOidcAuth } from 'react-oidc-context';

import { useAuthUserInfo } from '@/auth/use-auth-user-info';
import type { Permission, Role } from '@/types/auth';

const EMPTY_PERMISSIONS: Permission[] = [];
const EMPTY_ROLES: Role[] = [];

const ROLES: readonly Role[] = ['content-brief-editor', 'content-brief-viewer'];

/**
 * Lê os papéis do access token (`realm_access.roles`).
 *
 * Servem só para exibição enquanto `/auth/user-info` não respondeu; a decisão
 * de acesso usa apenas `permissoes` da API.
 */
function extractRoles(profile: Record<string, unknown>): Role[] {
  const roles =
    (profile.realm_access as { roles?: string[] } | undefined)?.roles ?? [];

  return roles.filter((r): r is Role => ROLES.includes(r as Role));
}

/**
 * Contexto de autenticação e autorização da aplicação.
 *
 * Junta a sessão OIDC com as permissões de `/auth/user-info`. Telas e guardas
 * decidem acesso só por `hasPermission`; nunca por papel.
 *
 * @returns Identidade, permissões, estados de carregamento e ações de
 * entrar/sair.
 */
export function useAuthContext(): {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoadingPermissions: boolean;
  permissionsError: Error | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
} {
  const auth = useOidcAuth();

  const profile = auth.user?.profile as Record<string, unknown> | undefined;
  const tokenRoles = useMemo(
    () => (profile ? extractRoles(profile) : EMPTY_ROLES),
    [profile],
  );

  const sub = (profile?.sub as string | undefined) ?? '';
  const accessToken = auth.user?.access_token ?? '';

  const meQuery = useAuthUserInfo(
    sub,
    accessToken,
    auth.isAuthenticated && !auth.isLoading,
  );

  const info = meQuery.data;
  const permissions = useMemo(
    () => info?.permissions ?? EMPTY_PERMISSIONS,
    [info?.permissions],
  );
  const roles = info?.roles ?? tokenRoles;
  const email = info?.email ?? (profile?.email as string | undefined) ?? '';
  const name = info?.name ?? (profile?.name as string | undefined) ?? '';

  const hasPermission = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const signIn = useCallback(
    () => auth.signinRedirect(),
    [auth.signinRedirect],
  );

  const signOut = useCallback(
    () => auth.signoutRedirect(),
    [auth.signoutRedirect],
  );

  return useMemo(
    () => ({
      sub,
      email,
      name,
      roles,
      permissions,
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      isLoadingPermissions: meQuery.isLoading,
      permissionsError: meQuery.error,
      signIn,
      signOut,
      hasPermission,
    }),
    [
      sub,
      email,
      name,
      roles,
      permissions,
      auth.isAuthenticated,
      auth.isLoading,
      meQuery.isLoading,
      meQuery.error,
      signIn,
      signOut,
      hasPermission,
    ],
  );
}

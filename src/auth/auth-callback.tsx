import { useEffect } from 'react';
import { useNavigate } from 'react-router';

import { getLandingRoute } from '@/auth/landing-route';
import { useAuthContext } from '@/auth/use-auth';
import {
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';

/**
 * Se o provedor devolveu `error` na URL, repassa para a tela de login, que é
 * onde a mensagem aparece.
 */
function getLoginErrorPath(): string | null {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (!error) return null;

  const next = new URLSearchParams({ error });
  const description = params.get('error_description');
  if (description) next.set('error_description', description);
  return `/login?${next.toString()}`;
}

/**
 * Destino do redirect do Keycloak: espera a sessão e as permissões e então
 * leva para a rota de entrada.
 *
 * @returns Spinner enquanto processa; tela de recarregar se as permissões
 * falharem.
 */
export function AuthCallback() {
  const {
    isAuthenticated,
    isLoading,
    permissions,
    isLoadingPermissions,
    permissionsError,
  } = useAuthContext();
  const navigate = useNavigate();
  const loginErrorPath = getLoginErrorPath();

  useEffect(() => {
    if (loginErrorPath) {
      navigate(loginErrorPath, { replace: true });
      return;
    }

    if (isLoading || isLoadingPermissions || permissionsError) return;

    if (isAuthenticated) {
      navigate(getLandingRoute(permissions), { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [
    loginErrorPath,
    isAuthenticated,
    isLoading,
    isLoadingPermissions,
    permissionsError,
    permissions,
    navigate,
  ]);

  if (!loginErrorPath && permissionsError) return <PermissionsLoadError />;

  return <LoadingScreen />;
}

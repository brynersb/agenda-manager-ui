import { Navigate } from 'react-router';

import { getLandingRoute } from '@/auth/landing-route';
import { useAuthContext } from '@/auth/use-auth';
import {
  FullScreen,
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';
import { Button } from '@/components/ui/button';

/**
 * Tela para quem entrou mas ainda não tem acesso à pauta.
 *
 * Exige sessão; quem tem alguma permissão de entrada é levado para ela, para
 * que a tela não fique acessível por engano a quem tem acesso.
 *
 * @returns A mensagem com o botão "Sair", um redirecionamento ou um estado.
 */
export function NoPermissionPage() {
  const {
    isAuthenticated,
    isLoading,
    permissions,
    isLoadingPermissions,
    permissionsError,
    signOut,
  } = useAuthContext();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoadingPermissions) return <LoadingScreen />;
  if (permissionsError) return <PermissionsLoadError />;

  const landing = getLandingRoute(permissions);
  if (landing !== '/no-permission') return <Navigate to={landing} replace />;

  return (
    <FullScreen>
      <div className="max-w-md text-center">
        <h1 className="m-0 mb-2 font-bold font-display text-2xl tracking-tight">
          Sem acesso à pauta
        </h1>
        <p className="m-0 mb-6 text-muted">
          Sua conta ainda não tem acesso à pauta. Peça acesso a quem administra
          o sistema.
        </p>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    </FullScreen>
  );
}

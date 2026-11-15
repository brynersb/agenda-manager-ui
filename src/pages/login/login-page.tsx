import { Navigate, useSearchParams } from 'react-router';

import logoBora from '@/assets/logo-bora.png';
import { getLandingRoute } from '@/auth/landing-route';
import { useAuthContext } from '@/auth/use-auth';
import {
  FullScreen,
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';
import { Button } from '@/components/ui/button';

/**
 * Tela de entrada: um botão que leva ao Keycloak.
 *
 * Quem já tem sessão é redirecionado. Falha de login devolvida pelo provedor
 * (`?error=` repassado pelo callback) aparece num aviso acima do botão.
 *
 * @returns A tela de login, um redirecionamento ou uma tela de estado.
 */
export function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    permissions,
    isLoadingPermissions,
    permissionsError,
    signIn,
  } = useAuthContext();
  const [params] = useSearchParams();

  if (isAuthenticated && isLoadingPermissions) return <LoadingScreen />;
  if (isAuthenticated && permissionsError) return <PermissionsLoadError />;
  if (isAuthenticated) {
    return <Navigate to={getLandingRoute(permissions)} replace />;
  }

  const error = params.get('error');
  const description = params.get('error_description');

  return (
    <FullScreen>
      <span className="inline-flex rounded-[10px] bg-white px-3 py-1.5">
        <img src={logoBora} alt="Bora" className="block h-[42px] w-auto" />
      </span>
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="m-0 mb-1 font-bold font-display text-2xl tracking-tight">
          Pauta de marketing
        </h1>
        <p className="m-0 mb-6 text-muted">
          Entre com a sua conta para ver e editar a pauta da equipe.
        </p>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-late-bg p-3 text-late text-sm"
          >
            <p className="m-0 font-semibold">Não foi possível entrar.</p>
            <p className="m-0 break-words">
              {description ? `${error}: ${description}` : error}
            </p>
          </div>
        )}
        <Button
          className="w-full"
          loading={isLoading}
          onClick={() => void signIn()}
        >
          Entrar
        </Button>
      </div>
    </FullScreen>
  );
}

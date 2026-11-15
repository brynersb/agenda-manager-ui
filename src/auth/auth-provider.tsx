import { WebStorageStateStore } from 'oidc-client-ts';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AuthProvider as OidcAuthProvider, useAuth } from 'react-oidc-context';

import { clearSession } from '@/lib/query-client';

/**
 * Configuração do Authorization Code + PKCE contra o Keycloak.
 *
 * O `userStore` é `sessionStorage` de propósito: a sessão morre ao fechar a
 * aba, o que reduz a janela de exposição de um token roubado por XSS. Nenhum
 * token vai para `localStorage`. O `onSigninCallback` limpa `code`/`state` da
 * URL; sem isso o `StrictMode` processaria o callback duas vezes em dev.
 */
const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
  scope: import.meta.env.VITE_OIDC_SCOPE,
  response_type: 'code',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

/**
 * Limpa o cache do TanStack Query quando a sessão termina, por logout
 * explícito ou forçado. Ouvir os eventos do `UserManager` cobre os dois
 * caminhos num lugar só.
 */
function SessionCacheSync() {
  const auth = useAuth();

  useEffect(() => {
    const handleSessionEnded = () => clearSession();

    const unsubscribeUnloaded = auth.events.addUserUnloaded(handleSessionEnded);
    const unsubscribeSignedOut =
      auth.events.addUserSignedOut(handleSessionEnded);

    return () => {
      unsubscribeUnloaded();
      unsubscribeSignedOut();
    };
  }, [auth.events]);

  return null;
}

/**
 * Provedor OIDC da aplicação, com a limpeza de cache ao fim da sessão.
 *
 * @param props.children Árvore que precisa de autenticação.
 * @returns A árvore dentro do contexto do `react-oidc-context`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <OidcAuthProvider {...oidcConfig}>
      <SessionCacheSync />
      {children}
    </OidcAuthProvider>
  );
}

import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  changePassword,
  login,
  logout,
  verifySession,
} from '@/auth/auth-actions';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import {
  getSession,
  refreshSession,
  subscribeSession,
} from '@/auth/session-store';
import type { Permission } from '@/types/auth';

/** Espera antes de tentar de novo uma renovação que falhou por rede ou 5xx. */
const REFRESH_RETRY_MS = 15_000;

const EMPTY_PERMISSIONS: Permission[] = [];

/**
 * Etapas de abertura da página com uma sessão restaurada do `sessionStorage`:
 * renovar o token já vencido, ou reconferir a identidade em `/auth/user-info`.
 * Sem sessão guardada (ou depois de concluir), `ready`.
 */
type Bootstrap =
  | { phase: 'restoring' }
  | { phase: 'verifying' }
  | { phase: 'ready' }
  | { phase: 'error'; error: Error };

function initialBootstrap(): Bootstrap {
  const session = getSession();
  if (!session) return { phase: 'ready' };
  return Date.now() >= session.refreshAt
    ? { phase: 'restoring' }
    : { phase: 'verifying' };
}

/**
 * Provedor da autenticação própria da API (ADR-016).
 *
 * A sessão `{ accessToken, refreshToken, expiresAt, user }` vive no
 * `sessionStorage` (morre ao fechar a aba) e é lida de `session-store`, que
 * também faz a renovação em voo único. Este componente:
 *
 * - restaura a sessão ao carregar a página: renova o token se já passou da hora
 *   de renovar; senão reconfere a identidade em `GET /auth/user-info`;
 * - agenda a renovação do access token antes de ele vencer, para a pessoa nunca
 *   sentir o vencimento;
 * - entrega ao app identidade, permissões (as da sessão, sempre vindas da API)
 *   e as ações de entrar, sair e trocar a senha.
 *
 * @param props.children Árvore que precisa de autenticação.
 * @returns A árvore dentro do contexto de autenticação.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const [bootstrap, setBootstrap] = useState<Bootstrap>(initialBootstrap);

  useEffect(() => {
    const restored = getSession();
    if (!restored) {
      setBootstrap({ phase: 'ready' });
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        if (Date.now() >= restored.refreshAt) {
          await refreshSession();
        } else {
          await verifySession();
        }
        if (!cancelled) setBootstrap({ phase: 'ready' });
      } catch (error) {
        if (cancelled) return;
        // Um 401 sem saída já encerrou a sessão: o guarda leva a /login.
        setBootstrap(
          getSession()
            ? {
                phase: 'error',
                error:
                  error instanceof Error ? error : new Error(String(error)),
              }
            : { phase: 'ready' },
        );
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAt = session?.refreshAt;
  const hasSession = session !== null;

  useEffect(() => {
    if (!hasSession || refreshAt === undefined) return;

    let timer: ReturnType<typeof setTimeout>;
    const renew = () => {
      refreshSession().catch(() => {
        // Falha transitória (rede, 5xx): a sessão continua e tentamos de novo.
        timer = setTimeout(renew, REFRESH_RETRY_MS);
      });
    };
    timer = setTimeout(renew, Math.max(0, refreshAt - Date.now()));

    return () => clearTimeout(timer);
  }, [hasSession, refreshAt]);

  const permissions = session?.user.permissions ?? EMPTY_PERMISSIONS;
  const hasPermission = useCallback(
    (permission: Permission) => permissions.includes(permission),
    [permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      userId: session?.user.id ?? '',
      email: session?.user.email ?? '',
      name: session?.user.name ?? '',
      role: session?.user.role ?? null,
      permissions,
      mustChangePassword: session?.mustChangePassword ?? false,
      isAuthenticated: session !== null,
      isLoading: bootstrap.phase === 'restoring',
      isLoadingPermissions: bootstrap.phase === 'verifying',
      permissionsError: bootstrap.phase === 'error' ? bootstrap.error : null,
      signIn: login,
      signOut: logout,
      changePassword,
      hasPermission,
    }),
    [session, permissions, bootstrap, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

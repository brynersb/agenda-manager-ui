import type { KyInstance } from 'ky';
import ky, { isHTTPError } from 'ky';
import { useCallback, useMemo } from 'react';
import { useAuth } from 'react-oidc-context';

import { ApiError, CODE_MESSAGES, toApiError } from '@/lib/api-error';
import { goToLogin } from '@/lib/navigation';
import { clearSession } from '@/lib/query-client';

/** 401 que persiste depois de renovar o token: a sessão não vale mais. */
export class UnauthorizedApiError extends ApiError {
  constructor() {
    super({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: CODE_MESSAGES.UNAUTHENTICATED,
    });
    this.name = 'UnauthorizedApiError';
  }
}

/** 403: identidade válida sem permissão; a sessão continua de pé. */
export class ForbiddenApiError extends ApiError {
  constructor() {
    super({
      status: 403,
      code: 'FORBIDDEN',
      message: CODE_MESSAGES.FORBIDDEN,
    });
    this.name = 'ForbiddenApiError';
  }
}

interface CreateApiOptions {
  /** Renova o token e devolve o novo access token; `undefined` se falhar. */
  renewToken?: () => Promise<string | undefined>;
  /** Chamado quando o 401 não tem como ser resolvido. */
  onSessionExpired?: () => void;
}

/**
 * Cria o cliente HTTP da API.
 *
 * Envia o access token como Bearer. Num 401 tenta renovar o token uma única
 * vez e repete a chamada; se o 401 persistir, avisa `onSessionExpired`. 403
 * vira `ForbiddenApiError` sem tocar na sessão. Os demais erros HTTP viram
 * `ApiError` com `code` e `fields` do corpo. O retry de rede/5xx fica com o
 * TanStack Query, não com o `ky`.
 *
 * `prefix` exige a barra final na base e caminhos sem barra inicial
 * (`api.get('content-briefs')`).
 *
 * @param getToken Lê o access token vigente a cada requisição.
 * @param options Renovação de token e reação à sessão expirada.
 * @returns A instância do `ky` configurada.
 */
export function createApi(
  getToken: () => string | undefined,
  { renewToken, onSessionExpired }: CreateApiOptions = {},
): KyInstance {
  return ky.create({
    prefix: import.meta.env.VITE_API_BASE_URL,
    retry: {
      limit: 1,
      methods: [],
      statusCodes: [],
    },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          const token = getToken();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async ({ request, response, retryCount }) => {
          if (response.status !== 401 || retryCount > 0 || !renewToken) {
            return;
          }

          const newToken = await renewToken().catch(() => undefined);
          if (!newToken) {
            return;
          }

          const headers = new Headers(request.headers);
          headers.set('Authorization', `Bearer ${newToken}`);

          return ky.retry({
            request: new Request(request, { headers }),
            code: 'TOKEN_REFRESHED',
          });
        },
      ],
      beforeError: [
        ({ error }) => {
          if (!isHTTPError(error)) {
            return error;
          }

          const status = error.response.status;

          if (status === 401) {
            onSessionExpired?.();
            return new UnauthorizedApiError();
          }

          if (status === 403) {
            return new ForbiddenApiError();
          }

          return toApiError(error);
        },
      ],
    },
  });
}

/**
 * Cliente HTTP autenticado para componentes e hooks.
 *
 * Quando o 401 não se resolve com a renovação, remove o usuário do OIDC (não
 * só limpa o cache) e vai para `/login`. Sem o `removeUser`, o token velho
 * continuaria no `sessionStorage` e a rota protegida mandaria a pessoa de
 * volta, num loop `/login` ↔ rota protegida.
 *
 * @returns A instância do `ky` com o token da sessão atual.
 */
export function useApi(): KyInstance {
  const auth = useAuth();
  const accessToken = auth.user?.access_token;

  const renewToken = useCallback(async () => {
    try {
      const user = await auth.signinSilent();
      return user?.access_token;
    } catch {
      return undefined;
    }
  }, [auth.signinSilent]);

  const onSessionExpired = useCallback(() => {
    void Promise.resolve(auth.removeUser()).finally(() => {
      clearSession();
      goToLogin();
    });
  }, [auth.removeUser]);

  return useMemo(
    () =>
      createApi(() => accessToken, {
        renewToken,
        onSessionExpired,
      }),
    [accessToken, renewToken, onSessionExpired],
  );
}

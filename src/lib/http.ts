import type { KyInstance } from 'ky';
import ky, { isHTTPError } from 'ky';

import { ApiError, CODE_MESSAGES, toApiError } from '@/lib/api-error';

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

/** Access token vigente (ou `undefined` sem sessão), possivelmente assíncrono. */
type TokenSource = () => string | undefined | Promise<string | undefined>;

interface CreateApiOptions {
  /**
   * Renova a sessão depois de um 401 e devolve o access token a usar na
   * repetição; `undefined` quando a sessão não tem mais como continuar.
   * Recebe o token que a chamada usou, para quem renova saber se outra
   * chamada já trocou o token. Se lançar, a falha é transitória (rede, 5xx):
   * a chamada original falha com esse erro e a sessão é mantida.
   */
  renewToken?: (failedToken?: string) => Promise<string | undefined>;
  /** Chamado quando o 401 não tem como ser resolvido. */
  onSessionExpired?: () => void;
  /** Chamado no `403 PASSWORD_CHANGE_REQUIRED` (senha provisória pendente). */
  onPasswordChangeRequired?: () => void;
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Cria o cliente HTTP da API.
 *
 * Envia o access token como Bearer. Num 401 tenta renovar o token uma única
 * vez e repete a chamada; se o 401 persistir, avisa `onSessionExpired`. O 403
 * comum vira `ForbiddenApiError` sem tocar na sessão; `403
 * PASSWORD_CHANGE_REQUIRED` avisa `onPasswordChangeRequired`, e os demais
 * códigos de 403 e de 401 (`ACCOUNT_LOCKED`, `INVALID_CREDENTIALS`...) chegam
 * a quem chamou com o `code` da API. Os outros erros HTTP viram `ApiError` com
 * `code` e `fields` do corpo. O retry de rede/5xx fica com o TanStack Query,
 * não com o `ky`.
 *
 * `prefix` exige a barra final na base e caminhos sem barra inicial
 * (`api.get('content-briefs')`).
 *
 * @param getToken Lê o access token vigente a cada requisição.
 * @param options Renovação de token e reação à sessão expirada.
 * @returns A instância do `ky` configurada.
 */
export function createApi(
  getToken: TokenSource,
  {
    renewToken,
    onSessionExpired,
    onPasswordChangeRequired,
  }: CreateApiOptions = {},
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
        async ({ request }) => {
          const token = await getToken();
          if (token) {
            request.headers.set('Authorization', `${BEARER_PREFIX}${token}`);
          }
        },
      ],
      afterResponse: [
        async ({ request, response, retryCount }) => {
          if (response.status !== 401 || retryCount > 0 || !renewToken) {
            return;
          }

          const failedToken = request.headers
            .get('Authorization')
            ?.slice(BEARER_PREFIX.length);
          const newToken = await renewToken(failedToken);
          if (!newToken) {
            return;
          }

          const headers = new Headers(request.headers);
          headers.set('Authorization', `${BEARER_PREFIX}${newToken}`);

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
            const apiError = toApiError(error);
            if (apiError.code && apiError.code !== 'UNAUTHENTICATED') {
              return apiError;
            }
            onSessionExpired?.();
            return new UnauthorizedApiError();
          }

          if (status === 403) {
            const apiError = toApiError(error);
            if (apiError.code === 'PASSWORD_CHANGE_REQUIRED') {
              onPasswordChangeRequired?.();
              return apiError;
            }
            return apiError.code && apiError.code !== 'FORBIDDEN'
              ? apiError
              : new ForbiddenApiError();
          }

          return toApiError(error);
        },
      ],
    },
  });
}

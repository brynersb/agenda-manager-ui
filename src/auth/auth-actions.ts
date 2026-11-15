import {
  endSession,
  getSession,
  startSession,
  updateSessionUser,
} from '@/auth/session-store';
import { createSessionApi } from '@/lib/api';
import { createApi } from '@/lib/http';
import type { AuthResponse, UserInfo } from '@/types/auth';

/** Tempo máximo esperado pelo `POST /auth/logout` antes de sair mesmo assim. */
const LOGOUT_TIMEOUT_MS = 4_000;

/**
 * Entra com e-mail e senha (`POST /auth/login`) e inicia a sessão.
 *
 * Usa um cliente sem renovação: o 401 do login é `INVALID_CREDENTIALS`, não
 * sessão expirada.
 *
 * @param email E-mail digitado (a API ignora caixa e espaços nas pontas).
 * @param password Senha digitada.
 * @throws ApiError com `code` `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`,
 * `USER_DEACTIVATED` ou `TOO_MANY_REQUESTS`; erro de rede sem resposta.
 */
export async function login(email: string, password: string): Promise<void> {
  const response = await createApi(() => undefined)
    .post('auth/login', { json: { email: email.trim(), password } })
    .json<AuthResponse>();
  startSession(response);
}

/**
 * Troca a senha (`POST /auth/change-password`) e passa a usar a sessão nova
 * que a API devolve.
 *
 * A troca revoga todos os refresh tokens do usuário, inclusive o desta sessão,
 * então a resposta traz uma sessão de família nova: os dois tokens guardados
 * são substituídos e a pessoa continua logada, sem passar pelo login.
 *
 * @param currentPassword Senha atual (a provisória, no primeiro acesso).
 * @param newPassword Senha nova (10 a 128 caracteres, diferente da atual).
 * @throws ApiError com `INVALID_CURRENT_PASSWORD`, `WEAK_PASSWORD` ou
 * `TOO_MANY_REQUESTS`.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await createSessionApi()
    .post('auth/change-password', { json: { currentPassword, newPassword } })
    .json<AuthResponse>();
  startSession(response);
}

/**
 * Sai: avisa a API (`POST /auth/logout`, que revoga a família do refresh
 * token) e apaga a sessão local.
 *
 * A falha do aviso (rede, token já vencido) é ignorada de propósito: a sessão
 * local é apagada de qualquer jeito, e o refresh token que sobrar no servidor
 * expira sozinho.
 */
export async function logout(): Promise<void> {
  const session = getSession();
  if (session) {
    try {
      await createApi(() => session.accessToken).post('auth/logout', {
        json: { refreshToken: session.refreshToken },
        timeout: LOGOUT_TIMEOUT_MS,
      });
    } catch {
      // Ver o JSDoc: o logout local não depende da resposta.
    }
  }
  endSession();
}

/**
 * Reconfere a identidade e as permissões de uma sessão restaurada do storage
 * (`GET /auth/user-info`) e atualiza a sessão com a resposta.
 *
 * Um 401 aqui segue o caminho normal do cliente: renova uma vez e, se não der,
 * encerra a sessão.
 *
 * @throws Erro de rede ou da API; a sessão não é alterada nesse caso.
 */
export async function verifySession(): Promise<void> {
  const info = await createSessionApi().get('auth/user-info').json<UserInfo>();
  updateSessionUser(info);
}

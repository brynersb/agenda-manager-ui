import {
  readStoredSession,
  type SessionNotice,
  writeSessionNotice,
  writeStoredSession,
} from '@/auth/session-storage';
import { getErrorStatus } from '@/lib/api-error';
import { createApi } from '@/lib/http';
import { clearSession as clearQueryCache } from '@/lib/query-client';
import type { AuthResponse, AuthSession, UserInfo } from '@/types/auth';

/** Antecedência máxima da renovação: 60 s antes de o access token vencer. */
export const REFRESH_LEAD_MS = 60_000;

/**
 * Margem abaixo da qual o access token já não é enviado: uma chamada que sai
 * com o token a segundos de vencer chegaria à API com ele expirado.
 */
const EXPIRY_SAFETY_MS = 5_000;

/** Status em que o servidor rejeitou o refresh token de vez (sessão perdida). */
const DEFINITIVE_REFRESH_STATUSES = [400, 401, 403];

let current: AuthSession | null = readStoredSession();
let inflightRefresh: Promise<AuthSession | null> | null = null;
const listeners = new Set<() => void>();

function commit(next: AuthSession | null) {
  current = next;
  writeStoredSession(next);
  for (const listener of listeners) listener();
}

/**
 * Monta a sessão a partir da resposta de login, refresh ou troca de senha.
 *
 * A renovação antecipada é de 60 s, limitada a um quarto da validade: com um
 * access token de 1 minuto (útil para testar) uma antecedência fixa de 60 s
 * faria renovar sem parar.
 *
 * @param response Corpo devolvido pela API.
 * @param now Instante de recebimento (injetável nos testes).
 * @returns A sessão com os instantes de vencimento e de renovação.
 */
export function toSession(
  response: AuthResponse,
  now: number = Date.now(),
): AuthSession {
  const lifetimeMs = response.expiresIn * 1000;
  const lead = Math.min(REFRESH_LEAD_MS, lifetimeMs / 4);
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: now + lifetimeMs,
    refreshAt: now + lifetimeMs - lead,
    mustChangePassword: response.mustChangePassword,
    user: response.user,
  };
}

/** @returns A sessão vigente, ou `null` sem login. */
export function getSession(): AuthSession | null {
  return current;
}

/**
 * Observa mudanças da sessão (login, renovação, fim). Compatível com
 * `useSyncExternalStore`.
 *
 * @param listener Chamado a cada mudança.
 * @returns Função que cancela a observação.
 */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Relê a sessão do `sessionStorage` (usado ao montar o app e nos testes).
 */
export function reloadStoredSession(): void {
  inflightRefresh = null;
  commit(readStoredSession());
}

/**
 * Passa a valer a sessão de uma resposta de login, refresh ou troca de senha.
 *
 * @param response Corpo devolvido pela API.
 * @returns A sessão criada.
 */
export function startSession(response: AuthResponse): AuthSession {
  const session = toSession(response);
  writeSessionNotice(null);
  commit(session);
  return session;
}

/**
 * Encerra a sessão local: apaga o storage e o cache de servidor, para que a
 * próxima pessoa a entrar neste navegador não veja dados da anterior. As
 * rotas protegidas observam a sessão e levam a `/login` sozinhas.
 *
 * @param notice Passe `'expired'` quando o encerramento não foi pedido pela
 * pessoa; a tela de login mostra o aviso uma vez.
 */
export function endSession(notice?: SessionNotice): void {
  inflightRefresh = null;
  if (notice) writeSessionNotice(notice);
  commit(null);
  clearQueryCache();
}

/**
 * Atualiza identidade e permissões da sessão (resposta de `user-info`), sem
 * mexer nos tokens.
 *
 * @param user Identidade devolvida pela API.
 */
export function updateSessionUser(user: UserInfo): void {
  if (!current) return;
  commit({ ...current, user });
}

/**
 * Registra que a API exigiu a troca da senha provisória (`403
 * PASSWORD_CHANGE_REQUIRED`), para as rotas protegidas levarem à tela de troca.
 */
export function markPasswordChangeRequired(): void {
  if (!current || current.mustChangePassword) return;
  commit({ ...current, mustChangePassword: true });
}

/**
 * Renova a sessão com o refresh token (`POST /auth/refresh`).
 *
 * **Voo único.** O refresh token é de uso único e reapresentar um já usado
 * derruba a família de sessões inteira; por isso todas as chamadas que
 * precisam renovar ao mesmo tempo (várias requisições com 401, o relógio de
 * renovação antecipada) compartilham a mesma promessa e uma só chamada à API.
 * O token novo é gravado antes de a promessa resolver.
 *
 * Falha definitiva (a API recusou o refresh token: 400, 401 ou 403) encerra a
 * sessão e resolve `null`. Falha transitória (rede, 5xx, 429) mantém a sessão e
 * rejeita, para quem chamou tentar de novo depois sem forçar um novo login.
 *
 * @returns A sessão nova, ou `null` se a sessão terminou.
 * @throws Erro de rede ou 5xx da API (a sessão continua válida).
 */
export function refreshSession(): Promise<AuthSession | null> {
  if (inflightRefresh) return inflightRefresh;

  const started = current;
  if (!started) return Promise.resolve(null);

  const flight: Promise<AuthSession | null> = performRefresh(started).finally(
    () => {
      if (inflightRefresh === flight) inflightRefresh = null;
    },
  );
  inflightRefresh = flight;
  return flight;
}

/** Uma ida a `POST /auth/refresh` e a gravação do resultado. */
async function performRefresh(
  started: AuthSession,
): Promise<AuthSession | null> {
  try {
    const response = await createApi(() => undefined)
      .post('auth/refresh', { json: { refreshToken: started.refreshToken } })
      .json<AuthResponse>();

    // Logout ou novo login durante o voo: o resultado já não pertence a esta
    // sessão e não pode ressuscitá-la.
    if (current?.refreshToken !== started.refreshToken) return current;
    return startSession(response);
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== undefined && DEFINITIVE_REFRESH_STATUSES.includes(status)) {
      if (current?.refreshToken === started.refreshToken) {
        endSession('expired');
      }
      return null;
    }
    throw error;
  }
}

/**
 * Access token a enviar agora. Se ele vence em segundos (ou já venceu, como
 * depois de o computador dormir e o relógio de renovação atrasar), renova antes
 * em vez de gastar uma ida à API com um 401 certo.
 *
 * @returns O token, ou `undefined` sem sessão. Se a renovação falhar de forma
 * transitória, devolve o token atual e deixa o 401 (se vier) tentar de novo.
 */
export async function getFreshAccessToken(): Promise<string | undefined> {
  const session = current;
  if (!session) return undefined;

  if (session.expiresAt - Date.now() > EXPIRY_SAFETY_MS) {
    return session.accessToken;
  }

  try {
    const renewed = await refreshSession();
    return renewed?.accessToken;
  } catch {
    return session.accessToken;
  }
}

/**
 * Resolve um 401: devolve o token com que a chamada deve ser repetida.
 *
 * Se outra chamada já renovou (o token vigente não é mais o que falhou), basta
 * repetir com o vigente, sem gastar outro refresh token.
 *
 * @param failedToken Token com que a chamada falhou.
 * @returns O token para repetir, ou `undefined` se a sessão terminou.
 * @throws Erro transitório da renovação (rede, 5xx): a sessão é mantida.
 */
export async function renewAfterUnauthorized(
  failedToken?: string,
): Promise<string | undefined> {
  const session = current;
  if (!session) return undefined;
  if (failedToken && session.accessToken !== failedToken) {
    return session.accessToken;
  }
  const renewed = await refreshSession();
  return renewed?.accessToken;
}

import type { AuthSession, Permission, Role } from '@/types/auth';

/** Chave do `sessionStorage`; o sufixo de versão permite mudar o formato. */
export const SESSION_KEY = 'pauta-mkt:session:v1';

const ROLES: readonly Role[] = [
  'admin',
  'content-brief-editor',
  'content-brief-viewer',
];

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

/**
 * Confere o formato de uma sessão lida do storage. Um valor adulterado ou de
 * versão antiga não pode derrubar a tela: vira "sem sessão".
 */
function isSession(data: unknown): data is AuthSession {
  if (typeof data !== 'object' || data === null) return false;
  const s = data as Record<string, unknown>;
  const user = s.user as Record<string, unknown> | null | undefined;

  return (
    isString(s.accessToken) &&
    isString(s.refreshToken) &&
    typeof s.expiresAt === 'number' &&
    typeof s.refreshAt === 'number' &&
    typeof s.mustChangePassword === 'boolean' &&
    typeof user === 'object' &&
    user !== null &&
    isString(user.id) &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    isRole(user.role) &&
    Array.isArray(user.permissions) &&
    user.permissions.every((p) => typeof p === 'string')
  );
}

/**
 * Lê a sessão guardada, tolerando storage indisponível, JSON inválido e
 * formato desconhecido.
 *
 * @returns A sessão, ou `null` quando não há uma utilizável.
 */
export function readStoredSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (!isSession(data)) return null;
    return {
      ...data,
      user: {
        ...data.user,
        permissions: data.user.permissions as Permission[],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Grava (ou apaga, com `null`) a sessão no `sessionStorage`, que morre ao
 * fechar a aba. Nunca `localStorage`: o token não deve sobreviver ao fim da
 * visita nem ficar legível por outra aba aberta depois.
 *
 * @param session Sessão a guardar, ou `null` para apagar.
 */
export function writeStoredSession(session: AuthSession | null): void {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage bloqueado ou cheio: a sessão vale só até recarregar a página.
  }
}

/** Chave do aviso "sua sessão expirou", lido uma vez pela tela de login. */
export const SESSION_NOTICE_KEY = 'pauta-mkt:session-notice:v1';

/** Aviso a mostrar no login depois que a sessão terminou sem a pessoa pedir. */
export type SessionNotice = 'expired';

/**
 * Lê o aviso deixado por um encerramento forçado da sessão.
 *
 * @returns O aviso, ou `null` quando não há (ou o storage está bloqueado).
 */
export function readSessionNotice(): SessionNotice | null {
  try {
    return window.sessionStorage.getItem(SESSION_NOTICE_KEY) === 'expired'
      ? 'expired'
      : null;
  } catch {
    return null;
  }
}

/**
 * Grava (ou apaga, com `null`) o aviso de sessão encerrada.
 *
 * @param notice Aviso a deixar para a tela de login, ou `null` para apagar.
 */
export function writeSessionNotice(notice: SessionNotice | null): void {
  try {
    if (notice) {
      window.sessionStorage.setItem(SESSION_NOTICE_KEY, notice);
    } else {
      window.sessionStorage.removeItem(SESSION_NOTICE_KEY);
    }
  } catch {
    // Sem storage o aviso só deixa de aparecer.
  }
}

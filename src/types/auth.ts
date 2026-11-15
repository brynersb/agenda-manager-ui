/**
 * Papéis de um usuário (um por pessoa). O mapa papel → permissão vive só na
 * API; no front o papel serve apenas de rótulo.
 */
export type Role = 'admin' | 'content-brief-editor' | 'content-brief-viewer';

/** Permissões resolvidas pela API (login, refresh e `GET /auth/user-info`). */
export type Permission =
  | 'content-brief:read'
  | 'content-brief:write'
  | 'content-brief:delete'
  | 'registry:read'
  | 'registry:write'
  | 'user:read'
  | 'user:write';

/** Identidade e permissões da pessoa logada (`GET /auth/user-info`). */
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

/**
 * Resposta de `POST /auth/login`, `/auth/refresh` e `/auth/change-password`
 * (as três têm o mesmo formato, `docs/auth.md` da API).
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  /** Validade do access token, em segundos. */
  expiresIn: number;
  /** `true` enquanto a senha é provisória: a API só libera a troca de senha. */
  mustChangePassword: boolean;
  user: UserInfo;
}

/**
 * Sessão guardada no `sessionStorage`.
 *
 * `expiresAt` e `refreshAt` são instantes em milissegundos (`Date.now()`):
 * quando o access token vence e quando convém renová-lo antes disso.
 */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshAt: number;
  mustChangePassword: boolean;
  user: UserInfo;
}

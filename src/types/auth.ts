/** Papéis do realm Keycloak; o mapa papel → permissão vive só na API. */
export type Role = 'content-brief-editor' | 'content-brief-viewer';

/** Permissões resolvidas pela API em `GET /auth/user-info`. */
export type Permission =
  | 'content-brief:read'
  | 'content-brief:write'
  | 'content-brief:delete'
  | 'registry:read'
  | 'registry:write';

/** Resposta de `GET /auth/user-info` (contrato §5.1 do plan técnico). */
export interface UserInfo {
  sub: string;
  name: string;
  email: string | null;
  roles: Role[];
  permissions: Permission[];
}

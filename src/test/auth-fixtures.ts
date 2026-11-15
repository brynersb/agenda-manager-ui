import type { AuthResponse, UserInfo } from '@/types/auth';

/** Corpo de resposta da API simulado (`Response` JSON). */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Identidade de editor, como a API a devolve em login, refresh e user-info. */
export const EDITOR_INFO: UserInfo = {
  id: 'user-1',
  email: 'dev.editor@pauta.local',
  name: 'Dev Editor',
  role: 'content-brief-editor',
  permissions: [
    'content-brief:read',
    'content-brief:write',
    'content-brief:delete',
    'registry:read',
    'registry:write',
  ],
};

/** Identidade de administrador (todas as permissões). */
export const ADMIN_INFO: UserInfo = {
  id: 'admin-1',
  email: 'dev.admin@pauta.local',
  name: 'Dev Admin',
  role: 'admin',
  permissions: [...EDITOR_INFO.permissions, 'user:read', 'user:write'],
};

/**
 * Resposta de login/refresh/troca de senha simulada.
 *
 * @param overrides Campos que diferem do padrão (editor, 15 min).
 * @returns O corpo no formato do contrato.
 */
export function authResponse(
  overrides: Partial<AuthResponse> = {},
): AuthResponse {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresIn: 900,
    mustChangePassword: false,
    user: EDITOR_INFO,
    ...overrides,
  };
}

import { vi } from 'vitest';

import type { AuthContextValue } from '@/auth/auth-context';

/**
 * Valor completo de `useAuthContext` para testes: pessoa autenticada com
 * permissões de editor. Passe `overrides` para o cenário desejado.
 *
 * Uso: o arquivo de teste declara `vi.mock('@/auth/use-auth')` e faz
 * `vi.mocked(useAuthContext).mockReturnValue(createAuthMock({...}))`.
 *
 * @param overrides Campos que diferem do padrão.
 * @returns O contexto de auth simulado.
 */
export function createAuthMock(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  const permissions = overrides.permissions ?? [
    'content-brief:read',
    'content-brief:write',
    'content-brief:delete',
    'registry:read',
    'registry:write',
  ];

  return {
    userId: 'user-1',
    email: 'dev.editor@bora.test',
    name: 'Dev Editor',
    role: 'content-brief-editor',
    permissions,
    mustChangePassword: false,
    isAuthenticated: true,
    isLoading: false,
    isLoadingPermissions: false,
    permissionsError: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    hasPermission: (permission) => permissions.includes(permission),
    ...overrides,
  };
}

import { vi } from 'vitest';

import type { useAuthContext } from '@/auth/use-auth';

type AuthContextValue = ReturnType<typeof useAuthContext>;

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
    sub: 'user-1',
    email: 'dev.editor@bora.test',
    name: 'Dev Editor',
    roles: ['content-brief-editor'],
    permissions,
    isAuthenticated: true,
    isLoading: false,
    isLoadingPermissions: false,
    permissionsError: null,
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    hasPermission: (permission) => permissions.includes(permission),
    ...overrides,
  };
}

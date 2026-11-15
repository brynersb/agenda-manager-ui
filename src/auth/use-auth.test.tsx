import { renderHook } from '@testing-library/react';
import { useAuth } from 'react-oidc-context';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-oidc-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/auth/use-auth-user-info', () => ({
  useAuthUserInfo: vi.fn(),
}));

import { useAuthUserInfo } from '@/auth/use-auth-user-info';
import { useAuthContext } from './use-auth';

const mockUseAuth = useAuth as Mock;
const mockUseAuthUserInfo = useAuthUserInfo as Mock;

const SEM_DADOS = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
};

function sessao(profile: Record<string, unknown> | null) {
  return {
    isAuthenticated: profile !== null,
    isLoading: false,
    user: profile ? { access_token: 'token', profile } : null,
    signinRedirect: vi.fn().mockResolvedValue(undefined),
    signoutRedirect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('useAuthContext', () => {
  it('mantém referências estáveis quando as permissões ainda não foram carregadas', () => {
    mockUseAuth.mockReturnValue(sessao(null));
    mockUseAuthUserInfo.mockReturnValue(SEM_DADOS);

    const { result, rerender } = renderHook(() => useAuthContext());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.permissions).toBe(first.permissions);
    expect(result.current.hasPermission).toBe(first.hasPermission);
  });

  it('decide acesso só pelas permissoes de /auth/user-info, não pelos papéis do token', () => {
    mockUseAuth.mockReturnValue(
      sessao({
        sub: 'u1',
        realm_access: { roles: ['content-brief-editor'] },
      }),
    );
    mockUseAuthUserInfo.mockReturnValue({
      ...SEM_DADOS,
      data: {
        sub: 'u1',
        name: 'Dev',
        email: null,
        roles: [],
        permissions: [],
      },
    });

    const { result } = renderHook(() => useAuthContext());

    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission('content-brief:read')).toBe(false);
  });

  it('expõe nome, e-mail, papéis e permissões vindos da API', () => {
    mockUseAuth.mockReturnValue(sessao({ sub: 'u1', name: 'Nome do token' }));
    mockUseAuthUserInfo.mockReturnValue({
      ...SEM_DADOS,
      data: {
        sub: 'u1',
        name: 'Dev Editor',
        email: 'dev.editor@bora.test',
        roles: ['content-brief-editor'],
        permissions: ['content-brief:read', 'content-brief:write'],
      },
    });

    const { result } = renderHook(() => useAuthContext());

    expect(result.current.name).toBe('Dev Editor');
    expect(result.current.email).toBe('dev.editor@bora.test');
    expect(result.current.roles).toEqual(['content-brief-editor']);
    expect(result.current.hasPermission('content-brief:write')).toBe(true);
    expect(result.current.hasPermission('content-brief:delete')).toBe(false);
  });

  it('antes da API responder, usa nome e papéis do token (realm_access.roles)', () => {
    mockUseAuth.mockReturnValue(
      sessao({
        sub: 'u1',
        name: 'Nome do token',
        realm_access: { roles: ['content-brief-viewer', 'offline_access'] },
      }),
    );
    mockUseAuthUserInfo.mockReturnValue(SEM_DADOS);

    const { result } = renderHook(() => useAuthContext());

    expect(result.current.name).toBe('Nome do token');
    expect(result.current.roles).toEqual(['content-brief-viewer']);
  });

  it('entra e sai pelo redirect do OIDC', async () => {
    const oidc = sessao({ sub: 'u1' });
    mockUseAuth.mockReturnValue(oidc);
    mockUseAuthUserInfo.mockReturnValue(SEM_DADOS);

    const { result } = renderHook(() => useAuthContext());
    await result.current.signIn();
    await result.current.signOut();

    expect(oidc.signinRedirect).toHaveBeenCalledTimes(1);
    expect(oidc.signoutRedirect).toHaveBeenCalledTimes(1);
  });
});

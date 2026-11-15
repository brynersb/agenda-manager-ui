import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from 'react-oidc-context';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-oidc-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/navigation', () => ({
  goToLogin: vi.fn(),
}));

import { useApi } from './api';
import { goToLogin } from './navigation';

const mockUseAuth = useAuth as Mock;

function emptyResponse(status: number) {
  return new Response(null, { status });
}

describe('useApi — encerramento de sessão', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.mocked(goToLogin).mockClear();
  });

  it('remove o usuário do OIDC e vai para /login quando o 401 persiste após renovar o token', async () => {
    const mockFetch = vi.fn().mockResolvedValue(emptyResponse(401));
    vi.stubGlobal('fetch', mockFetch);

    const removeUser = vi.fn().mockResolvedValue(undefined);
    const signinSilent = vi.fn().mockResolvedValue({
      access_token: 'new-token',
    });

    mockUseAuth.mockReturnValue({
      user: { access_token: 'old-token' },
      signinSilent,
      removeUser,
    });

    const { result } = renderHook(() => useApi());

    await expect(result.current.get('foo')).rejects.toThrow();

    await waitFor(() => expect(goToLogin).toHaveBeenCalledTimes(1));
    expect(removeUser).toHaveBeenCalledTimes(1);
    expect(signinSilent).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('mantém a sessão quando a renovação resolve o 401', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', mockFetch);

    const removeUser = vi.fn();
    const signinSilent = vi.fn().mockResolvedValue({
      access_token: 'new-token',
    });

    mockUseAuth.mockReturnValue({
      user: { access_token: 'old-token' },
      signinSilent,
      removeUser,
    });

    const { result } = renderHook(() => useApi());

    const data = await result.current.get('foo').json();

    expect(data).toEqual({ ok: true });
    expect(removeUser).not.toHaveBeenCalled();
    expect(goToLogin).not.toHaveBeenCalled();
  });

  it('usa o token do render atual depois que o token da sessão muda', async () => {
    const mockFetch = vi.fn().mockResolvedValue(emptyResponse(200));
    vi.stubGlobal('fetch', mockFetch);

    let token = 'old-token';
    mockUseAuth.mockImplementation(() => ({
      user: { access_token: token },
      signinSilent: vi.fn().mockResolvedValue({ access_token: 'renewed' }),
      removeUser: vi.fn(),
    }));

    const { result, rerender } = renderHook(() => useApi());

    await result.current.get('before-change');
    token = 'new-token';
    rerender();
    await result.current.get('after-change');

    expect(
      (mockFetch.mock.calls[0][0] as Request).headers.get('Authorization'),
    ).toBe('Bearer old-token');
    expect(
      (mockFetch.mock.calls[1][0] as Request).headers.get('Authorization'),
    ).toBe('Bearer new-token');
  });
});

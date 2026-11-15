import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@/auth/use-auth');

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { renderWithProviders } from '@/test/render-with-providers';
import { AuthCallback } from './auth-callback';

function renderCallback(
  auth: Parameters<typeof renderWithProviders>[1],
  search = '',
) {
  window.history.pushState({}, '', `/auth/callback${search}`);
  return renderWithProviders(<AuthCallback />, {
    ...auth,
    route: `/auth/callback${search}`,
  });
}

describe('<AuthCallback />', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    mockNavigate.mockClear();
  });

  it('repassa o erro do provedor para /login, onde a mensagem aparece', async () => {
    renderCallback(
      { auth: { isAuthenticated: false } },
      '?error=access_denied&error_description=Usuario%20bloqueado',
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/login?error=access_denied&error_description=Usuario+bloqueado',
        { replace: true },
      ),
    );
  });

  it('não navega enquanto a sessão ou as permissões carregam', async () => {
    renderCallback({ auth: { isLoadingPermissions: true, permissions: [] } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('vai para /content-briefs quando a pessoa pode ler pautas', async () => {
    renderCallback({ auth: { permissions: ['content-brief:read'] } });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/content-briefs', {
        replace: true,
      }),
    );
  });

  it('vai para /no-permission quando /auth/user-info não traz permissões', async () => {
    renderCallback({ auth: { permissions: [] } });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/no-permission', {
        replace: true,
      }),
    );
  });

  it('vai para /login quando não há sessão', async () => {
    renderCallback({ auth: { isAuthenticated: false, permissions: [] } });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }),
    );
  });

  it('mostra a tela de recarregar, sem navegar, quando /auth/user-info falha', async () => {
    renderCallback({
      auth: { permissions: [], permissionsError: new Error('falhou') },
    });

    expect(
      await screen.findByText('Erro ao carregar permissões'),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

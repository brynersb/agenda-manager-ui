import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { renderWithProviders } from '@/test/render-with-providers';
import { LoginPage } from './login-page';

function renderLogin(
  auth: Parameters<typeof renderWithProviders>[1],
  route = '/login',
) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/content-briefs" element={<div>Lista de pautas</div>} />
      <Route path="/no-permission" element={<div>Sem acesso</div>} />
    </Routes>,
    { ...auth, route },
  );
}

describe('<LoginPage />', () => {
  it('inicia o login no Keycloak ao clicar em "Entrar"', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    renderLogin({ auth: { isAuthenticated: false, signIn } });

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('mostra o erro devolvido pelo provedor no callback', () => {
    renderLogin(
      { auth: { isAuthenticated: false } },
      '/login?error=access_denied&error_description=Usuario%20bloqueado',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'access_denied: Usuario bloqueado',
    );
  });

  it('não mostra aviso de erro numa visita normal', () => {
    renderLogin({ auth: { isAuthenticated: false } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leva quem já tem sessão e acesso para /content-briefs', () => {
    renderLogin({ auth: { permissions: ['content-brief:read'] } });

    expect(screen.getByText('Lista de pautas')).toBeInTheDocument();
  });

  it('mostra a tela de recarregar quando /auth/user-info falha com sessão ativa', () => {
    renderLogin({
      auth: { permissions: [], permissionsError: new Error('falhou') },
    });

    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();
  });
});

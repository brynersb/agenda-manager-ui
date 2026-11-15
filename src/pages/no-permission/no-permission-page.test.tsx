import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { renderWithProviders } from '@/test/render-with-providers';
import { NoPermissionPage } from './no-permission-page';

function renderPagina(auth: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route path="/no-permission" element={<NoPermissionPage />} />
      <Route path="/login" element={<div>Tela de login</div>} />
      <Route path="/content-briefs" element={<div>Lista de pautas</div>} />
      <Route path="/change-password" element={<div>Troca de senha</div>} />
    </Routes>,
    { ...auth, route: '/no-permission' },
  );
}

describe('<SemPermissaoPage />', () => {
  it('explica que falta acesso e permite sair', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderPagina({ auth: { permissions: [], signOut } });

    expect(
      screen.getByText(
        'Sua conta ainda não tem acesso à pauta. Peça acesso a quem administra o sistema.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('manda para /login quem não tem sessão', () => {
    renderPagina({ auth: { isAuthenticated: false, permissions: [] } });

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('manda para /content-briefs quem na verdade tem acesso', () => {
    renderPagina({ auth: { permissions: ['content-brief:read'] } });

    expect(screen.getByText('Lista de pautas')).toBeInTheDocument();
  });

  it('manda para a troca de senha quem está com senha provisória', () => {
    renderPagina({ auth: { permissions: [], mustChangePassword: true } });

    expect(screen.getByText('Troca de senha')).toBeInTheDocument();
  });
});

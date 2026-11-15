import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { renderWithProviders } from '@/test/render-with-providers';
import { ProtectedRoute } from './protected-route';

function renderProtected(auth: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div>Conteúdo protegido</div>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<div>Tela de login</div>} />
      <Route path="/no-permission" element={<div>Sem acesso</div>} />
      <Route path="/change-password" element={<div>Troca de senha</div>} />
    </Routes>,
    auth,
  );
}

describe('<ProtectedRoute />', () => {
  it('mostra o carregando enquanto a sessão guardada é restaurada', () => {
    renderProtected({ auth: { isLoading: true, isAuthenticated: false } });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('manda para /login quem não está autenticado', () => {
    renderProtected({ auth: { isAuthenticated: false } });

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('mostra o carregando enquanto as permissões carregam', () => {
    renderProtected({ auth: { isLoadingPermissions: true, permissions: [] } });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Sem acesso')).not.toBeInTheDocument();
  });

  it('manda para /no-permission quem está autenticado sem nenhuma permissão', () => {
    renderProtected({ auth: { permissions: [] } });

    expect(screen.getByText('Sem acesso')).toBeInTheDocument();
  });

  it('manda para /change-password quem está com senha provisória, mesmo com permissões', () => {
    renderProtected({
      auth: { permissions: ['content-brief:read'], mustChangePassword: true },
    });

    expect(screen.getByText('Troca de senha')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('a senha provisória vem antes do "sem permissão"', () => {
    renderProtected({ auth: { permissions: [], mustChangePassword: true } });

    expect(screen.getByText('Troca de senha')).toBeInTheDocument();
  });

  it('mostra a tela de recarregar, e não "sem permissão", quando a reconferência da sessão falha', () => {
    renderProtected({
      auth: { permissions: [], permissionsError: new Error('falhou') },
    });

    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recarregar' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Sem acesso')).not.toBeInTheDocument();
  });

  it('mostra o conteúdo a quem tem permissões', () => {
    renderProtected({ auth: { permissions: ['content-brief:read'] } });

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });
});

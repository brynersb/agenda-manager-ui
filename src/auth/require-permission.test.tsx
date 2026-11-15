import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { renderWithProviders } from '@/test/render-with-providers';
import { RequirePermission } from './require-permission';

function renderGuarded(permissions: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/content-briefs/nova"
        element={
          <RequirePermission permission="content-brief:write">
            <div>Editor</div>
          </RequirePermission>
        }
      />
      <Route path="/content-briefs" element={<div>Lista de pautas</div>} />
      <Route path="/no-permission" element={<div>Sem acesso</div>} />
    </Routes>,
    { ...permissions, route: '/content-briefs/nova' },
  );
}

describe('<RequirePermission />', () => {
  it('mostra o conteúdo a quem tem a permissão exigida', () => {
    renderGuarded({
      auth: { permissions: ['content-brief:read', 'content-brief:write'] },
    });

    expect(screen.getByText('Editor')).toBeInTheDocument();
  });

  it('manda quem só lê para a lista de pautas', () => {
    renderGuarded({ auth: { permissions: ['content-brief:read'] } });

    expect(screen.queryByText('Editor')).not.toBeInTheDocument();
    expect(screen.getByText('Lista de pautas')).toBeInTheDocument();
  });

  it('manda quem não tem acesso a nada para /no-permission, sem laço', () => {
    renderGuarded({ auth: { permissions: [] } });

    expect(screen.getByText('Sem acesso')).toBeInTheDocument();
  });

  it('barra /users de quem não tem user:read e o leva à tela que lhe cabe', () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/users"
          element={
            <RequirePermission permission="user:read">
              <div>Lista de usuários</div>
            </RequirePermission>
          }
        />
        <Route path="/content-briefs" element={<div>Lista de pautas</div>} />
      </Routes>,
      {
        auth: { permissions: ['content-brief:read', 'content-brief:write'] },
        route: '/users',
      },
    );

    expect(screen.queryByText('Lista de usuários')).not.toBeInTheDocument();
    expect(screen.getByText('Lista de pautas')).toBeInTheDocument();
  });
});

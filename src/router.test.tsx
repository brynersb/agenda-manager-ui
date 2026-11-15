import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useApi: vi.fn(),
}));

import { useApi } from '@/lib/api';
import { renderRoutes } from '@/test/render-with-providers';
import { appRoutes } from './router';

const RESUMO_VAZIO = {
  today: '2026-11-14',
  total: 0,
  byDueStatus: {},
  byStatus: {},
};

describe('rotas da aplicação', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReturnValue({
      get: () => ({ json: async () => RESUMO_VAZIO }),
    } as unknown as ReturnType<typeof useApi>);
  });

  it('redireciona / para /content-briefs para quem pode ler pautas', async () => {
    const { router } = renderRoutes(appRoutes, {
      route: '/',
      auth: { permissions: ['content-brief:read'] },
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/content-briefs'),
    );
    expect(
      screen.getByRole('heading', { name: /Pauta de marketing/ }),
    ).toBeInTheDocument();
  });

  it('manda quem tem permissoes vazias para /no-permission', async () => {
    const { router } = renderRoutes(appRoutes, {
      route: '/',
      auth: { permissions: [] },
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/no-permission'),
    );
    expect(
      screen.getByText(/Sua conta ainda não tem acesso/),
    ).toBeInTheDocument();
  });

  it('manda quem não tem sessão para /login ao abrir /content-briefs', async () => {
    const { router } = renderRoutes(appRoutes, {
      route: '/content-briefs',
      auth: { isAuthenticated: false, permissions: [] },
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('mostra a tela de recarregar, e não /no-permission, quando /auth/user-info falha', () => {
    const { router } = renderRoutes(appRoutes, {
      route: '/content-briefs',
      auth: { permissions: [], permissionsError: new Error('falhou') },
    });

    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/content-briefs');
  });

  it('mostra "não encontrada" para rota desconhecida', () => {
    renderRoutes(appRoutes, {
      route: '/nao-existe',
      auth: { permissions: ['content-brief:read'] },
    });

    expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
  });
});

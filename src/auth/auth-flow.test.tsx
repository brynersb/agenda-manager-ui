import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/auth-provider';
import {
  getSession,
  reloadStoredSession,
  startSession,
} from '@/auth/session-store';
import { queryClient } from '@/lib/query-client';
import { appRoutes } from '@/router';
import { ADMIN_INFO, authResponse, jsonResponse } from '@/test/auth-fixtures';

/**
 * Fluxos de ponta a ponta do front (provedor, store, cliente HTTP, rotas e
 * telas reais), só com o `fetch` simulado: o que a pessoa vê em cada situação
 * descrita em `docs/auth.md` da API.
 */

const RESUMO_VAZIO = {
  today: '2026-11-14',
  total: 0,
  byDueStatus: {},
  byStatus: {},
};
const PAGINA_VAZIA = { data: [], total: 0, page: 1, limit: 50 };

type Rota = (corpo: unknown, path: string) => Response | Promise<Response>;

function simularApi(rotas: Record<string, Rota>) {
  const chamadas: { path: string; authorization: string | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/v1/', '');
      chamadas.push({
        path,
        authorization: request.headers.get('Authorization'),
      });
      const texto = await request.clone().text();
      const corpo = texto ? JSON.parse(texto) : undefined;
      const rota = rotas[path];
      if (rota) return rota(corpo, path);
      if (path === 'content-briefs/summary') return jsonResponse(RESUMO_VAZIO);
      if (path.startsWith('content-briefs')) return jsonResponse(PAGINA_VAZIA);
      if (
        path.startsWith('registries') ||
        path === 'owners' ||
        path === 'estate-developments'
      ) {
        return jsonResponse([]);
      }
      throw new Error(`rota não simulada: ${path}`);
    }),
  );
  return chamadas;
}

function montar(route: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [route] });
  render(
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>,
  );
  return router;
}

describe('fluxos de autenticação', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1/');
    window.sessionStorage.clear();
    reloadStoredSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
    queryClient.clear();
  });

  it('login do editor leva às pautas e o menu não oferece "Usuários"', async () => {
    simularApi({ 'auth/login': () => jsonResponse(authResponse()) });
    const router = montar('/login');

    await userEvent.type(
      screen.getByLabelText('E-mail'),
      'dev.editor@pauta.local',
    );
    await userEvent.type(
      screen.getByLabelText('Senha'),
      'dev-only-pauta-2026{Enter}',
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/content-briefs'),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Menu do usuário' }),
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Alterar senha' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Usuários' })).toBeNull();
  });

  it('login do admin oferece "Usuários" no menu e abre a administração', async () => {
    simularApi({
      'auth/login': () => jsonResponse(authResponse({ user: ADMIN_INFO })),
      users: () => jsonResponse({ data: [], total: 0, page: 1, limit: 20 }),
    });
    const router = montar('/login');

    await userEvent.type(
      screen.getByLabelText('E-mail'),
      'dev.admin@pauta.local',
    );
    await userEvent.type(
      screen.getByLabelText('Senha'),
      'dev-only-pauta-2026{Enter}',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Menu do usuário' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Usuários' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/users'));
    expect(
      await screen.findByRole('heading', { name: 'Usuários' }),
    ).toBeInTheDocument();
  });

  it('senha provisória: login → troca forçada → sessão nova → acesso normal', async () => {
    const chamadas = simularApi({
      'auth/login': () =>
        jsonResponse(
          authResponse({
            accessToken: 'restrito',
            refreshToken: 'r1',
            mustChangePassword: true,
          }),
        ),
      'auth/change-password': (corpo) => {
        expect(corpo).toEqual({
          currentPassword: 'provisoria-123',
          newPassword: 'minha-senha-nova',
        });
        return jsonResponse(
          authResponse({ accessToken: 'pleno', refreshToken: 'r2' }),
        );
      },
    });
    const router = montar('/login');

    await userEvent.type(
      screen.getByLabelText('E-mail'),
      'nova.pessoa@pauta.local',
    );
    await userEvent.type(
      screen.getByLabelText('Senha'),
      'provisoria-123{Enter}',
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/change-password'),
    );
    // Enquanto a senha é provisória nenhuma rota de negócio é consultada.
    expect(chamadas.some((c) => c.path.startsWith('content-briefs'))).toBe(
      false,
    );

    await userEvent.type(
      screen.getByLabelText('Senha atual'),
      'provisoria-123',
    );
    await userEvent.type(
      screen.getByLabelText('Nova senha'),
      'minha-senha-nova',
    );
    await userEvent.type(
      screen.getByLabelText('Confirmar nova senha'),
      'minha-senha-nova',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Salvar nova senha' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/content-briefs'),
    );
    expect(getSession()).toMatchObject({
      accessToken: 'pleno',
      refreshToken: 'r2',
      mustChangePassword: false,
    });
    await waitFor(() =>
      expect(chamadas.some((c) => c.path.startsWith('content-briefs'))).toBe(
        true,
      ),
    );
    const aposTroca = chamadas.filter((c) =>
      c.path.startsWith('content-briefs'),
    );
    expect(aposTroca.every((c) => c.authorization === 'Bearer pleno')).toBe(
      true,
    );
  });

  it('403 PASSWORD_CHANGE_REQUIRED em qualquer chamada leva à troca de senha, sem encerrar a sessão', async () => {
    startSession(authResponse());
    simularApi({
      'auth/user-info': () => jsonResponse(authResponse().user),
      'content-briefs/summary': () =>
        jsonResponse(
          { statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'x' },
          403,
        ),
    });

    const router = montar('/content-briefs');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/change-password'),
    );
    expect(getSession()?.mustChangePassword).toBe(true);
  });

  it('sessão que não renova: vai para /login com o aviso de sessão expirada', async () => {
    startSession(authResponse({ accessToken: 'velho' }));
    simularApi({
      'auth/user-info': () => jsonResponse(authResponse().user),
      'content-briefs/summary': () =>
        jsonResponse({ statusCode: 401, code: 'UNAUTHENTICATED' }, 401),
      'auth/refresh': () =>
        jsonResponse({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' }, 401),
    });

    const router = montar('/content-briefs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(getSession()).toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sua sessão expirou. Entre de novo.',
    );
  });

  it('sair pelo menu pede confirmação, avisa a API, limpa a sessão e volta ao login', async () => {
    startSession(authResponse({ refreshToken: 'rf' }));
    const chamadas = simularApi({
      'auth/user-info': () => jsonResponse(authResponse().user),
      'auth/logout': (corpo) => {
        expect(corpo).toEqual({ refreshToken: 'rf' });
        return new Response(null, { status: 204 });
      },
    });
    const router = montar('/content-briefs');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Menu do usuário' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );
    const dialogo = await screen.findByRole('dialog', {
      name: 'Sair da pauta?',
    });
    await userEvent.click(
      within(dialogo).getByRole('button', { name: 'Sair' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(chamadas.some((c) => c.path === 'auth/logout')).toBe(true);
    expect(getSession()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('abrir /users sem user:read volta para as pautas', async () => {
    startSession(authResponse());
    simularApi({ 'auth/user-info': () => jsonResponse(authResponse().user) });

    const router = montar('/users');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/content-briefs'),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_KEY } from '@/auth/session-storage';
import {
  getSession,
  reloadStoredSession,
  startSession,
} from '@/auth/session-store';
import { ApiError } from '@/lib/api-error';
import { ADMIN_INFO, authResponse, jsonResponse } from '@/test/auth-fixtures';
import { changePassword, login, logout, verifySession } from './auth-actions';

interface Chamada {
  path: string;
  authorization: string | null;
  body: unknown;
}

function simularApi(
  rotas: Record<string, (chamada: Chamada) => Response | Promise<Response>>,
) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname.replace('/api/v1/', '');
      const texto = await request.clone().text();
      const chamada = {
        path,
        authorization: request.headers.get('Authorization'),
        body: texto ? JSON.parse(texto) : undefined,
      };
      chamadas.push(chamada);
      return rotas[path](chamada);
    }),
  );
  return chamadas;
}

const erro = (status: number, code: string, message = 'x') =>
  jsonResponse({ statusCode: status, code, message }, status);

describe('auth-actions', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1/');
    window.sessionStorage.clear();
    reloadStoredSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  describe('login', () => {
    it('envia e-mail (sem espaços nas pontas) e senha e inicia a sessão com a resposta', async () => {
      const chamadas = simularApi({
        'auth/login': () =>
          jsonResponse(authResponse({ user: ADMIN_INFO, accessToken: 'tk' })),
      });

      await login('  dev.admin@pauta.local ', 'a-senha');

      expect(chamadas[0].body).toEqual({
        email: 'dev.admin@pauta.local',
        password: 'a-senha',
      });
      expect(chamadas[0].authorization).toBeNull();
      expect(getSession()?.accessToken).toBe('tk');
      expect(getSession()?.user.permissions).toContain('user:write');
      expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    });

    it('guarda mustChangePassword quando a senha é provisória', async () => {
      simularApi({
        'auth/login': () =>
          jsonResponse(authResponse({ mustChangePassword: true })),
      });

      await login('a@pauta.local', 'provisoria');

      expect(getSession()?.mustChangePassword).toBe(true);
    });

    it.each([
      [401, 'INVALID_CREDENTIALS'],
      [403, 'ACCOUNT_LOCKED'],
      [403, 'USER_DEACTIVATED'],
      [429, 'TOO_MANY_REQUESTS'],
    ])('devolve o erro %i %s com o code da API e não cria sessão', async (status, code) => {
      simularApi({ 'auth/login': () => erro(status, code) });

      const falha = await login('a@pauta.local', 'x').catch((e: unknown) => e);

      expect(falha).toBeInstanceOf(ApiError);
      expect((falha as ApiError).code).toBe(code);
      expect(getSession()).toBeNull();
    });

    it('um 401 de credenciais não tenta renovar token nem encerrar nada', async () => {
      const chamadas = simularApi({
        'auth/login': () => erro(401, 'INVALID_CREDENTIALS'),
      });

      await login('a@pauta.local', 'x').catch(() => undefined);

      expect(chamadas.map((c) => c.path)).toEqual(['auth/login']);
    });
  });

  describe('logout', () => {
    it('avisa a API com o refresh token e apaga a sessão', async () => {
      startSession(authResponse({ accessToken: 'ac', refreshToken: 'rf' }));
      const chamadas = simularApi({
        'auth/logout': () => new Response(null, { status: 204 }),
      });

      await logout();

      expect(chamadas[0].authorization).toBe('Bearer ac');
      expect(chamadas[0].body).toEqual({ refreshToken: 'rf' });
      expect(getSession()).toBeNull();
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('ignora a falha de rede e limpa tudo do mesmo jeito', async () => {
      startSession(authResponse());
      simularApi({
        'auth/logout': () => {
          throw new TypeError('Failed to fetch');
        },
      });

      await expect(logout()).resolves.toBeUndefined();

      expect(getSession()).toBeNull();
    });

    it('ignora um 401 (token já vencido) sem tentar renovar', async () => {
      startSession(authResponse());
      const chamadas = simularApi({
        'auth/logout': () => erro(401, 'UNAUTHENTICATED'),
      });

      await logout();

      expect(chamadas.map((c) => c.path)).toEqual(['auth/logout']);
      expect(getSession()).toBeNull();
    });

    it('sem sessão não chama a API', async () => {
      const chamadas = simularApi({});

      await logout();

      expect(chamadas).toHaveLength(0);
    });
  });

  describe('changePassword', () => {
    it('substitui a sessão pela nova que a API devolve (tokens novos, senha deixa de ser provisória)', async () => {
      startSession(
        authResponse({
          accessToken: 'restrito',
          refreshToken: 'r-velho',
          mustChangePassword: true,
        }),
      );
      const chamadas = simularApi({
        'auth/change-password': () =>
          jsonResponse(
            authResponse({
              accessToken: 'pleno',
              refreshToken: 'r-novo',
              mustChangePassword: false,
            }),
          ),
      });

      await changePassword('provisoria', 'minha-senha-nova');

      expect(chamadas[0].authorization).toBe('Bearer restrito');
      expect(chamadas[0].body).toEqual({
        currentPassword: 'provisoria',
        newPassword: 'minha-senha-nova',
      });
      expect(getSession()).toMatchObject({
        accessToken: 'pleno',
        refreshToken: 'r-novo',
        mustChangePassword: false,
      });
    });

    it.each([
      [400, 'INVALID_CURRENT_PASSWORD'],
      [400, 'WEAK_PASSWORD'],
    ])('o erro %i %s sobe para a tela e mantém a sessão atual', async (status, code) => {
      startSession(
        authResponse({ accessToken: 'ac', mustChangePassword: true }),
      );
      simularApi({ 'auth/change-password': () => erro(status, code) });

      const falha = await changePassword('a', 'b').catch((e: unknown) => e);

      expect((falha as ApiError).code).toBe(code);
      expect(getSession()?.accessToken).toBe('ac');
      expect(getSession()?.mustChangePassword).toBe(true);
    });
  });

  describe('verifySession', () => {
    it('reconfere /auth/user-info e atualiza identidade e permissões, sem mexer nos tokens', async () => {
      startSession(authResponse({ accessToken: 'ac', refreshToken: 'rf' }));
      simularApi({ 'auth/user-info': () => jsonResponse(ADMIN_INFO) });

      await verifySession();

      expect(getSession()?.user).toEqual(ADMIN_INFO);
      expect(getSession()?.accessToken).toBe('ac');
      expect(getSession()?.refreshToken).toBe('rf');
    });
  });
});

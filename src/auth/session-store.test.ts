import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SESSION_KEY, SESSION_NOTICE_KEY } from '@/auth/session-storage';
import { createSessionApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { queryClient } from '@/lib/query-client';
import { authResponse, jsonResponse } from '@/test/auth-fixtures';
import {
  endSession,
  getFreshAccessToken,
  getSession,
  markPasswordChangeRequired,
  refreshSession,
  reloadStoredSession,
  renewAfterUnauthorized,
  startSession,
  toSession,
} from './session-store';

const API = 'http://api.test/api/v1/';

interface Chamada {
  path: string;
  method: string;
  authorization: string | null;
  body: unknown;
}

/**
 * Servidor simulado: registra cada chamada e responde por rota. `refresh`
 * recebe o corpo e devolve a resposta (com atraso, para as chamadas
 * simultâneas se encontrarem no mesmo voo).
 */
function simularApi(
  rotas: Record<string, (chamada: Chamada) => Response | Promise<Response>>,
) {
  const chamadas: Chamada[] = [];
  const fetchMock = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname.replace('/api/v1/', '');
    const texto = await request.clone().text();
    const chamada: Chamada = {
      path,
      method: request.method,
      authorization: request.headers.get('Authorization'),
      body: texto ? JSON.parse(texto) : undefined,
    };
    chamadas.push(chamada);
    const rota = rotas[path];
    if (!rota) throw new Error(`rota não simulada: ${path}`);
    return rota(chamada);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { chamadas, fetchMock };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('session-store', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', API);
    window.sessionStorage.clear();
    reloadStoredSession();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  describe('sessão', () => {
    it('guarda a sessão no sessionStorage (e nunca no localStorage)', () => {
      startSession(authResponse());

      const salvo = JSON.parse(
        window.sessionStorage.getItem(SESSION_KEY) ?? '{}',
      );
      expect(salvo.accessToken).toBe('access-1');
      expect(salvo.refreshToken).toBe('refresh-1');
      expect(window.localStorage.length).toBe(0);
    });

    it('restaura a sessão guardada ao carregar', () => {
      startSession(authResponse());

      reloadStoredSession();

      expect(getSession()?.user.email).toBe('dev.editor@pauta.local');
    });

    it('endSession apaga storage, cache de servidor e deixa o aviso de expirada', () => {
      queryClient.setQueryData(['dado'], 'de outra pessoa');
      startSession(authResponse());

      endSession('expired');

      expect(getSession()).toBeNull();
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
      expect(queryClient.getQueryData(['dado'])).toBeUndefined();
      expect(window.sessionStorage.getItem(SESSION_NOTICE_KEY)).toBe('expired');
    });

    it('um novo login apaga o aviso de sessão expirada', () => {
      window.sessionStorage.setItem(SESSION_NOTICE_KEY, 'expired');

      startSession(authResponse());

      expect(window.sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull();
    });

    it('marca a senha provisória como pendente e persiste', () => {
      startSession(authResponse());

      markPasswordChangeRequired();

      expect(getSession()?.mustChangePassword).toBe(true);
      reloadStoredSession();
      expect(getSession()?.mustChangePassword).toBe(true);
    });
  });

  describe('toSession', () => {
    it('renova 60 s antes de o access token vencer', () => {
      const sessao = toSession(authResponse({ expiresIn: 900 }), 1_000);

      expect(sessao.expiresAt).toBe(1_000 + 900_000);
      expect(sessao.refreshAt).toBe(1_000 + 900_000 - 60_000);
    });

    it('com validade curta limita a antecedência a um quarto, para não renovar sem parar', () => {
      const sessao = toSession(authResponse({ expiresIn: 60 }), 0);

      expect(sessao.refreshAt).toBe(45_000);
      expect(sessao.refreshAt).toBeGreaterThan(0);
    });
  });

  describe('refresh em voo único', () => {
    it('várias requisições com 401 ao mesmo tempo compartilham UMA chamada de /auth/refresh', async () => {
      startSession(authResponse({ accessToken: 'velho', refreshToken: 'r1' }));
      const { chamadas } = simularApi({
        'auth/refresh': async () => {
          await esperar(15);
          return jsonResponse(
            authResponse({ accessToken: 'novo', refreshToken: 'r2' }),
          );
        },
        pautas: (c) =>
          c.authorization === 'Bearer velho'
            ? jsonResponse({ code: 'UNAUTHENTICATED' }, 401)
            : jsonResponse({ ok: true }),
      });

      const api = createSessionApi();
      const respostas = await Promise.all([
        api.get('pautas').json(),
        api.get('pautas').json(),
        api.get('pautas').json(),
        api.get('pautas').json(),
      ]);

      expect(respostas).toEqual([
        { ok: true },
        { ok: true },
        { ok: true },
        { ok: true },
      ]);
      const refreshes = chamadas.filter((c) => c.path === 'auth/refresh');
      expect(refreshes).toHaveLength(1);
      expect(refreshes[0].body).toEqual({ refreshToken: 'r1' });
      // As quatro foram repetidas com o token novo.
      expect(
        chamadas.filter((c) => c.authorization === 'Bearer novo'),
      ).toHaveLength(4);
    });

    it('guarda o refresh token novo (o antigo é de uso único) antes de liberar quem esperava', async () => {
      startSession(authResponse({ refreshToken: 'r1' }));
      simularApi({
        'auth/refresh': () =>
          jsonResponse(authResponse({ accessToken: 'a2', refreshToken: 'r2' })),
      });

      const promessa = refreshSession();
      const sessao = await promessa;

      expect(sessao?.refreshToken).toBe('r2');
      expect(getSession()?.refreshToken).toBe('r2');
      expect(
        JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? '{}')
          .refreshToken,
      ).toBe('r2');
    });

    it('uma chamada que falhou com token antigo, depois de outra já ter renovado, só repete com o vigente', async () => {
      startSession(authResponse({ accessToken: 'vigente' }));
      const { chamadas } = simularApi({});

      const token = await renewAfterUnauthorized('token-que-falhou');

      expect(token).toBe('vigente');
      expect(chamadas).toHaveLength(0);
    });

    it('depois que o voo termina, uma nova renovação faz uma nova chamada', async () => {
      startSession(authResponse({ refreshToken: 'r1' }));
      let n = 1;
      const { chamadas } = simularApi({
        'auth/refresh': () => {
          n += 1;
          return jsonResponse(
            authResponse({ accessToken: `a${n}`, refreshToken: `r${n}` }),
          );
        },
      });

      await refreshSession();
      await refreshSession();

      expect(chamadas.map((c) => c.body)).toEqual([
        { refreshToken: 'r1' },
        { refreshToken: 'r2' },
      ]);
    });

    it('o resultado de um refresh em voo não ressuscita a sessão encerrada por logout', async () => {
      startSession(authResponse({ refreshToken: 'r1' }));
      simularApi({
        'auth/refresh': async () => {
          await esperar(10);
          return jsonResponse(authResponse({ refreshToken: 'r2' }));
        },
      });

      const voo = refreshSession();
      endSession();
      await voo;

      expect(getSession()).toBeNull();
    });
  });

  describe('refresh que falha', () => {
    it('recusado pela API (INVALID_REFRESH_TOKEN) encerra a sessão: limpa storage e cache', async () => {
      queryClient.setQueryData(['dado'], 1);
      startSession(authResponse());
      simularApi({
        'auth/refresh': () =>
          jsonResponse(
            { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'x' },
            401,
          ),
      });

      const resultado = await refreshSession();

      expect(resultado).toBeNull();
      expect(getSession()).toBeNull();
      expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
      expect(queryClient.getQueryData(['dado'])).toBeUndefined();
    });

    it('usuário desativado (403 USER_DEACTIVATED) também encerra a sessão', async () => {
      startSession(authResponse());
      simularApi({
        'auth/refresh': () =>
          jsonResponse(
            { statusCode: 403, code: 'USER_DEACTIVATED', message: 'x' },
            403,
          ),
      });

      await refreshSession();

      expect(getSession()).toBeNull();
    });

    it('falha de rede NÃO derruba a sessão: o erro sobe e dá para tentar de novo', async () => {
      startSession(authResponse({ refreshToken: 'r1' }));
      const falhar = vi.fn(() => {
        throw new TypeError('Failed to fetch');
      });
      simularApi({ 'auth/refresh': falhar });

      await expect(refreshSession()).rejects.toBeTruthy();

      expect(getSession()?.refreshToken).toBe('r1');
      expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
    });

    it('5xx NÃO derruba a sessão', async () => {
      startSession(authResponse());
      simularApi({
        'auth/refresh': () =>
          jsonResponse({ statusCode: 500, code: 'INTERNAL_ERROR' }, 500),
      });

      await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);

      expect(getSession()).not.toBeNull();
    });

    it('um 401 de negócio cuja renovação foi recusada encerra a sessão e falha a chamada', async () => {
      startSession(authResponse({ accessToken: 'velho' }));
      simularApi({
        'auth/refresh': () =>
          jsonResponse({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' }, 401),
        pautas: () => jsonResponse({ code: 'UNAUTHENTICATED' }, 401),
      });

      await expect(createSessionApi().get('pautas')).rejects.toMatchObject({
        status: 401,
      });

      expect(getSession()).toBeNull();
    });

    it('um 401 de negócio com a renovação falhando por rede mantém a sessão', async () => {
      startSession(authResponse({ accessToken: 'velho' }));
      simularApi({
        'auth/refresh': () => {
          throw new TypeError('Failed to fetch');
        },
        pautas: () => jsonResponse({ code: 'UNAUTHENTICATED' }, 401),
      });

      await expect(createSessionApi().get('pautas')).rejects.toBeTruthy();

      expect(getSession()?.accessToken).toBe('velho');
    });

    it('um 403 comum não renova nem encerra a sessão', async () => {
      startSession(authResponse());
      const { chamadas } = simularApi({
        pautas: () => jsonResponse({ code: 'FORBIDDEN' }, 403),
      });

      await expect(createSessionApi().get('pautas')).rejects.toMatchObject({
        status: 403,
      });

      expect(getSession()).not.toBeNull();
      expect(chamadas.map((c) => c.path)).toEqual(['pautas']);
    });
  });

  describe('senha provisória pendente', () => {
    it('403 PASSWORD_CHANGE_REQUIRED marca a sessão e não a encerra', async () => {
      startSession(authResponse());
      simularApi({
        pautas: () =>
          jsonResponse(
            { statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'x' },
            403,
          ),
      });

      await expect(createSessionApi().get('pautas')).rejects.toMatchObject({
        code: 'PASSWORD_CHANGE_REQUIRED',
      });

      expect(getSession()?.mustChangePassword).toBe(true);
    });

    it('o refresh de uma sessão pendente devolve mustChangePassword e a sessão o guarda', async () => {
      startSession(authResponse({ mustChangePassword: true }));
      simularApi({
        'auth/refresh': () =>
          jsonResponse(authResponse({ mustChangePassword: true })),
      });

      await refreshSession();

      expect(getSession()?.mustChangePassword).toBe(true);
    });
  });

  describe('renovação antes de vencer', () => {
    it('com o token longe de vencer, usa o atual sem renovar', async () => {
      startSession(authResponse({ accessToken: 'atual', expiresIn: 900 }));
      const { chamadas } = simularApi({});

      expect(await getFreshAccessToken()).toBe('atual');
      expect(chamadas).toHaveLength(0);
    });

    it('com o token a segundos de vencer, renova antes de enviar a chamada', async () => {
      startSession(authResponse({ accessToken: 'quase', expiresIn: 3 }));
      const { chamadas } = simularApi({
        'auth/refresh': () =>
          jsonResponse(
            authResponse({ accessToken: 'renovado', refreshToken: 'r2' }),
          ),
        pautas: () => jsonResponse({ ok: true }),
      });

      await createSessionApi().get('pautas').json();

      expect(chamadas.map((c) => c.path)).toEqual(['auth/refresh', 'pautas']);
      expect(chamadas[1].authorization).toBe('Bearer renovado');
    });

    it('sem sessão não envia Authorization', async () => {
      const { chamadas } = simularApi({ pautas: () => jsonResponse({}) });

      await createSessionApi().get('pautas').json();

      expect(chamadas[0].authorization).toBeNull();
    });
  });
});

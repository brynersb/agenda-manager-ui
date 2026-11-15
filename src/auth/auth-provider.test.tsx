import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeStoredSession } from '@/auth/session-storage';
import {
  reloadStoredSession,
  startSession,
  toSession,
} from '@/auth/session-store';
import { ADMIN_INFO, authResponse, jsonResponse } from '@/test/auth-fixtures';
import { AuthProvider } from './auth-provider';
import { useAuthContext } from './use-auth';

function Sonda() {
  const auth = useAuthContext();
  return (
    <div>
      <p data-testid="estado">
        {JSON.stringify({
          autenticado: auth.isAuthenticated,
          carregando: auth.isLoading,
          verificando: auth.isLoadingPermissions,
          erro: auth.permissionsError?.message ?? null,
          nome: auth.name,
          papel: auth.role,
          provisoria: auth.mustChangePassword,
          temUserWrite: auth.hasPermission('user:write'),
        })}
      </p>
      <button
        type="button"
        onClick={() => void auth.signIn('a@pauta.local', 'segredo')}
      >
        entrar
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        sair
      </button>
    </div>
  );
}

function estado() {
  return JSON.parse(screen.getByTestId('estado').textContent ?? '{}');
}

function montar() {
  return render(
    <AuthProvider>
      <Sonda />
    </AuthProvider>,
  );
}

/** Guarda uma sessão no storage como se a página tivesse sido recarregada. */
function guardarSessao(
  resposta = authResponse(),
  instante = Date.now(),
  ajustes: { refreshAt?: number } = {},
) {
  writeStoredSession({ ...toSession(resposta, instante), ...ajustes });
  reloadStoredSession();
}

function simularApi(
  rotas: Record<string, (corpo: unknown) => Response | Promise<Response>>,
) {
  const chamadas: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname.replace('/api/v1/', '');
      chamadas.push(path);
      const texto = await request.clone().text();
      return rotas[path](texto ? JSON.parse(texto) : undefined);
    }),
  );
  return chamadas;
}

describe('<AuthProvider />', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1/');
    window.sessionStorage.clear();
    reloadStoredSession();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it('sem sessão guardada: não autenticado e sem nada carregando', () => {
    const chamadas = simularApi({});

    montar();

    expect(estado()).toMatchObject({
      autenticado: false,
      carregando: false,
      verificando: false,
    });
    expect(chamadas).toHaveLength(0);
  });

  it('restaura a sessão do storage e reconfere /auth/user-info ao carregar', async () => {
    guardarSessao();
    const chamadas = simularApi({
      'auth/user-info': () => jsonResponse(ADMIN_INFO),
    });

    montar();

    expect(estado()).toMatchObject({ autenticado: true, verificando: true });
    await waitFor(() => expect(estado().verificando).toBe(false));
    expect(chamadas).toEqual(['auth/user-info']);
    // A resposta da API atualizou a identidade e as permissões da sessão.
    expect(estado()).toMatchObject({
      nome: 'Dev Admin',
      papel: 'admin',
      temUserWrite: true,
    });
  });

  it('se já passou da hora de renovar, renova o token ao abrir a página (sem user-info)', async () => {
    guardarSessao(authResponse({ expiresIn: 900 }), Date.now() - 890_000);
    const chamadas = simularApi({
      'auth/refresh': () =>
        jsonResponse(authResponse({ accessToken: 'novo', refreshToken: 'r2' })),
    });

    montar();

    expect(estado()).toMatchObject({ autenticado: true, carregando: true });
    await waitFor(() => expect(estado().carregando).toBe(false));
    expect(chamadas).toEqual(['auth/refresh']);
  });

  it('refresh recusado ao abrir a página: volta a não autenticado, sem tela de erro', async () => {
    guardarSessao(authResponse({ expiresIn: 900 }), Date.now() - 890_000);
    simularApi({
      'auth/refresh': () =>
        jsonResponse({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' }, 401),
    });

    montar();

    await waitFor(() => expect(estado().carregando).toBe(false));
    expect(estado()).toMatchObject({ autenticado: false, erro: null });
  });

  it('falha de rede ao reconferir a sessão vira erro de carregamento, não "sem permissão"', async () => {
    guardarSessao();
    simularApi({
      'auth/user-info': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    montar();

    await waitFor(() => expect(estado().erro).not.toBeNull());
    expect(estado().autenticado).toBe(true);
  });

  it('um 401 sem saída ao reconferir encerra a sessão em vez de mostrar erro', async () => {
    guardarSessao();
    simularApi({
      'auth/user-info': () => jsonResponse({ code: 'UNAUTHENTICATED' }, 401),
      'auth/refresh': () =>
        jsonResponse({ statusCode: 401, code: 'INVALID_REFRESH_TOKEN' }, 401),
    });

    montar();

    await waitFor(() => expect(estado().autenticado).toBe(false));
    expect(estado().erro).toBeNull();
  });

  it('expõe a senha provisória pendente guardada na sessão', async () => {
    guardarSessao(authResponse({ mustChangePassword: true }));
    simularApi({ 'auth/user-info': () => jsonResponse(authResponse().user) });

    montar();

    expect(estado().provisoria).toBe(true);
    await waitFor(() => expect(estado().verificando).toBe(false));
  });

  it('entrar e sair pelo contexto iniciam e encerram a sessão', async () => {
    simularApi({
      'auth/login': () => jsonResponse(authResponse({ user: ADMIN_INFO })),
      'auth/logout': () => new Response(null, { status: 204 }),
    });
    montar();

    await act(async () => {
      screen.getByRole('button', { name: 'entrar' }).click();
    });
    await waitFor(() => expect(estado().autenticado).toBe(true));
    expect(estado().papel).toBe('admin');

    await act(async () => {
      screen.getByRole('button', { name: 'sair' }).click();
    });
    await waitFor(() => expect(estado().autenticado).toBe(false));
  });

  describe('renovação antes de vencer', () => {
    it('renova sozinha quando chega a hora, sem ninguém pedir nada', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      startSession(authResponse({ expiresIn: 900, refreshToken: 'r1' }));
      const chamadas = simularApi({
        'auth/refresh': () =>
          jsonResponse(authResponse({ accessToken: 'a2', refreshToken: 'r2' })),
        'auth/user-info': () => jsonResponse(authResponse().user),
      });
      montar();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      const antes = chamadas.filter((c) => c === 'auth/refresh').length;

      // Falta 1 minuto para vencer: 14 min depois do login.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14 * 60_000 + 100);
      });

      expect(antes).toBe(0);
      expect(chamadas.filter((c) => c === 'auth/refresh')).toHaveLength(1);
    });

    it('com validade de 1 minuto renova uma vez a cada ciclo, sem laço de renovações', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      startSession(authResponse({ expiresIn: 60, refreshToken: 'r1' }));
      let n = 1;
      const chamadas = simularApi({
        'auth/refresh': () => {
          n += 1;
          return jsonResponse(
            authResponse({
              expiresIn: 60,
              accessToken: `a${n}`,
              refreshToken: `r${n}`,
            }),
          );
        },
        'auth/user-info': () => jsonResponse(authResponse().user),
      });
      montar();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3 * 60_000);
      });

      const refreshes = chamadas.filter((c) => c === 'auth/refresh').length;
      expect(refreshes).toBeGreaterThanOrEqual(3);
      expect(refreshes).toBeLessThanOrEqual(5);
    });

    it('se a renovação falha por rede, tenta de novo depois, sem encerrar a sessão', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      startSession(authResponse({ expiresIn: 900, refreshToken: 'r1' }));
      let tentativas = 0;
      simularApi({
        'auth/refresh': () => {
          tentativas += 1;
          if (tentativas === 1) throw new TypeError('Failed to fetch');
          return jsonResponse(authResponse({ refreshToken: 'r2' }));
        },
        'auth/user-info': () => jsonResponse(authResponse().user),
      });
      montar();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(14 * 60_000 + 100);
      });
      expect(tentativas).toBe(1);
      expect(estado().autenticado).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(tentativas).toBe(2);
      expect(estado().autenticado).toBe(true);
    });
  });
});

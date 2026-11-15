import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApi, ForbiddenApiError, UnauthorizedApiError } from './api';
import {
  ApiError,
  getApiErrorMessage,
  isCode,
  OFFLINE_MESSAGE,
} from './api-error';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyResponse(status: number) {
  return new Response(null, { status });
}

describe('createApi', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test/api/v1/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('chama a API sob o prefixo configurado, com caminho sem barra inicial', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    await createApi(() => 'token')
      .get('content-briefs')
      .json();

    expect((mockFetch.mock.calls[0][0] as Request).url).toBe(
      'http://api.test/api/v1/content-briefs',
    );
  });

  it('envia o access token como Bearer', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    await createApi(() => 'my-token')
      .get('foo')
      .json();

    const request = mockFetch.mock.calls[0][0] as Request;
    expect(request.headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('não envia Authorization quando não há token', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    await createApi(() => undefined)
      .get('foo')
      .json();

    const request = mockFetch.mock.calls[0][0] as Request;
    expect(request.headers.has('Authorization')).toBe(false);
  });

  it('no 401 renova o token uma vez e repete a chamada sem encerrar a sessão', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    const renewToken = vi.fn().mockResolvedValue('new-token');
    const onSessionExpired = vi.fn();

    const result = await createApi(() => 'old-token', {
      renewToken,
      onSessionExpired,
    })
      .get('foo')
      .json();

    expect(result).toEqual({ ok: true });
    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(
      (mockFetch.mock.calls[1][0] as Request).headers.get('Authorization'),
    ).toBe('Bearer new-token');
  });

  it('encerra a sessão quando a renovação do token falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(401)));

    const onSessionExpired = vi.fn();

    await expect(
      createApi(() => 'old-token', {
        renewToken: vi.fn().mockResolvedValue(undefined),
        onSessionExpired,
      }).get('foo'),
    ).rejects.toBeInstanceOf(UnauthorizedApiError);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('encerra a sessão quando o 401 persiste após renovar, sem tentar de novo', async () => {
    const mockFetch = vi.fn().mockResolvedValue(emptyResponse(401));
    vi.stubGlobal('fetch', mockFetch);

    const renewToken = vi.fn().mockResolvedValue('new-token');
    const onSessionExpired = vi.fn();

    await expect(
      createApi(() => 'old-token', { renewToken, onSessionExpired }).get('foo'),
    ).rejects.toBeInstanceOf(UnauthorizedApiError);

    expect(renewToken).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('no 403 lança ForbiddenApiError sem renovar token nem encerrar a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(403)));

    const renewToken = vi.fn();
    const onSessionExpired = vi.fn();

    await expect(
      createApi(() => 'token', { renewToken, onSessionExpired }).get('foo'),
    ).rejects.toBeInstanceOf(ForbiddenApiError);

    expect(renewToken).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('converte erros 4xx em ApiError com code e fields do corpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            statusCode: 400,
            code: 'INVALID_REQUEST',
            message: 'Requisição inválida',
            fields: [{ field: 'titulo', message: 'Obrigatório' }],
          },
          400,
        ),
      ),
    );

    const error = await createApi(() => 'token')
      .post('content-briefs', { json: {} })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(isCode(error, 'INVALID_REQUEST')).toBe(true);
    expect((error as ApiError).fields).toEqual([
      { field: 'titulo', message: 'Obrigatório' },
    ]);
  });

  it('não repete a chamada em erro 5xx (o retry é do TanStack Query)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Erro' },
          500,
        ),
      );
    vi.stubGlobal('fetch', mockFetch);

    await expect(createApi(() => 'token').get('foo')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('trata fetch que falha por rede como erro de conexão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const error = await createApi(() => 'token')
      .get('foo')
      .catch((e: unknown) => e);

    expect(getApiErrorMessage(error)).toBe(OFFLINE_MESSAGE);
  });

  it('devolve ACCOUNT_LOCKED com code e texto da API, sem virar "sem permissão"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            statusCode: 403,
            code: 'ACCOUNT_LOCKED',
            message: 'Tente novamente em 9 minutos.',
          },
          403,
        ),
      ),
    );

    const error = await createApi(() => undefined)
      .post('auth/login', { json: {} })
      .catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(ForbiddenApiError);
    expect(isCode(error, 'ACCOUNT_LOCKED')).toBe(true);
    expect(getApiErrorMessage(error)).toBe('Tente novamente em 9 minutos.');
  });

  it('401 INVALID_CREDENTIALS mantém o code e não conta como sessão expirada', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' },
            401,
          ),
        ),
    );
    const onSessionExpired = vi.fn();
    const renewToken = vi.fn();

    const error = await createApi(() => undefined, {
      onSessionExpired,
      renewToken,
    })
      .post('auth/login', { json: {} })
      .catch((e: unknown) => e);

    expect(isCode(error, 'INVALID_CREDENTIALS')).toBe(true);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('403 PASSWORD_CHANGE_REQUIRED avisa o gancho, mantém o code e não encerra a sessão', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { statusCode: 403, code: 'PASSWORD_CHANGE_REQUIRED', message: 'x' },
            403,
          ),
        ),
    );
    const onPasswordChangeRequired = vi.fn();
    const onSessionExpired = vi.fn();

    const error = await createApi(() => 'token', {
      onPasswordChangeRequired,
      onSessionExpired,
    })
      .get('content-briefs')
      .catch((e: unknown) => e);

    expect(isCode(error, 'PASSWORD_CHANGE_REQUIRED')).toBe(true);
    expect(onPasswordChangeRequired).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('aceita um token assíncrono (renovado antes de enviar)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);

    await createApi(async () => 'token-async')
      .get('foo')
      .json();

    expect(
      (mockFetch.mock.calls[0][0] as Request).headers.get('Authorization'),
    ).toBe('Bearer token-async');
  });

  it('informa à renovação com que token a chamada falhou', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(emptyResponse(401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', mockFetch);
    const renewToken = vi.fn().mockResolvedValue('novo');

    await createApi(() => 'o-que-falhou', { renewToken })
      .get('foo')
      .json();

    expect(renewToken).toHaveBeenCalledWith('o-que-falhou');
  });

  it('falha transitória da renovação (rede) propaga o erro e não encerra a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(401)));
    const onSessionExpired = vi.fn();
    const falha = new TypeError('Failed to fetch');

    await expect(
      createApi(() => 'token', {
        renewToken: vi.fn().mockRejectedValue(falha),
        onSessionExpired,
      }).get('foo'),
    ).rejects.toBe(falha);

    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

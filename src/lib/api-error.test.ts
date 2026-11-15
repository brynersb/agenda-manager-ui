import { HTTPError, NetworkError } from 'ky';
import { describe, expect, it } from 'vitest';

import {
  ApiError,
  CODE_MESSAGES,
  FALLBACK_MESSAGE,
  getApiErrorMessage,
  getErrorStatus,
  getFieldErrors,
  isCode,
  OFFLINE_MESSAGE,
  toApiError,
} from './api-error';

/**
 * Catálogo de `code` do plan técnico §5.6 e do `docs/auth.md` da API (seção 6),
 * escrito à mão para o teste.
 */
const CATALOGO = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
  'INVALID_REGISTRY_NAME',
  'INVALID_EMAIL',
  'ESTATE_DEVELOPMENT_NOT_FOUND',
  'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
  'ESTATE_DEVELOPMENT_UNAVAILABLE',
  'ESTATE_DEVELOPMENT_VERSION_OUTDATED',
  'OWNER_NOT_FOUND',
  'OWNER_NAME_DUPLICATED',
  'OWNER_UNAVAILABLE',
  'OWNER_VERSION_OUTDATED',
  'INVALID_TITLE',
  'INVALID_DESCRIPTION',
  'CONTENT_BRIEF_NOT_FOUND',
  'CONTENT_BRIEF_VERSION_OUTDATED',
  'TOO_MANY_REQUESTS',
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'ACCOUNT_LOCKED',
  'USER_DEACTIVATED',
  'PASSWORD_CHANGE_REQUIRED',
  'INVALID_CURRENT_PASSWORD',
  'WEAK_PASSWORD',
  'INVALID_USER_NAME',
  'USER_NOT_FOUND',
  'EMAIL_ALREADY_REGISTERED',
  'USER_VERSION_OUTDATED',
  'LAST_ADMIN',
  'CANNOT_MODIFY_SELF',
];

/** Códigos em que a `message` da API complementa o catálogo (minutos, motivo). */
const COM_TEXTO_DA_API = ['ACCOUNT_LOCKED', 'WEAK_PASSWORD'];

function apiError(code: string, message = 'texto da api', status = 409) {
  return new ApiError({ status, code, message });
}

describe('getApiErrorMessage', () => {
  it('tem mensagem em pt-BR para todos os códigos do catálogo da API', () => {
    expect(Object.keys(CODE_MESSAGES).sort()).toEqual([...CATALOGO].sort());
  });

  it.each(
    CATALOGO.filter((code) => !COM_TEXTO_DA_API.includes(code)),
  )('decide a mensagem pelo code %s, ignorando o texto da API', (code) => {
    const message = getApiErrorMessage(apiError(code, 'texto qualquer'));

    expect(message).toBe(CODE_MESSAGES[code as keyof typeof CODE_MESSAGES]);
    expect(message).not.toBe('texto qualquer');
  });

  it('mostra os minutos restantes que a API informa em ACCOUNT_LOCKED', () => {
    const texto =
      'Conta bloqueada por excesso de tentativas. Tente novamente em 10 minutos.';

    expect(getApiErrorMessage(apiError('ACCOUNT_LOCKED', texto, 403))).toBe(
      texto,
    );
  });

  it('cai no catálogo em ACCOUNT_LOCKED e WEAK_PASSWORD quando a API não manda texto', () => {
    for (const code of COM_TEXTO_DA_API) {
      expect(getApiErrorMessage(apiError(code, '', 400))).toBe(
        CODE_MESSAGES[code as keyof typeof CODE_MESSAGES],
      );
    }
  });

  it('distingue as duas causas de WEAK_PASSWORD pelo texto da API', () => {
    expect(
      getApiErrorMessage(
        apiError(
          'WEAK_PASSWORD',
          'A nova senha deve ser diferente da atual.',
          400,
        ),
      ),
    ).toBe('A nova senha deve ser diferente da atual.');
  });

  it('usa a message da API quando o code não está no mapa', () => {
    expect(getApiErrorMessage(apiError('CODIGO_NOVO', 'Mensagem nova'))).toBe(
      'Mensagem nova',
    );
  });

  it('cai no texto genérico quando não há code conhecido nem message', () => {
    expect(getApiErrorMessage(apiError('', ''))).toBe(FALLBACK_MESSAGE);
    expect(FALLBACK_MESSAGE).toBe('Não foi possível concluir. Tente de novo.');
  });

  it('cai no texto genérico para erros que não vieram da API', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe(FALLBACK_MESSAGE);
    expect(getApiErrorMessage('qualquer coisa')).toBe(FALLBACK_MESSAGE);
  });

  it('avisa que não salvou quando não há conexão com o servidor', () => {
    const error = new NetworkError(new Request('http://api.test/x'), {
      cause: new TypeError('Failed to fetch'),
    } as never);

    expect(getApiErrorMessage(error)).toBe(OFFLINE_MESSAGE);
    expect(OFFLINE_MESSAGE).toBe(
      'Sem conexão com o servidor. Suas alterações não foram salvas.',
    );
  });

  it('também interpreta um HTTPError cru do ky pelo corpo da resposta', () => {
    const error = Object.assign(Object.create(HTTPError.prototype), {
      response: { status: 409 },
      data: { statusCode: 409, code: 'CONTENT_BRIEF_NOT_FOUND', message: 'x' },
    });

    expect(getApiErrorMessage(error)).toBe(
      CODE_MESSAGES.CONTENT_BRIEF_NOT_FOUND,
    );
  });
});

describe('isCode e getErrorStatus', () => {
  it('reconhece o code e o status de um erro da API', () => {
    const error = apiError('CONTENT_BRIEF_VERSION_OUTDATED');

    expect(isCode(error, 'CONTENT_BRIEF_VERSION_OUTDATED')).toBe(true);
    expect(isCode(error, 'CONTENT_BRIEF_NOT_FOUND')).toBe(false);
    expect(getErrorStatus(error)).toBe(409);
  });

  it('devolve falso e indefinido para erros que não são da API', () => {
    expect(isCode(new Error('x'), 'INTERNAL_ERROR')).toBe(false);
    expect(getErrorStatus(new Error('x'))).toBeUndefined();
  });
});

describe('getFieldErrors', () => {
  it('mapeia campo para mensagem a partir de fields da API', () => {
    const error = new ApiError({
      status: 400,
      code: 'INVALID_REQUEST',
      fields: [
        { field: 'title', message: 'Obrigatório' },
        { field: 'dueDate', message: 'Data inválida' },
      ],
    });

    expect(getFieldErrors(error)).toEqual({
      title: 'Obrigatório',
      dueDate: 'Data inválida',
    });
  });

  it('devolve vazio quando o erro não traz campos', () => {
    expect(getFieldErrors(apiError('INTERNAL_ERROR', '', 500))).toEqual({});
    expect(getFieldErrors(new Error('x'))).toEqual({});
  });
});

describe('toApiError', () => {
  it('lê status, code, message e fields do corpo', () => {
    const error = toApiError({
      response: { status: 400 },
      data: {
        statusCode: 400,
        code: 'INVALID_REQUEST',
        message: 'Requisição inválida',
        fields: [{ field: 'title', message: 'Obrigatório' }],
      },
    });

    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_REQUEST');
    expect(error.message).toBe('Requisição inválida');
    expect(error.fields).toHaveLength(1);
  });

  it('tolera corpo ausente ou em texto (ex.: HTML de proxy)', () => {
    const error = toApiError({
      response: { status: 502 },
      data: '<html>Bad gateway</html>',
    });

    expect(error.status).toBe(502);
    expect(error.code).toBe('');
    expect(getApiErrorMessage(error)).toBe(FALLBACK_MESSAGE);
  });
});

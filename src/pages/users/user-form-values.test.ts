import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { buildUser } from '@/test/users-fake';
import {
  buildCreateBody,
  buildUpdateBody,
  EMPTY_VALUES,
  errorsFromApi,
  isChanged,
  type UserFormValues,
  validate,
  valuesOf,
} from './user-form-values';

const VALIDOS: UserFormValues = {
  name: 'Maria Souza',
  email: 'maria@bora.com.br',
  role: 'content-brief-editor',
  password: '',
};

describe('validate', () => {
  it('aceita um cadastro completo, com senha em branco (a API gera)', () => {
    expect(validate(VALIDOS, 'create')).toEqual({});
  });

  it('o nome é obrigatório depois de tirar os espaços e vai até 120 caracteres', () => {
    expect(validate({ ...VALIDOS, name: '   ' }, 'create').name).toBeDefined();
    expect(
      validate({ ...VALIDOS, name: 'a'.repeat(120) }, 'create').name,
    ).toBeUndefined();
    expect(
      validate({ ...VALIDOS, name: 'a'.repeat(121) }, 'create').name,
    ).toBeDefined();
  });

  it('o e-mail é obrigatório e precisa ter formato válido (até 254 caracteres)', () => {
    expect(validate({ ...VALIDOS, email: '' }, 'create').email).toBe(
      'Informe o e-mail.',
    );
    expect(validate({ ...VALIDOS, email: 'sem-arroba' }, 'create').email).toBe(
      'Informe um e-mail válido.',
    );
    expect(
      validate({ ...VALIDOS, email: `${'a'.repeat(250)}@b.co` }, 'create')
        .email,
    ).toBe('Informe um e-mail válido.');
  });

  it('a senha digitada precisa ter de 10 a 128 caracteres', () => {
    expect(
      validate({ ...VALIDOS, password: '123456789' }, 'create').password,
    ).toBeDefined();
    expect(
      validate({ ...VALIDOS, password: '1234567890' }, 'create').password,
    ).toBeUndefined();
    expect(
      validate({ ...VALIDOS, password: 'a'.repeat(128) }, 'create').password,
    ).toBeUndefined();
    expect(
      validate({ ...VALIDOS, password: 'a'.repeat(129) }, 'create').password,
    ).toBeDefined();
  });

  it('na edição só o nome é conferido (e-mail e senha não existem ali)', () => {
    expect(
      validate({ ...VALIDOS, email: 'x', password: 'curta' }, 'edit'),
    ).toEqual({});
    expect(validate({ ...VALIDOS, name: '' }, 'edit').name).toBeDefined();
  });
});

describe('corpos de envio', () => {
  it('o cadastro corta espaços do nome e do e-mail e só manda a senha se foi digitada', () => {
    expect(
      buildCreateBody({ ...VALIDOS, name: ' Maria ', email: ' m@b.co ' }),
    ).toEqual({ name: 'Maria', email: 'm@b.co', role: 'content-brief-editor' });
    expect(buildCreateBody({ ...VALIDOS, password: 'senha-digitada' })).toEqual(
      {
        name: 'Maria Souza',
        email: 'maria@bora.com.br',
        role: 'content-brief-editor',
        password: 'senha-digitada',
      },
    );
  });

  it('a edição manda só o que mudou, mais a versão carregada', () => {
    const origem = buildUser({ id: 'u', name: 'Maria', version: 4 });

    expect(
      buildUpdateBody({ ...valuesOf(origem), name: 'Maria Lima' }, origem),
    ).toEqual({
      name: 'Maria Lima',
      version: 4,
    });
    expect(
      buildUpdateBody(
        { ...valuesOf(origem), role: 'content-brief-viewer' },
        origem,
      ),
    ).toEqual({ role: 'content-brief-viewer', version: 4 });
  });
});

describe('isChanged', () => {
  it('é falso para o estado carregado e verdadeiro depois de qualquer mudança', () => {
    expect(isChanged(EMPTY_VALUES, EMPTY_VALUES)).toBe(false);
    expect(isChanged({ ...EMPTY_VALUES, name: 'x' }, EMPTY_VALUES)).toBe(true);
    expect(isChanged({ ...EMPTY_VALUES, role: 'admin' }, EMPTY_VALUES)).toBe(
      true,
    );
  });
});

describe('errorsFromApi: o erro vai ao lugar certo pelo code', () => {
  const erro = (status: number, code: string, fields?: ApiError['fields']) =>
    new ApiError({ status, code, fields });

  it.each([
    ['EMAIL_ALREADY_REGISTERED', 'email'],
    ['INVALID_EMAIL', 'email'],
    ['INVALID_USER_NAME', 'name'],
    ['WEAK_PASSWORD', 'password'],
    ['LAST_ADMIN', 'role'],
    ['CANNOT_MODIFY_SELF', 'role'],
  ])('%s vai para o campo %s', (code, campo) => {
    const errors = errorsFromApi(erro(409, code));

    expect(Object.keys(errors)).toEqual([campo]);
  });

  it('INVALID_REQUEST distribui as mensagens por campo', () => {
    const errors = errorsFromApi(
      erro(400, 'INVALID_REQUEST', [
        { field: 'email', message: 'e-mail inválido' },
        { field: 'role', message: 'papel desconhecido' },
        { field: 'campoQueNaoExiste', message: 'ignorado' },
      ]),
    );

    expect(errors).toEqual({
      email: 'e-mail inválido',
      role: 'papel desconhecido',
    });
  });

  it('o que não tem lugar no formulário vira o aviso do topo', () => {
    expect(errorsFromApi(erro(500, 'INTERNAL_ERROR')).general).toContain(
      'Algo deu errado',
    );
    expect(errorsFromApi(erro(400, 'INVALID_REQUEST')).general).toBeDefined();
  });
});

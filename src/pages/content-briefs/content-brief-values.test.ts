import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { buildContentBrief } from '@/test/content-briefs-fake';
import {
  buildBody,
  EMPTY_VALUES,
  errorsFromApi,
  isChanged,
  TITLE_REQUIRED_MESSAGE,
  validate,
  valuesOf,
} from './content-brief-values';

describe('validar', () => {
  it('exige título com algo além de espaços', () => {
    expect(validate({ ...EMPTY_VALUES, title: '   ' })).toEqual({
      title: TITLE_REQUIRED_MESSAGE,
    });
    expect(validate({ ...EMPTY_VALUES, title: ' Ok ' })).toEqual({});
  });
});

describe('montarCorpo', () => {
  it('converte o vazio dos controles em null e apara o texto', () => {
    expect(
      buildBody({ ...EMPTY_VALUES, title: '  Arte  ', description: ' x ' }),
    ).toEqual({
      title: 'Arte',
      description: 'x',
      dueDate: null,
      status: 'TODO',
      action: null,
      channel: null,
      estateDevelopmentId: null,
      ownerId: null,
    });
  });

  it('leva todos os campos de uma pauta existente (o PUT substitui)', () => {
    const brief = buildContentBrief({
      id: 'p',
      title: 'T',
      description: 'D',
      dueDate: '2026-12-01',
      status: 'IN_REVIEW',
      action: 'CREATE',
      channel: 'BLOG',
      estateDevelopment: { id: 'e1', name: 'Aurora', active: true },
      owner: { id: 'r1', name: 'Marina', active: false },
    });

    expect(buildBody(valuesOf(brief))).toEqual({
      title: 'T',
      description: 'D',
      dueDate: '2026-12-01',
      status: 'IN_REVIEW',
      action: 'CREATE',
      channel: 'BLOG',
      estateDevelopmentId: 'e1',
      ownerId: 'r1',
    });
  });
});

describe('alterado', () => {
  it('é falso sem mexer e verdadeiro ao mudar qualquer campo', () => {
    const base = valuesOf(buildContentBrief({ id: 'p', title: 'T' }));
    expect(isChanged({ ...base }, base)).toBe(false);
    expect(isChanged({ ...base, channel: 'WEBSITE' }, base)).toBe(true);
    expect(isChanged({ ...base, estateDevelopmentId: 'e1' }, base)).toBe(true);
  });
});

describe('errosDaApi', () => {
  it('leva os fields do 400 para o campo correspondente', () => {
    const erro = new ApiError({
      status: 400,
      code: 'INVALID_REQUEST',
      fields: [{ field: 'dueDate', message: 'Data inválida.' }],
    });
    expect(errorsFromApi(erro)).toEqual({ dueDate: 'Data inválida.' });
  });

  it('leva códigos de domínio para o campo e o resto para o geral', () => {
    const indisponivel = new ApiError({
      status: 400,
      code: 'ESTATE_DEVELOPMENT_UNAVAILABLE',
    });
    expect(errorsFromApi(indisponivel).estateDevelopmentId).toMatch(
      /arquivado/,
    );

    const interno = new ApiError({ status: 500, code: 'INTERNAL_ERROR' });
    expect(errorsFromApi(interno).general).toMatch(/Algo deu errado/);
  });
});

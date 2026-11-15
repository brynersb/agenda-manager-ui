import { describe, expect, it } from 'vitest';

import { initial, removeAccents } from './text';

describe('semAcento', () => {
  it('remove acentos e passa para minúsculas para a busca ignorar acentuação', () => {
    expect(removeAccents('João Açaí ÓTIMO')).toBe('joao acai otimo');
  });

  it('mantém texto sem acento intacto (exceto caixa)', () => {
    expect(removeAccents('Residencial Bora 2')).toBe('residencial bora 2');
  });

  it('aceita texto vazio', () => {
    expect(removeAccents('')).toBe('');
  });
});

describe('inicial', () => {
  it('devolve a primeira letra em maiúscula', () => {
    expect(initial('maria souza')).toBe('M');
  });

  it('ignora espaços no começo do nome', () => {
    expect(initial('  álvaro')).toBe('Á');
  });

  it('devolve "?" quando não há nome', () => {
    expect(initial('   ')).toBe('?');
    expect(initial('')).toBe('?');
  });
});

import { describe, expect, it } from 'vitest';

import { formatLongDate } from './date';

describe('dataPorExtenso', () => {
  it('escreve dia da semana, dia, mês e ano em pt-BR', () => {
    expect(formatLongDate(new Date(2026, 10, 14))).toBe(
      'sábado, 14 de novembro de 2026',
    );
  });
});

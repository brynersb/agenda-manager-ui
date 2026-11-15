import { describe, expect, it, vi } from 'vitest';

import { dueDateShortcut, formatDueDate, relativeText } from './due-date';

describe('formatarPrazo', () => {
  it('mostra dia da semana, dia e mês abreviados, sem o ano do ano corrente', () => {
    expect(formatDueDate('2026-11-14', '2026-11-14')).toBe('sáb 14 nov');
    expect(formatDueDate('2026-11-16', '2026-11-14')).toBe('seg 16 nov');
  });

  it('não zera à esquerda o dia do mês', () => {
    expect(formatDueDate('2026-12-03', '2026-11-14')).toBe('qui 3 dez');
  });

  it('inclui o ano quando difere do ano de hoje (virada de ano)', () => {
    expect(formatDueDate('2027-01-04', '2026-12-30')).toBe('seg 4 jan 2027');
    expect(formatDueDate('2025-12-31', '2026-01-01')).toBe('qua 31 dez 2025');
  });

  it('omite o ano quando hoje ainda não é conhecido', () => {
    expect(formatDueDate('2027-01-04')).toBe('seg 4 jan');
  });

  it('cobre todos os dias da semana e meses sem depender do fuso', () => {
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    for (let i = 0; i < 7; i++) {
      const dia = String(1 + i).padStart(2, '0');
      expect(formatDueDate(`2026-02-${dia}`, '2026-02-01')).toMatch(
        new RegExp(`^${days[(0 + i) % 7]} ${1 + i} fev$`),
      );
    }
    expect(formatDueDate('2026-01-15', '2026-01-01')).toContain('jan');
    expect(formatDueDate('2026-09-15', '2026-01-01')).toContain('set');
  });

  it('devolve vazio para texto que não é data', () => {
    expect(formatDueDate('amanhã')).toBe('');
    expect(formatDueDate('')).toBe('');
  });
});

describe('textoRelativo', () => {
  it('usa singular para 1 dia de atraso e plural para os demais', () => {
    expect(relativeText(-1)).toBe('Atrasada 1 dia');
    expect(relativeText(-2)).toBe('Atrasada 2 dias');
    expect(relativeText(-30)).toBe('Atrasada 30 dias');
  });

  it('trata as fronteiras hoje e amanhã', () => {
    expect(relativeText(0)).toBe('Hoje');
    expect(relativeText(1)).toBe('Amanhã');
  });

  it('usa "Em N dias" a partir de 2 dias', () => {
    expect(relativeText(2)).toBe('Em 2 dias');
    expect(relativeText(5)).toBe('Em 5 dias');
    expect(relativeText(8)).toBe('Em 8 dias');
  });
});

describe('atalhoPrazo', () => {
  it('calcula hoje, amanhã e + 1 semana no calendário local', () => {
    const agora = new Date(2026, 10, 14, 10, 30);
    expect(dueDateShortcut(0, agora)).toBe('2026-11-14');
    expect(dueDateShortcut(1, agora)).toBe('2026-11-15');
    expect(dueDateShortcut(7, agora)).toBe('2026-11-21');
  });

  it('atravessa fim de mês e de ano sem pular dia', () => {
    const agora = new Date(2026, 11, 28, 9, 0);
    expect(dueDateShortcut(7, agora)).toBe('2027-01-04');
  });

  it('usa o dia local mesmo perto da meia-noite', () => {
    const agora = new Date(2026, 10, 14, 23, 59);
    expect(dueDateShortcut(0, agora)).toBe('2026-11-14');
    expect(dueDateShortcut(1, agora)).toBe('2026-11-15');
  });

  it('devolve campo vazio em "Sem prazo"', () => {
    expect(dueDateShortcut(null)).toBe('');
  });

  it('usa o relógio do sistema quando não recebe a data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 28, 12, 0));
    try {
      expect(dueDateShortcut(1)).toBe('2026-03-01');
    } finally {
      vi.useRealTimers();
    }
  });
});

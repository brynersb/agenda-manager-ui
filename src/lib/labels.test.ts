import { describe, expect, it } from 'vitest';

import {
  ACTION_LABEL,
  ACTION_ORDER,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  DUE_STATUS_LABEL,
  OPEN_DUE_STATUSES,
  QUICK_FILTERS,
  ROLE_LABEL,
  ROLE_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  USER_STATUS_FILTERS,
  USER_STATUS_LABEL,
} from './labels';

describe('rótulos de pauta', () => {
  it('rotula cada status na ordem do quadro', () => {
    expect(STATUS_ORDER.map((s) => STATUS_LABEL[s])).toEqual([
      'A fazer',
      'Em andamento',
      'Em revisão',
      'Concluída',
    ]);
  });

  it('rotula as ações na ordem do protótipo', () => {
    expect(ACTION_ORDER.map((a) => ACTION_LABEL[a])).toEqual([
      'Cobrar',
      'Desenvolver',
      'Pagamento',
      'Criar',
      'Acompanhar',
      'Analisar',
    ]);
  });

  it('rotula os canais com acentuação do protótipo', () => {
    expect(CHANNEL_ORDER.map((c) => CHANNEL_LABEL[c])).toEqual([
      'Instagram',
      'E-mail',
      'Blog',
      'Anúncios',
      'Vídeo',
      'Site',
      'Relatório',
      'Outro',
    ]);
    expect(CHANNEL_LABEL.EMAIL).toBe('E-mail');
  });

  it('ordena os grupos de pautas abertas e deixa concluída de fora', () => {
    expect(OPEN_DUE_STATUSES.map((s) => DUE_STATUS_LABEL[s])).toEqual([
      'Atrasadas',
      'Hoje',
      'Próximos 7 dias',
      'Mais adiante',
      'Sem prazo definido',
    ]);
    expect(OPEN_DUE_STATUSES).not.toContain('completed');
    expect(DUE_STATUS_LABEL.completed).toBe('Concluídas');
  });

  it('lista os filtros rápidos na ordem dos chips', () => {
    expect(QUICK_FILTERS.map((f) => f.label)).toEqual([
      'Todas',
      'Atrasadas',
      'Próximos 7 dias',
      'Concluídas',
    ]);
  });
});

describe('rótulos de usuário', () => {
  it('rotula os três papéis, do mais ao menos privilegiado', () => {
    expect(ROLE_ORDER.map((r) => ROLE_LABEL[r])).toEqual([
      'Administrador',
      'Editor',
      'Leitor',
    ]);
  });

  it('rotula a situação e oferece Todos, Ativos e Desativados', () => {
    expect(USER_STATUS_LABEL).toEqual({
      ACTIVE: 'Ativo',
      DEACTIVATED: 'Desativado',
    });
    expect(USER_STATUS_FILTERS.map((f) => f.label)).toEqual([
      'Todos',
      'Ativos',
      'Desativados',
    ]);
  });
});

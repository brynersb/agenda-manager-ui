import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ useApi: vi.fn() }));
vi.mock('@/auth/use-auth');

import { PREFERENCES_KEY } from '@/hooks/use-preferences';
import { useApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import type { createAuthMock } from '@/test/auth-mock';
import {
  buildContentBrief,
  createContentBriefsApiFake,
} from '@/test/content-briefs-fake';
import { renderWithProviders } from '@/test/render-with-providers';
import type { ContentBriefResponse } from '@/types/content-brief';
import {
  BRIEF_CHANGED_MESSAGE,
  ContentBriefsPage,
} from './content-briefs-page';

const REGISTRIES = {
  'estate-developments': [
    {
      id: 'e1',
      name: 'Residencial Aurora',
      active: true,
      version: 1,
      openContentBriefs: 1,
    },
    {
      id: 'e2',
      name: 'Edifício Antigo',
      active: false,
      version: 1,
      openContentBriefs: 0,
    },
  ],
  owners: [
    {
      id: 'r1',
      name: 'Marina',
      active: true,
      version: 1,
      openContentBriefs: 1,
    },
  ],
};

function Local() {
  const { search } = useLocation();
  return <output data-testid="url">{search}</output>;
}

function montar(
  briefs: ContentBriefResponse[],
  {
    route = '/content-briefs',
    auth = {},
    failures = {},
  }: {
    route?: string;
    auth?: Parameters<typeof createAuthMock>[0];
    failures?: Record<string, ApiError>;
  } = {},
) {
  const fake = createContentBriefsApiFake(briefs, failures);
  const api = {
    ...fake.api,
    get: vi.fn((path: string, options?: never) =>
      path in REGISTRIES
        ? { json: async () => REGISTRIES[path as keyof typeof REGISTRIES] }
        : fake.api.get(path, options),
    ),
  };
  vi.mocked(useApi).mockReturnValue(
    api as unknown as ReturnType<typeof useApi>,
  );

  const utils = renderWithProviders(
    <>
      <ContentBriefsPage />
      <Local />
    </>,
    { route, auth },
  );
  return { ...utils, ...fake };
}

const url = () => screen.getByTestId('url').textContent;

const BRIEFS = [
  buildContentBrief({ id: 'atr', title: 'Cobrar vídeo', dueInDays: -3 }),
  buildContentBrief({ id: 'hoje', title: 'Subir banner', dueInDays: 0 }),
  buildContentBrief({ id: 'sem', title: 'Ideia solta', dueInDays: null }),
  buildContentBrief({ id: 'prox', title: 'Post da semana', dueInDays: 5 }),
  buildContentBrief({
    id: 'longe',
    title: 'Campanha de dezembro',
    dueInDays: 40,
  }),
  buildContentBrief({
    id: 'ok',
    title: 'Relatório de outubro',
    dueInDays: -10,
    status: 'DONE',
  }),
];

describe('<PautasPage />', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('agrupa as abertas por situação, na ordem certa, e esconde grupos vazios', async () => {
    montar(BRIEFS.filter((p) => p.id !== 'prox'));

    await screen.findByRole('heading', { name: /Atrasadas/ });
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent?.replace(/\d+$/, '').trim());
    expect(titles).toEqual([
      'Atrasadas',
      'Hoje',
      'Mais adiante',
      'Sem prazo definido',
    ]);
    expect(
      screen.getByText('Concluídas', { selector: 'summary' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: /Próximos 7 dias/ }),
    ).toBeNull();
  });

  it('mostra prazo formatado e relativo: atrasada, hoje e sem prazo', async () => {
    montar(BRIEFS);

    const overdue = (await screen.findByText('Cobrar vídeo')).closest(
      'article',
    );
    expect(
      within(overdue as HTMLElement).getByText('Atrasada 3 dias'),
    ).toBeVisible();
    expect(
      within(overdue as HTMLElement).getByText('qua 11 nov'),
    ).toBeVisible();

    const hoje = screen.getByText('Subir banner').closest('article');
    expect(within(hoje as HTMLElement).getByText('Hoje')).toHaveClass('bg-hl');

    const sem = screen.getByText('Ideia solta').closest('article');
    expect(within(sem as HTMLElement).getByText('Sem prazo')).toBeVisible();
  });

  it('consulta as concluídas só ao abrir o grupo', async () => {
    const { calls } = montar(BRIEFS);
    const user = userEvent.setup();

    await screen.findByText('Cobrar vídeo');
    expect(calls.some((c) => c.params.dueStatus === 'completed')).toBe(false);
    expect(screen.queryByText('Relatório de outubro')).toBeNull();

    await user.click(screen.getByText('Concluídas', { selector: 'summary' }));

    expect(await screen.findByText('Relatório de outubro')).toBeInTheDocument();
    expect(calls.some((c) => c.params.dueStatus === 'completed')).toBe(true);
  });

  it('mostra os chips com contagem e Atrasadas em vermelho quando há atrasos', async () => {
    montar(BRIEFS);

    const todas = await screen.findByRole('button', { name: /^Todas 6$/ });
    expect(todas).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Atrasadas 1$/ })).toHaveClass(
      'text-late',
    );
    expect(
      screen.getByRole('button', { name: /^Próximos 7 dias 2$/ }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /^Concluídas 1$/ }),
    ).toBeVisible();
  });

  it('não pinta Atrasadas de vermelho sem pautas atrasadas', async () => {
    montar([buildContentBrief({ id: 'a', dueInDays: 3 })]);

    const chip = await screen.findByRole('button', { name: /^Atrasadas 0$/ });
    expect(chip).not.toHaveClass('text-late');
  });

  it('com o chip Concluídas, mostra o grupo aberto e não consulta as abertas', async () => {
    const { calls } = montar(BRIEFS, {
      route: '/content-briefs?dueStatus=completed',
    });

    expect(await screen.findByText('Relatório de outubro')).toBeVisible();
    expect(screen.queryByText('Cobrar vídeo')).toBeNull();
    expect(
      calls.some((c) => String(c.params.dueStatus).includes('overdue')),
    ).toBe(false);
  });

  it('manda o chip escolhido para a URL e guarda a preferência', async () => {
    montar(BRIEFS);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /^Atrasadas/ }));

    expect(url()).toContain('dueStatus=overdue');
    expect(screen.getByText('Cobrar vídeo')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Subir banner')).toBeNull());
    expect(
      JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}')
        .dueStatus,
    ).toBe('overdue');
  });

  it('manda empreendimento, responsável e ação para a URL', async () => {
    montar(BRIEFS);
    const user = userEvent.setup();
    await screen.findByText('Cobrar vídeo');

    await user.click(screen.getByRole('combobox', { name: 'Empreendimento' }));
    await user.click(
      await screen.findByRole('option', { name: 'Sem empreendimento' }),
    );
    expect(url()).toContain('estateDevelopmentId=none');

    await user.click(screen.getByRole('combobox', { name: 'Ação' }));
    await user.click(await screen.findByRole('option', { name: 'Cobrar' }));
    expect(url()).toContain('action=CHASE');
  });

  it('lista arquivados marcados nos selects de empreendimento', async () => {
    montar(BRIEFS);
    const user = userEvent.setup();
    await screen.findByText('Cobrar vídeo');

    await user.click(screen.getByRole('combobox', { name: 'Empreendimento' }));

    expect(
      await screen.findByRole('option', {
        name: 'Edifício Antigo (arquivado)',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'Residencial Aurora' }),
    ).toBeVisible();
  });

  it('busca com debounce de 300 ms e só a partir de 2 caracteres', async () => {
    const { calls } = montar(BRIEFS);
    const user = userEvent.setup();
    await screen.findByText('Cobrar vídeo');

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar pauta' }),
      'b',
    );
    await new Promise((r) => setTimeout(r, 450));
    expect(url()).not.toContain('q=');

    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar pauta' }),
      'an',
    );
    expect(url()).not.toContain('q=');
    await waitFor(() => expect(url()).toContain('q=ban'));
    await waitFor(() =>
      expect(calls.some((c) => c.params.q === 'ban')).toBe(true),
    );
    expect(await screen.findByText('Subir banner')).toBeVisible();
    expect(screen.queryByText('Cobrar vídeo')).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar pauta' }));
    await waitFor(() => expect(url()).not.toContain('q='));
  });

  it('lê a visão e o filtro das preferências quando a URL não traz', async () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ view: 'status', dueStatus: 'next-7-days' }),
    );
    montar(BRIEFS);

    expect(
      await screen.findByRole('heading', { name: /A fazer/ }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Por status' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: /^Próximos 7 dias/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('a URL vence as preferências', async () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ view: 'status', dueStatus: 'next-7-days' }),
    );
    montar(BRIEFS, { route: '/content-briefs?view=dueDate&dueStatus=all' });

    expect(
      await screen.findByRole('heading', { name: /Atrasadas/ }),
    ).toBeVisible();
  });

  it('funciona com o localStorage lançando exceção', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    montar(BRIEFS);
    const user = userEvent.setup();

    expect(await screen.findByText('Cobrar vídeo')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Por status' }));
    expect(
      await screen.findByRole('heading', { name: /A fazer/ }),
    ).toBeVisible();
  });

  it('visão por status mostra 4 colunas e "Nenhuma pauta" nas vazias', async () => {
    montar(BRIEFS, { route: '/content-briefs?view=status' });

    await screen.findByText('Cobrar vídeo');
    const colunas = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent?.replace(/\d+$/, '').trim());
    expect(colunas).toEqual([
      'A fazer',
      'Em andamento',
      'Em revisão',
      'Concluída',
    ]);
    expect(screen.getAllByText('Nenhuma pauta')).toHaveLength(2);
    expect(screen.getByText('Relatório de outubro')).toBeVisible();
  });

  it('abre o editor pela URL ao clicar no título', async () => {
    montar(BRIEFS);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: 'Subir banner' }),
    );

    expect(url()).toContain('brief=hoje');
  });

  describe('permissões', () => {
    it('editor vê "+ Nova pauta", seletor habilitado e botão de cadastros', async () => {
      montar(BRIEFS);
      const user = userEvent.setup();

      await screen.findByText('Cobrar vídeo');
      expect(
        screen.getByRole('button', { name: '+ Nova pauta' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('combobox', { name: 'Status de Cobrar vídeo' }),
      ).toBeEnabled();
      await user.click(
        screen.getByRole('button', {
          name: 'Editar empreendimentos e responsáveis',
        }),
      );
      expect(
        await screen.findByRole('dialog', {
          name: 'Empreendimentos e responsáveis',
        }),
      ).toBeVisible();
    });

    it('leitor não vê "+ Nova pauta" nem o botão de cadastros, e o seletor fica desabilitado', async () => {
      montar(BRIEFS, {
        auth: { permissions: ['content-brief:read', 'registry:read'] },
      });

      await screen.findByText('Cobrar vídeo');
      expect(screen.queryByRole('button', { name: '+ Nova pauta' })).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: 'Editar empreendimentos e responsáveis',
        }),
      ).toBeNull();
      expect(
        screen.getByRole('combobox', { name: 'Status de Cobrar vídeo' }),
      ).toBeDisabled();
    });

    it('sem registry:read não consulta cadastros', async () => {
      const { api } = montar(BRIEFS, {
        auth: { permissions: ['content-brief:read'] },
      });

      await screen.findByText('Cobrar vídeo');
      expect(
        api.get.mock.calls.some(([c]) => c === 'estate-developments'),
      ).toBe(false);
    });
  });

  describe('estados vazios, carregando e erro', () => {
    it('sem nenhuma pauta: "Nenhuma pauta cadastrada" com Nova pauta para quem escreve', async () => {
      montar([]);

      expect(await screen.findByText('Nenhuma pauta cadastrada')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Nova pauta' })).toBeVisible();
    });

    it('sem nenhuma pauta e sem permissão de escrita: sem botão Nova pauta', async () => {
      montar([], { auth: { permissions: ['content-brief:read'] } });

      expect(await screen.findByText('Nenhuma pauta cadastrada')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Nova pauta' })).toBeNull();
    });

    it('filtro sem resultado: "Nenhuma pauta encontrada" e Limpar filtros restaura a lista', async () => {
      montar(BRIEFS, {
        route: '/content-briefs?action=CHASE&dueStatus=overdue',
      });
      const user = userEvent.setup();

      expect(await screen.findByText('Nenhuma pauta encontrada')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

      expect(await screen.findByText('Cobrar vídeo')).toBeVisible();
      expect(url()).not.toContain('action=');
    });

    it('mostra "Carregando pautas…" enquanto o resumo não chega', () => {
      vi.mocked(useApi).mockReturnValue({
        get: () => ({ json: () => new Promise(() => {}) }),
      } as unknown as ReturnType<typeof useApi>);
      renderWithProviders(<ContentBriefsPage />, {
        route: '/content-briefs',
        auth: {},
      });

      expect(screen.getByText('Carregando pautas…')).toBeVisible();
    });

    it('mostra o erro com "Tentar de novo" quando o resumo falha', async () => {
      const erro = new ApiError({ status: 500, code: 'INTERNAL_ERROR' });
      const { calls } = montar(BRIEFS, {
        failures: { 'GET content-briefs/summary': erro },
      });
      const user = userEvent.setup();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo deu errado do nosso lado',
      );
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

      expect(await screen.findByText('Cobrar vídeo')).toBeVisible();
      expect(
        calls.filter((c) => c.path === 'content-briefs/summary').length,
      ).toBe(2);
    });
  });

  describe('item', () => {
    it('marca empreendimento e responsável arquivados e mostra ação e canal', async () => {
      montar([
        buildContentBrief({
          id: 'x',
          title: 'Pauta antiga',
          estateDevelopment: {
            id: 'e2',
            name: 'Edifício Antigo',
            active: false,
          },
          owner: { id: 'r9', name: 'Carlos', active: false },
          action: 'CREATE',
          channel: 'EMAIL',
          description: 'Texto longo',
        }),
      ]);

      const item = (await screen.findByText('Pauta antiga')).closest('article');
      const dentro = within(item as HTMLElement);
      expect(dentro.getByText('Edifício Antigo (arquivado)')).toBeVisible();
      expect(dentro.getByText(/Carlos \(arquivado\)/)).toBeVisible();
      expect(dentro.getByText('Criar')).toBeVisible();
      expect(dentro.getByText('E-mail')).toBeVisible();
      expect(dentro.getByText('Texto longo')).toBeVisible();
    });

    it('item concluído fica em muted e sem prazo relativo', async () => {
      montar(BRIEFS, { route: '/content-briefs?dueStatus=completed' });

      const item = (await screen.findByText('Relatório de outubro')).closest(
        'article',
      );
      expect(
        within(item as HTMLElement).getByRole('button', {
          name: 'Relatório de outubro',
        }),
      ).toHaveClass('text-muted');
      expect(within(item as HTMLElement).queryByText(/Atrasada/)).toBeNull();
    });
  });

  describe('troca de status', () => {
    it('envia a version, atualiza a tela e devolve o foco ao seletor', async () => {
      const { patches } = montar([
        buildContentBrief({
          id: 'a',
          title: 'Pauta A',
          dueInDays: 3,
          version: 7,
        }),
      ]);
      const user = userEvent.setup();

      const seletor = await screen.findByRole('combobox', {
        name: 'Status de Pauta A',
      });
      await user.selectOptions(seletor, 'IN_PROGRESS');

      await waitFor(() =>
        expect(patches).toEqual([
          { id: 'a', status: 'IN_PROGRESS', version: 7 },
        ]),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'Status de Pauta A' }),
        ).toHaveValue('IN_PROGRESS'),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'Status de Pauta A' }),
        ).toHaveFocus(),
      );
    });

    it('ao concluir, a pauta sai do grupo aberto e as contagens mudam', async () => {
      montar([buildContentBrief({ id: 'a', title: 'Pauta A', dueInDays: 3 })]);
      const user = userEvent.setup();

      await user.selectOptions(
        await screen.findByRole('combobox', { name: 'Status de Pauta A' }),
        'DONE',
      );

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /^Concluídas 1$/ }),
        ).toBeVisible(),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('heading', { name: /Próximos 7 dias/ }),
        ).toBeNull(),
      );
    });

    it('409: desfaz, mostra o aviso de pauta alterada e recarrega a lista', async () => {
      montar([buildContentBrief({ id: 'a', title: 'Pauta A', dueInDays: 3 })], {
        failures: {
          'PATCH content-briefs/a/status': new ApiError({
            status: 409,
            code: 'CONTENT_BRIEF_VERSION_OUTDATED',
          }),
        },
      });
      const user = userEvent.setup();

      await user.selectOptions(
        await screen.findByRole('combobox', { name: 'Status de Pauta A' }),
        'IN_REVIEW',
      );

      expect(await screen.findByText(BRIEF_CHANGED_MESSAGE)).toBeVisible();
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'Status de Pauta A' }),
        ).toHaveValue('TODO'),
      );
    });

    it('outro erro: desfaz e mostra a mensagem do code', async () => {
      montar([buildContentBrief({ id: 'a', title: 'Pauta A', dueInDays: 3 })], {
        failures: {
          'PATCH content-briefs/a/status': new ApiError({
            status: 404,
            code: 'CONTENT_BRIEF_NOT_FOUND',
          }),
        },
      });
      const user = userEvent.setup();

      await user.selectOptions(
        await screen.findByRole('combobox', { name: 'Status de Pauta A' }),
        'IN_REVIEW',
      );

      expect(
        await screen.findByText(/Esta pauta não foi encontrada/),
      ).toBeVisible();
    });
  });
});

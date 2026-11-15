import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  useApi: vi.fn(),
}));
vi.mock('@/auth/use-auth');

import { useAuthContext } from '@/auth/use-auth';
import { APPEARANCE_KEY } from '@/hooks/use-preferences';
import { useApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import type { createAuthMock } from '@/test/auth-mock';
import { renderWithProviders } from '@/test/render-with-providers';
import type { Registry, RegistryKind } from '@/types/registry';
import { RegistriesDrawer } from './registries-drawer';

type Db = Record<RegistryKind, Registry[]>;

function registry(parcial: Partial<Registry> & { id: string }): Registry {
  return {
    name: parcial.id,
    active: true,
    version: 1,
    openContentBriefs: 0,
    ...parcial,
  };
}

/**
 * API em memória que respeita o contrato §5.2: lista (com ou sem arquivados),
 * cria, renomeia, arquiva e reativa. `failures` injeta o erro da próxima chamada
 * que casar com `metodo path`.
 */
function createApiFake(banco: Db, failures: Record<string, ApiError> = {}) {
  const calls: string[] = [];

  function responder(chave: string, produzir: () => unknown) {
    calls.push(chave);
    return {
      json: async () => {
        const falha = failures[chave];
        if (falha) {
          delete failures[chave];
          throw falha;
        }
        return produzir();
      },
    };
  }

  const api = {
    get: vi.fn(
      (
        path: RegistryKind,
        options: { searchParams: { includeArchived: boolean } },
      ) =>
        responder(`GET ${path}`, () =>
          banco[path].filter(
            (c) => c.active || options.searchParams.includeArchived,
          ),
        ),
    ),
    post: vi.fn((path: string, options?: { json: { name: string } }) => {
      const [tipo, id, action] = path.split('/') as [
        RegistryKind,
        string?,
        string?,
      ];
      return responder(`POST ${path}`, () => {
        if (!id) {
          const novo = registry({
            id: `novo-${banco[tipo].length}`,
            name: options?.json.name ?? '',
          });
          banco[tipo].push(novo);
          return novo;
        }
        const alvo = banco[tipo].find((c) => c.id === id);
        if (!alvo) throw new Error('inexistente');
        alvo.active = action === 'reactivate';
        return alvo;
      });
    }),
    patch: vi.fn(
      (path: string, options: { json: { name: string; version: number } }) => {
        const [tipo, id] = path.split('/') as [RegistryKind, string];
        return responder(`PATCH ${path}`, () => {
          const alvo = banco[tipo].find((c) => c.id === id);
          if (!alvo) throw new Error('inexistente');
          alvo.name = options.json.name;
          alvo.version += 1;
          return alvo;
        });
      },
    ),
  };
  vi.mocked(useApi).mockReturnValue(api as never);
  return { api, calls };
}

function initialDb(): Db {
  return {
    'estate-developments': [
      registry({ id: 'e1', name: 'Residencial Ipê', openContentBriefs: 3 }),
      registry({ id: 'e2', name: 'Jardim das Águas', openContentBriefs: 0 }),
      registry({ id: 'e3', name: 'Antigo Mirante', active: false }),
    ],
    owners: [],
  };
}

function abrir(auth?: Parameters<typeof createAuthMock>[0]) {
  return renderWithProviders(<RegistriesDrawer open onOpenChange={vi.fn()} />, {
    auth: auth ?? {},
  });
}

function secao(name: string) {
  return within(screen.getByRole('region', { name: name }));
}

describe('CadastrosDrawer', () => {
  beforeEach(() => {
    vi.mocked(useApi).mockReset();
    vi.mocked(useAuthContext).mockReset();
  });

  it('lista os ativos de cada seção e mostra "Nenhum cadastrado ainda." quando vazia', async () => {
    createApiFake(initialDb());
    abrir();

    expect(
      screen.getByRole('dialog', { name: 'Empreendimentos e responsáveis' }),
    ).toBeVisible();
    expect(
      await secao('Empreendimentos').findByText('Residencial Ipê'),
    ).toBeVisible();
    expect(
      secao('Empreendimentos').getByText('Jardim das Águas'),
    ).toBeVisible();
    expect(secao('Empreendimentos').queryByText('Antigo Mirante')).toBeNull();
    expect(
      await secao('Responsáveis').findByText('Nenhum cadastrado ainda.'),
    ).toBeVisible();
  });

  it('adiciona um nome com Enter e o mostra na lista', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    const campo = await screen.findByPlaceholderText('Nome da pessoa');
    await user.type(campo, 'Ana Souza{Enter}');

    expect(await secao('Responsáveis').findByText('Ana Souza')).toBeVisible();
    expect(api.post).toHaveBeenCalledWith('owners', {
      json: { name: 'Ana Souza' },
    });
    expect(campo).toHaveValue('');
  });

  it('mostra o erro de duplicado no campo de adicionar', async () => {
    const user = userEvent.setup();
    createApiFake(initialDb(), {
      'POST estate-developments': new ApiError({
        status: 409,
        code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      }),
    });
    abrir();

    await user.type(
      await screen.findByPlaceholderText('Nome do empreendimento'),
      'residencial ipe{Enter}',
    );

    expect(
      await secao('Empreendimentos').findByRole('alert'),
    ).toHaveTextContent('Já existe um empreendimento com este nome.');
  });

  it('renomeia inline enviando a version lida na lista', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Renomear Jardim das Águas' }),
    );
    const campo = screen.getByRole('textbox', {
      name: 'Novo nome de Jardim das Águas',
    });
    await user.clear(campo);
    await user.type(campo, 'Jardim das Flores');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Jardim das Flores')).toBeVisible();
    expect(api.patch).toHaveBeenCalledWith('estate-developments/e2', {
      json: { name: 'Jardim das Flores', version: 1 },
    });
  });

  it('cancelar a edição não chama a API', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Renomear Jardim das Águas' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByText('Jardim das Águas')).toBeVisible();
  });

  it('Esc no campo de renomear cancela só a edição, sem fechar o painel', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    const onOpenChange = vi.fn();
    renderWithProviders(<RegistriesDrawer open onOpenChange={onOpenChange} />, {
      auth: {},
    });

    await user.click(
      await screen.findByRole('button', { name: 'Renomear Jardim das Águas' }),
    );
    await user.keyboard('{Escape}');

    expect(api.patch).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('Jardim das Águas')).toBeVisible();
  });

  it('num conflito de versão avisa, descarta a edição e recarrega a lista', async () => {
    const user = userEvent.setup();
    const banco = initialDb();
    const { calls } = createApiFake(banco, {
      'PATCH estate-developments/e2': new ApiError({
        status: 409,
        code: 'ESTATE_DEVELOPMENT_VERSION_OUTDATED',
      }),
    });
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Renomear Jardim das Águas' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Novo nome de Jardim das Águas' }),
      ' 2',
    );
    banco['estate-developments'][1].name = 'Nome da outra pessoa';
    const listsBefore = calls.filter(
      (c) => c === 'GET estate-developments',
    ).length;
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await secao('Empreendimentos').findByRole('alert'),
    ).toHaveTextContent('Este empreendimento foi alterado por outra pessoa.');
    expect(await screen.findByText('Nome da outra pessoa')).toBeVisible();
    expect(
      calls.filter((c) => c === 'GET estate-developments').length,
    ).toBeGreaterThan(listsBefore);
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  });

  it('arquivar com pautas abertas avisa quantas e arquiva ao confirmar', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Arquivar Residencial Ipê' }),
    );

    const modal = screen.getByRole('dialog', {
      name: 'Arquivar "Residencial Ipê"?',
    });
    expect(modal).toHaveTextContent(
      '3 pautas abertas usam este nome. Elas continuam mostrando o nome depois de arquivar.',
    );

    await user.click(within(modal).getByRole('button', { name: 'Arquivar' }));

    await waitFor(() =>
      expect(
        secao('Empreendimentos').queryByText('Residencial Ipê'),
      ).toBeNull(),
    );
    expect(api.post).toHaveBeenCalledWith('estate-developments/e1/archive');
  });

  it('arquivar sem pautas abertas não fala em pautas e cancelar não arquiva', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Arquivar Jardim das Águas' }),
    );
    const modal = screen.getByRole('dialog', {
      name: 'Arquivar "Jardim das Águas"?',
    });
    expect(modal).not.toHaveTextContent(/pauta/);

    await user.click(within(modal).getByRole('button', { name: 'Cancelar' }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByText('Jardim das Águas')).toBeVisible();
  });

  it('usa o singular com uma única pauta aberta', async () => {
    const user = userEvent.setup();
    const banco = initialDb();
    banco['estate-developments'][1].openContentBriefs = 1;
    createApiFake(banco);
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Arquivar Jardim das Águas' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Arquivar "Jardim das Águas"?' }),
    ).toHaveTextContent(
      '1 pauta aberta usa este nome. Ela continua mostrando o nome depois de arquivar.',
    );
  });

  it('mostra os arquivados sob demanda e permite reativar', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await screen.findByText('Residencial Ipê');
    await user.click(
      within(screen.getByRole('region', { name: 'Empreendimentos' })).getByRole(
        'checkbox',
        { name: 'Mostrar arquivados' },
      ),
    );

    expect(await screen.findByText('Antigo Mirante')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Reativar Antigo Mirante' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Reativar Antigo Mirante' }),
      ).toBeNull(),
    );
    expect(api.post).toHaveBeenCalledWith('estate-developments/e3/reactivate');
    expect(
      secao('Empreendimentos').getByRole('button', {
        name: 'Arquivar Antigo Mirante',
      }),
    ).toBeVisible();
  });

  it('sem registry:write mostra só a leitura, sem ações nem campo de adicionar', async () => {
    createApiFake(initialDb());
    abrir({ permissions: ['content-brief:read', 'registry:read'] });

    expect(await screen.findByText('Residencial Ipê')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Renomear/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Arquivar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Adicionar' })).toBeNull();
    expect(screen.queryByPlaceholderText('Nome da pessoa')).toBeNull();
  });
});

describe.each([
  'modal',
  'drawer',
] as const)('cadastros apresentados como %s', (presentation) => {
  beforeEach(() => {
    vi.mocked(useApi).mockReset();
    vi.mocked(useAuthContext).mockReset();
    window.localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ uiTheme: 'soft', formPresentation: presentation }),
    );
  });
  afterEach(() => window.localStorage.clear());

  it('abre no formato escolhido e lista empreendimentos e responsáveis', async () => {
    createApiFake(initialDb());
    abrir();

    expect(
      screen.getByRole('dialog', { name: 'Empreendimentos e responsáveis' }),
    ).toHaveAttribute('data-form-presentation', presentation);
    expect(
      await secao('Empreendimentos').findByText('Residencial Ipê'),
    ).toBeVisible();
  });

  it('Esc no campo de renomear cancela só a edição; Esc fora dele fecha', async () => {
    const user = userEvent.setup();
    createApiFake(initialDb());
    const onOpenChange = vi.fn();
    renderWithProviders(<RegistriesDrawer open onOpenChange={onOpenChange} />, {
      auth: {},
    });

    await user.click(
      await screen.findByRole('button', { name: 'Renomear Residencial Ipê' }),
    );
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Novo nome de Residencial Ipê')).toBeNull();

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('arquivar pede confirmação num modal por cima e usa o nome do cadastro', async () => {
    const user = userEvent.setup();
    const { api } = createApiFake(initialDb());
    abrir();

    await user.click(
      await screen.findByRole('button', { name: 'Arquivar Jardim das Águas' }),
    );
    const confirmacao = await screen.findByRole('dialog', {
      name: 'Arquivar "Jardim das Águas"?',
    });
    expect(api.post).not.toHaveBeenCalledWith('estate-developments/e2/archive');

    await user.click(
      within(confirmacao).getByRole('button', { name: 'Arquivar' }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('estate-developments/e2/archive'),
    );
  });

  it('sem registry:write mostra só a consulta, sem ações de escrita', async () => {
    createApiFake(initialDb());
    abrir({ permissions: ['registry:read'] });

    expect(
      await secao('Empreendimentos').findByText('Residencial Ipê'),
    ).toBeVisible();
    expect(
      screen.getByText('Você pode consultar os cadastros, mas não alterá-los.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Renomear/ })).toBeNull();
    expect(screen.queryByPlaceholderText('Nome do empreendimento')).toBeNull();
  });
});

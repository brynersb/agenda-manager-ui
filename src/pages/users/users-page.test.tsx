import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ useApi: vi.fn() }));
vi.mock('@/auth/use-auth');

import { useApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import type { createAuthMock } from '@/test/auth-mock';
import { renderWithProviders } from '@/test/render-with-providers';
import {
  buildUser,
  createUsersApiFake,
  GENERATED_PASSWORD,
} from '@/test/users-fake';
import type { User } from '@/types/user';
import { USER_CONFLICT_MESSAGE } from './user-form-dialog';
import { UsersPage } from './users-page';

const ADMIN_ID = 'admin-1';
const ADMIN_PERMISSIONS = [
  'content-brief:read',
  'user:read',
  'user:write',
] as const;

const ME = buildUser({
  id: ADMIN_ID,
  name: 'Ana Admin',
  email: 'ana@pauta.local',
  role: 'admin',
});
const MARIA = buildUser({
  id: 'maria',
  name: 'Maria Souza',
  email: 'maria@bora.com.br',
  role: 'content-brief-editor',
});
const LEO = buildUser({
  id: 'leo',
  name: 'Leo Leitor',
  email: 'leo@bora.com.br',
  role: 'content-brief-viewer',
  status: 'DEACTIVATED',
  lastLoginAt: null,
});

function montar(
  users: User[] = [ME, MARIA, LEO],
  {
    auth = {},
    failures = {},
  }: {
    auth?: Parameters<typeof createAuthMock>[0];
    failures?: Record<string, ApiError>;
  } = {},
) {
  const fake = createUsersApiFake(users, ADMIN_ID, failures);
  vi.mocked(useApi).mockReturnValue(
    fake.api as unknown as ReturnType<typeof useApi>,
  );
  renderWithProviders(<UsersPage />, {
    route: '/users',
    auth: {
      userId: ADMIN_ID,
      name: 'Ana Admin',
      role: 'admin',
      permissions: [...ADMIN_PERMISSIONS],
      ...auth,
    },
  });
  return fake;
}

const SOMENTE_LEITURA = {
  permissions: ['content-brief:read', 'user:read'] as never,
};

const linha = (nome: string) =>
  screen.getByRole('row', { name: new RegExp(nome) });

async function abrirAcoes(nome: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: `Ações de ${nome}` }),
  );
}

async function escolher(item: string) {
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

describe('<UsersPage />', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('lista', () => {
    it('mostra nome, e-mail, papel, situação em pílula e último acesso de cada usuário', async () => {
      montar();

      const maria = within(
        await screen.findByRole('row', { name: /Maria Souza/ }),
      );
      expect(maria.getByText('maria@bora.com.br')).toBeInTheDocument();
      expect(maria.getByText('Editor')).toBeInTheDocument();
      expect(maria.getByText('Ativo')).toBeInTheDocument();
      expect(maria.getByText(/14\/11\/2026/)).toBeInTheDocument();

      const leo = within(linha('Leo Leitor'));
      expect(leo.getByText('Leitor')).toBeInTheDocument();
      expect(leo.getByText('Desativado')).toBeInTheDocument();
      expect(leo.getByText('Nunca acessou')).toBeInTheDocument();
      expect(
        within(linha('Ana Admin')).getByText('Administrador'),
      ).toBeInTheDocument();
    });

    it('marca a linha da própria pessoa logada com "Você"', async () => {
      montar();

      expect(
        within(await screen.findByRole('row', { name: /Ana Admin/ })).getByText(
          'Você',
        ),
      ).toBeInTheDocument();
      expect(within(linha('Maria Souza')).queryByText('Você')).toBeNull();
    });

    it('mostra o bloqueio só enquanto lockedUntil é futuro', async () => {
      const futuro = new Date(Date.now() + 10 * 60_000).toISOString();
      const passado = new Date(Date.now() - 10 * 60_000).toISOString();
      montar([
        ME,
        buildUser({
          id: 'trancado',
          name: 'Tulio Trancado',
          lockedUntil: futuro,
        }),
        buildUser({ id: 'solto', name: 'Sara Solta', lockedUntil: passado }),
      ]);

      expect(
        within(await screen.findByRole('row', { name: /Tulio/ })).getByText(
          /Bloqueado até/,
        ),
      ).toBeInTheDocument();
      expect(within(linha('Sara Solta')).queryByText(/Bloqueado/)).toBeNull();
    });

    it('mostra o carregando, depois a lista', async () => {
      montar();

      expect(screen.getByText('Carregando usuários…')).toBeInTheDocument();
      expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    });

    it('mostra o estado vazio com a ação de cadastrar, para quem pode escrever', async () => {
      montar([]);

      expect(
        await screen.findByText('Nenhum usuário cadastrado'),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: /Novo usuário/ }),
      ).toHaveLength(2);
    });

    it('mostra o erro de carregamento com "Tentar de novo"', async () => {
      const fake = montar([ME], {
        failures: {
          'GET users': new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        },
      });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo deu errado do nosso lado',
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Tentar de novo' }),
      );

      expect(await screen.findByText('Ana Admin')).toBeInTheDocument();
      expect(fake.lists.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('busca, filtro e paginação', () => {
    it('busca por nome ou e-mail só depois de parar de digitar e volta à página 1', async () => {
      const fake = montar();
      await screen.findByText('Maria Souza');

      await userEvent.type(screen.getByLabelText('Buscar usuário'), 'bora');

      await waitFor(() =>
        expect(fake.lists.at(-1)).toMatchObject({ q: 'bora', page: 1 }),
      );
      // Uma consulta só para o termo final, não uma por letra.
      expect(fake.lists.filter((p) => p.q !== undefined)).toHaveLength(1);
      expect(await screen.findByText('Leo Leitor')).toBeInTheDocument();
      expect(screen.queryByText('Ana Admin')).toBeNull();
    });

    it('filtra por situação e manda o status à API', async () => {
      const fake = montar();
      await screen.findByText('Maria Souza');

      await userEvent.click(
        screen.getByRole('button', { name: 'Desativados' }),
      );

      await waitFor(() =>
        expect(fake.lists.at(-1)).toMatchObject({ status: 'DEACTIVATED' }),
      );
      expect(await screen.findByText('Leo Leitor')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText('Maria Souza')).toBeNull());

      await userEvent.click(screen.getByRole('button', { name: 'Todos' }));
      await waitFor(() =>
        expect(fake.lists.at(-1)).not.toHaveProperty('status'),
      );
    });

    it('sem resultado mostra "Nenhum usuário encontrado" e "Limpar filtros" desfaz a busca', async () => {
      montar();
      await screen.findByText('Maria Souza');

      await userEvent.type(screen.getByLabelText('Buscar usuário'), 'zzzz');
      expect(
        await screen.findByText('Nenhum usuário encontrado'),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'Limpar filtros' }),
      );

      expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
      expect(screen.getByLabelText('Buscar usuário')).toHaveValue('');
    });

    it('pagina de 20 em 20, com Anterior e Próxima', async () => {
      const muitos = Array.from({ length: 45 }, (_, i) =>
        buildUser({
          id: `u${String(i).padStart(2, '0')}`,
          name: `Pessoa ${String(i).padStart(2, '0')}`,
        }),
      );
      const fake = montar([ME, ...muitos.slice(0, 44)]);

      expect(
        await screen.findByText(/45 usuários · Página 1 de 3/),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));

      await waitFor(() =>
        expect(fake.lists.at(-1)).toMatchObject({ page: 2, limit: 20 }),
      );
      expect(await screen.findByText(/Página 2 de 3/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    });
  });

  describe('sem user:write (só leitura)', () => {
    it('lista os usuários, sem "Novo usuário" nem ações por linha', async () => {
      montar([ME, MARIA, LEO], { auth: SOMENTE_LEITURA });

      expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Novo usuário/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Ações de/ })).toBeNull();
    });

    it('não oferece cadastrar nem no estado vazio', async () => {
      montar([], { auth: SOMENTE_LEITURA });

      await screen.findByText('Nenhum usuário cadastrado');
      expect(screen.queryByRole('button', { name: /Novo usuário/ })).toBeNull();
    });
  });

  describe('Novo usuário', () => {
    async function abrirCadastro() {
      await screen.findByText('Maria Souza');
      await userEvent.click(
        screen.getByRole('button', { name: '+ Novo usuário' }),
      );
      return screen.findByRole('dialog', { name: 'Novo usuário' });
    }

    it('cria sem senha e mostra a provisória UMA vez, com aviso e botão de copiar', async () => {
      const user = userEvent.setup();
      const fake = montar();
      const dialogo = await abrirCadastro();

      await user.type(within(dialogo).getByLabelText(/^Nome/), 'Paulo Novo');
      await user.type(
        within(dialogo).getByLabelText('E-mail'),
        'Paulo@Bora.com.br',
      );
      await user.selectOptions(
        within(dialogo).getByLabelText('Papel'),
        'content-brief-editor',
      );
      await user.click(
        within(dialogo).getByRole('button', { name: 'Criar usuário' }),
      );

      const senha = await screen.findByRole('dialog', {
        name: 'Usuário criado',
      });
      expect(fake.creations).toEqual([
        {
          name: 'Paulo Novo',
          email: 'Paulo@Bora.com.br',
          role: 'content-brief-editor',
        },
      ]);
      expect(within(senha).getByText(GENERATED_PASSWORD)).toBeInTheDocument();
      expect(within(senha).getByRole('alert')).toHaveTextContent(
        'Esta senha não será mostrada de novo.',
      );

      await user.click(
        within(senha).getByRole('button', { name: 'Copiar senha' }),
      );
      expect(await navigator.clipboard.readText()).toBe(GENERATED_PASSWORD);
      expect(
        await within(senha).findByText(/Senha copiada/),
      ).toBeInTheDocument();

      await user.click(within(senha).getByRole('button', { name: 'Concluir' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      // Depois de fechar a senha não está em lugar nenhum da tela.
      expect(screen.queryByText(GENERATED_PASSWORD)).toBeNull();
      expect(await screen.findByText('Paulo Novo')).toBeInTheDocument();
    });

    it('o papel padrão é o de menor privilégio (Leitor)', async () => {
      montar();
      const dialogo = await abrirCadastro();

      expect(within(dialogo).getByLabelText('Papel')).toHaveValue(
        'content-brief-viewer',
      );
    });

    it('com senha digitada não há diálogo de senha: só o aviso de criado', async () => {
      const fake = montar();
      const dialogo = await abrirCadastro();

      await userEvent.type(
        within(dialogo).getByLabelText(/^Nome/),
        'Rita Nova',
      );
      await userEvent.type(
        within(dialogo).getByLabelText('E-mail'),
        'rita@bora.com.br',
      );
      await userEvent.type(
        within(dialogo).getByLabelText(/Senha provisória/),
        'senha-digitada-1',
      );
      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Criar usuário' }),
      );

      expect(await screen.findByText('Usuário criado')).toBeInTheDocument();
      expect(fake.creations[0]).toMatchObject({ password: 'senha-digitada-1' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('e-mail já cadastrado aparece no campo de e-mail e o formulário continua aberto', async () => {
      montar();
      const dialogo = await abrirCadastro();

      await userEvent.type(
        within(dialogo).getByLabelText(/^Nome/),
        'Outra Maria',
      );
      await userEvent.type(
        within(dialogo).getByLabelText('E-mail'),
        'MARIA@bora.com.br',
      );
      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Criar usuário' }),
      );

      expect(
        await within(dialogo).findByText(
          'Já existe um usuário com este e-mail.',
        ),
      ).toBeInTheDocument();
      expect(within(dialogo).getByLabelText('E-mail')).toHaveFocus();
      expect(within(dialogo).getByLabelText('E-mail')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('valida no cliente: nome, e-mail e tamanho da senha (10 a 128)', async () => {
      const fake = montar();
      const dialogo = await abrirCadastro();

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Criar usuário' }),
      );
      expect(within(dialogo).getByText(/Informe um nome/)).toBeInTheDocument();
      expect(
        within(dialogo).getByText('Informe o e-mail.'),
      ).toBeInTheDocument();

      await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Fulana');
      await userEvent.type(
        within(dialogo).getByLabelText('E-mail'),
        'sem-arroba',
      );
      await userEvent.type(
        within(dialogo).getByLabelText(/Senha provisória/),
        'curta',
      );
      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Criar usuário' }),
      );

      expect(
        within(dialogo).getByText('Informe um e-mail válido.'),
      ).toBeInTheDocument();
      expect(
        within(dialogo).getByText(
          'A senha deve ter entre 10 e 128 caracteres.',
        ),
      ).toBeInTheDocument();
      expect(fake.creations).toHaveLength(0);
    });

    it('fechar com algo digitado pede confirmação; Esc também', async () => {
      montar();
      const dialogo = await abrirCadastro();
      await userEvent.type(within(dialogo).getByLabelText(/^Nome/), 'Rascunho');

      await userEvent.keyboard('{Escape}');

      const aviso = await screen.findByRole('dialog', {
        name: 'Descartar alterações?',
      });
      await userEvent.click(
        within(aviso).getByRole('button', { name: 'Descartar' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('fechar sem digitar nada não pergunta', async () => {
      montar();
      await abrirCadastro();

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });
  });

  describe('Editar', () => {
    it('altera nome e papel enviando só o que mudou e a versão carregada', async () => {
      const fake = montar();
      await abrirAcoes('Maria Souza');
      await escolher('Editar');
      const dialogo = await screen.findByRole('dialog', {
        name: 'Editar usuário',
      });

      expect(within(dialogo).getByLabelText('E-mail')).toBeDisabled();
      expect(within(dialogo).getByLabelText('Papel')).toHaveValue(
        'content-brief-editor',
      );
      expect(
        within(dialogo).getByRole('button', { name: 'Salvar' }),
      ).toBeDisabled();

      const nome = within(dialogo).getByLabelText(/^Nome/);
      await userEvent.clear(nome);
      await userEvent.type(nome, 'Maria Souza Lima');
      await userEvent.selectOptions(
        within(dialogo).getByLabelText('Papel'),
        'content-brief-viewer',
      );
      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Salvar' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(fake.updates).toEqual([
        {
          id: 'maria',
          body: {
            name: 'Maria Souza Lima',
            role: 'content-brief-viewer',
            version: 1,
          },
        },
      ]);
      expect(await screen.findByText('Maria Souza Lima')).toBeInTheDocument();
      expect(screen.getByText('Usuário atualizado')).toBeInTheDocument();
    });

    it('a pessoa logada edita só o nome: o papel fica travado', async () => {
      montar();
      await abrirAcoes('Ana Admin');
      await escolher('Editar');
      const dialogo = await screen.findByRole('dialog', {
        name: 'Editar usuário',
      });

      expect(within(dialogo).getByLabelText('Papel')).toBeDisabled();
      expect(
        within(dialogo).getByText('Você não pode alterar o próprio papel.'),
      ).toBeInTheDocument();
    });

    it('LAST_ADMIN ao rebaixar o último admin aparece no campo do papel', async () => {
      const outroAdmin = buildUser({
        id: 'solo',
        name: 'Admin Solo',
        role: 'admin',
      });
      // Só um admin ativo: o "Solo" (o admin logado, `ME`, fica desativado).
      montar([{ ...ME, status: 'DEACTIVATED' }, outroAdmin]);
      await abrirAcoes('Admin Solo');
      await escolher('Editar');
      const dialogo = await screen.findByRole('dialog', {
        name: 'Editar usuário',
      });

      await userEvent.selectOptions(
        within(dialogo).getByLabelText('Papel'),
        'content-brief-viewer',
      );
      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Salvar' }),
      );

      expect(
        await within(dialogo).findByText(
          /deixaria o sistema sem administrador ativo/,
        ),
      ).toBeInTheDocument();
      expect(within(dialogo).getByLabelText('Papel')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    describe('conflito de versão (409)', () => {
      async function abrirEditorEProvocarConflito() {
        const fake = montar();
        await abrirAcoes('Maria Souza');
        await escolher('Editar');
        const dialogo = await screen.findByRole('dialog', {
          name: 'Editar usuário',
        });
        // Outra pessoa salva antes: a versão no servidor sobe e o nome muda.
        const noServidor = fake.users.find((u) => u.id === 'maria') as User;
        noServidor.version = 2;
        noServidor.name = 'Maria Souza (outra pessoa)';

        const nome = within(dialogo).getByLabelText(/^Nome/);
        await userEvent.clear(nome);
        await userEvent.type(nome, 'Meu texto');
        await userEvent.click(
          within(dialogo).getByRole('button', { name: 'Salvar' }),
        );
        return { fake, dialogo };
      }

      it('mantém o que foi digitado e avisa que outra pessoa alterou', async () => {
        const { dialogo } = await abrirEditorEProvocarConflito();

        expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
          USER_CONFLICT_MESSAGE,
        );
        expect(within(dialogo).getByLabelText(/^Nome/)).toHaveValue(
          'Meu texto',
        );
      });

      it('"Ver versão atual" confirma o descarte, recarrega e salva com a versão nova', async () => {
        const { fake, dialogo } = await abrirEditorEProvocarConflito();
        await within(dialogo).findByRole('alert');

        await userEvent.click(
          within(dialogo).getByRole('button', { name: 'Ver versão atual' }),
        );
        const confirmacao = await screen.findByRole('dialog', {
          name: 'Ver a versão atual?',
        });
        await userEvent.click(
          within(confirmacao).getByRole('button', { name: 'Ver versão atual' }),
        );

        await waitFor(() =>
          expect(within(dialogo).getByLabelText(/^Nome/)).toHaveValue(
            'Maria Souza (outra pessoa)',
          ),
        );
        expect(fake.fetched).toContain('users/maria');
        expect(within(dialogo).queryByText(USER_CONFLICT_MESSAGE)).toBeNull();

        const nome = within(dialogo).getByLabelText(/^Nome/);
        await userEvent.clear(nome);
        await userEvent.type(nome, 'Maria Final');
        await userEvent.click(
          within(dialogo).getByRole('button', { name: 'Salvar' }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(fake.updates.at(-1)?.body.version).toBe(2);
      });

      it('"Continuar editando" esconde o aviso e mantém o texto', async () => {
        const { dialogo } = await abrirEditorEProvocarConflito();
        await within(dialogo).findByRole('alert');

        await userEvent.click(
          within(dialogo).getByRole('button', { name: 'Continuar editando' }),
        );

        expect(within(dialogo).queryByText(USER_CONFLICT_MESSAGE)).toBeNull();
        expect(within(dialogo).getByLabelText(/^Nome/)).toHaveValue(
          'Meu texto',
        );
      });
    });
  });

  describe('Desativar e Reativar', () => {
    it('desativa depois de confirmar', async () => {
      const fake = montar();
      await abrirAcoes('Maria Souza');
      await escolher('Desativar');
      const dialogo = await screen.findByRole('dialog', {
        name: /Desativar "Maria Souza"\?/,
      });
      expect(fake.actions).toEqual([]);

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Desativar' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(fake.actions).toEqual(['deactivate:maria']);
      expect(screen.getByText('Usuário desativado')).toBeInTheDocument();
      expect(
        within(linha('Maria Souza')).getByText('Desativado'),
      ).toBeInTheDocument();
    });

    it('cancelar não faz nada', async () => {
      const fake = montar();
      await abrirAcoes('Maria Souza');
      await escolher('Desativar');
      const dialogo = await screen.findByRole('dialog');

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Cancelar' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(fake.actions).toEqual([]);
    });

    it('reativa um usuário desativado depois de confirmar', async () => {
      const fake = montar();
      await abrirAcoes('Leo Leitor');
      await escolher('Reativar');
      const dialogo = await screen.findByRole('dialog', {
        name: /Reativar "Leo Leitor"\?/,
      });

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Reativar' }),
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(fake.actions).toEqual(['reactivate:leo']);
      expect(screen.getByText('Usuário reativado')).toBeInTheDocument();
    });

    it('LAST_ADMIN explica a regra dentro do modal, que continua aberto', async () => {
      const solo = buildUser({ id: 'solo', name: 'Admin Solo', role: 'admin' });
      montar([{ ...ME, status: 'DEACTIVATED' }, solo]);
      await abrirAcoes('Admin Solo');
      await escolher('Desativar');
      const dialogo = await screen.findByRole('dialog');

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Desativar' }),
      );

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Esta operação deixaria o sistema sem administrador ativo.',
      );
      expect(dialogo).toBeInTheDocument();
    });

    it('CANNOT_MODIFY_SELF aparece no modal se a API barrar (defesa em profundidade)', async () => {
      montar([ME, MARIA], {
        failures: {
          'POST users/maria/deactivate': new ApiError({
            status: 409,
            code: 'CANNOT_MODIFY_SELF',
          }),
        },
      });
      await abrirAcoes('Maria Souza');
      await escolher('Desativar');
      const dialogo = await screen.findByRole('dialog');

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Desativar' }),
      );

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Você não pode desativar nem alterar o papel da sua própria conta.',
      );
    });

    it('a própria linha não oferece desativar nem redefinir senha', async () => {
      montar();
      await abrirAcoes('Ana Admin');

      expect(
        await screen.findByRole('menuitem', { name: 'Editar' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Desativar' })).toBeNull();
      expect(screen.queryByRole('menuitem', { name: 'Reativar' })).toBeNull();
      expect(
        screen.queryByRole('menuitem', { name: 'Redefinir senha' }),
      ).toBeNull();
    });

    it('USER_VERSION_OUTDATED na ação avisa no modal e recarrega a lista', async () => {
      const fake = montar([ME, MARIA], {
        failures: {
          'POST users/maria/deactivate': new ApiError({
            status: 409,
            code: 'USER_VERSION_OUTDATED',
          }),
        },
      });
      await abrirAcoes('Maria Souza');
      await escolher('Desativar');
      const dialogo = await screen.findByRole('dialog');
      const consultas = fake.lists.length;

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Desativar' }),
      );

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Este usuário foi alterado por outra pessoa.',
      );
      await waitFor(() => expect(fake.lists.length).toBeGreaterThan(consultas));
    });
  });

  describe('Redefinir senha', () => {
    it('confirma, redefine e mostra a senha provisória uma única vez', async () => {
      const fake = montar();
      await abrirAcoes('Maria Souza');
      await escolher('Redefinir senha');
      const confirmacao = await screen.findByRole('dialog', {
        name: /Redefinir a senha de "Maria Souza"\?/,
      });
      expect(fake.actions).toEqual([]);

      await userEvent.click(
        within(confirmacao).getByRole('button', { name: 'Redefinir senha' }),
      );

      const senha = await screen.findByRole('dialog', {
        name: 'Senha redefinida',
      });
      expect(fake.actions).toEqual(['reset-password:maria']);
      expect(within(senha).getByText(GENERATED_PASSWORD)).toBeInTheDocument();
      expect(within(senha).getByRole('alert')).toHaveTextContent(
        'não será mostrada de novo',
      );

      await userEvent.click(
        within(senha).getByRole('button', { name: 'Concluir' }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(screen.queryByText(GENERATED_PASSWORD)).toBeNull();
    });

    it('clicar fora do diálogo da senha NÃO o fecha (a senha não é recuperável)', async () => {
      montar();
      await abrirAcoes('Maria Souza');
      await escolher('Redefinir senha');
      const confirmacao = await screen.findByRole('dialog');
      await userEvent.click(
        within(confirmacao).getByRole('button', { name: 'Redefinir senha' }),
      );
      const senha = await screen.findByRole('dialog', {
        name: 'Senha redefinida',
      });

      const fundo = document.querySelector('.bg-scrim');
      expect(fundo).not.toBeNull();
      await userEvent.click(fundo as Element);

      expect(senha).toBeInTheDocument();
      expect(screen.getByText(GENERATED_PASSWORD)).toBeInTheDocument();
    });

    it('falha na redefinição mostra o erro e não exibe senha', async () => {
      montar([ME, MARIA], {
        failures: {
          'POST users/maria/reset-password': new ApiError({
            status: 404,
            code: 'USER_NOT_FOUND',
          }),
        },
      });
      await abrirAcoes('Maria Souza');
      await escolher('Redefinir senha');
      const dialogo = await screen.findByRole('dialog');

      await userEvent.click(
        within(dialogo).getByRole('button', { name: 'Redefinir senha' }),
      );

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
        'Este usuário não foi encontrado.',
      );
      expect(screen.queryByText(GENERATED_PASSWORD)).toBeNull();
    });
  });

  it('o menu de ações é acessível pelo teclado e devolve o foco à linha ao fechar', async () => {
    montar();
    const gatilho = await screen.findByRole('button', {
      name: 'Ações de Maria Souza',
    });
    gatilho.focus();

    // Aberto pelo teclado, o menu já foca o primeiro item ("Editar").
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Enter}');
    const dialogo = await screen.findByRole('dialog', {
      name: 'Editar usuário',
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialogo).not.toBeInTheDocument());

    await waitFor(() => expect(gatilho).toHaveFocus());
  });
});

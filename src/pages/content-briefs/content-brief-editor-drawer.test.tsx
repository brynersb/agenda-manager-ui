import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ useApi: vi.fn() }));
vi.mock('@/auth/use-auth');

import { APPEARANCE_KEY } from '@/hooks/use-preferences';
import { useApi } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import type { createAuthMock } from '@/test/auth-mock';
import {
  buildContentBrief,
  createContentBriefsApiFake,
} from '@/test/content-briefs-fake';
import {
  renderRoutes,
  renderWithProviders,
} from '@/test/render-with-providers';
import type { ContentBriefResponse } from '@/types/content-brief';
import type { Registry, RegistryKind } from '@/types/registry';
import {
  BRIEF_NOT_FOUND_MESSAGE,
  CONFLICT_MESSAGE,
  ContentBriefEditorDrawer,
} from './content-brief-editor-drawer';
import { ContentBriefsPage } from './content-briefs-page';

function registry(parcial: Partial<Registry> & { id: string }): Registry {
  return {
    name: parcial.id,
    active: true,
    version: 1,
    openContentBriefs: 0,
    ...parcial,
  };
}

function createDb(): Record<RegistryKind, Registry[]> {
  return {
    'estate-developments': [
      registry({ id: 'e1', name: 'Residencial Aurora' }),
      registry({ id: 'e2', name: 'Edifício Antigo', active: false }),
    ],
    owners: [registry({ id: 'r1', name: 'Marina' })],
  };
}

function fullBrief(): ContentBriefResponse {
  return buildContentBrief({
    id: 'p1',
    title: 'Cobrar vídeo',
    description: 'Detalhes do vídeo',
    dueDate: '2026-11-20',
    status: 'IN_PROGRESS',
    action: 'CHASE',
    channel: 'VIDEO',
    estateDevelopment: { id: 'e1', name: 'Residencial Aurora', active: true },
    owner: { id: 'r1', name: 'Marina', active: true },
    version: 3,
  });
}

interface Opcoes {
  briefs?: ContentBriefResponse[];
  auth?: Parameters<typeof createAuthMock>[0];
  failures?: Record<string, ApiError>;
  route?: string;
}

/** Pautas fake + registries em memória (lista, com arquivados, e criação). */
function prepareApi({ briefs = [], failures = {} }: Opcoes) {
  const banco = createDb();
  const fake = createContentBriefsApiFake(briefs, failures);
  const api = {
    ...fake.api,
    get: vi.fn((path: string, options?: never) => {
      if (path in banco) {
        const incluir = (
          options as unknown as { searchParams: { includeArchived: boolean } }
        ).searchParams.includeArchived;
        return {
          json: async () =>
            banco[path as RegistryKind].filter((c) => c.active || incluir),
        };
      }
      return fake.api.get(path, options);
    }),
    post: vi.fn((path: string, options: { json: never }) => {
      if (path in banco) {
        return {
          json: async () => {
            const novo = registry({
              id: `${path}-novo`,
              name: (options.json as { name: string }).name,
            });
            banco[path as RegistryKind].push(novo);
            return novo;
          },
        };
      }
      return fake.api.post(path, options);
    }),
  };
  vi.mocked(useApi).mockReturnValue(
    api as unknown as ReturnType<typeof useApi>,
  );
  return { ...fake, api, banco };
}

/** Monta só o painel, com `onClose`/`onToast` espiáveis. */
function montar(briefId: string | null, options: Opcoes = {}) {
  const fake = prepareApi(options);
  const onClose = vi.fn();
  const onToast = vi.fn();
  const utils = renderWithProviders(
    <ContentBriefEditorDrawer
      briefId={briefId}
      onClose={onClose}
      onToast={onToast}
    />,
    { auth: options.auth ?? {} },
  );
  const invalidar = vi.spyOn(utils.queryClient, 'invalidateQueries');
  return { ...utils, ...fake, onClose, onToast, invalidar };
}

const title = () => screen.getByLabelText('Título');
const save = () => screen.getByRole('button', { name: 'Salvar' });

describe('<EditorPautaDrawer />', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  describe('pauta nova', () => {
    it('abre vazia, com título "Nova pauta", foco no título e status "A fazer"', async () => {
      montar(null);

      expect(
        await screen.findByRole('dialog', { name: 'Nova pauta' }),
      ).toBeInTheDocument();
      expect(title()).toHaveFocus();
      expect(title()).toHaveValue('');
      expect(screen.getByLabelText('Status')).toHaveValue('TODO');
      expect(screen.getByLabelText('Ação')).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    });

    it('não envia sem título e mostra a mensagem do protótipo no campo', async () => {
      const user = userEvent.setup();
      const { creations, onClose } = montar(null);
      await screen.findByRole('dialog');

      await user.type(title(), '   ');
      await user.click(save());

      expect(
        screen.getByText('Escreva um título para a pauta.'),
      ).toBeInTheDocument();
      expect(title()).toHaveAttribute('aria-invalid', 'true');
      expect(title()).toHaveFocus();
      expect(creations).toHaveLength(0);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('conta os caracteres do título e da descrição e limita pelo maxLength', async () => {
      const user = userEvent.setup();
      montar(null);
      await screen.findByRole('dialog');

      expect(screen.getByText('0/140')).toBeInTheDocument();
      expect(screen.getByText('0/1200')).toBeInTheDocument();

      await user.type(title(), 'Arte');
      await user.type(screen.getByLabelText('Sobre o que se trata'), 'abc');

      expect(screen.getByText('4/140')).toBeInTheDocument();
      expect(screen.getByText('3/1200')).toBeInTheDocument();
      expect(title()).toHaveAttribute('maxlength', '140');
      expect(screen.getByLabelText('Sobre o que se trata')).toHaveAttribute(
        'maxlength',
        '1200',
      );
    });

    it('cria a pauta com POST, avisa, fecha e invalida as pautas', async () => {
      const user = userEvent.setup();
      const { creations, onClose, onToast, invalidar } = montar(null);
      await screen.findByRole('dialog');

      await user.type(title(), '  Arte do plantão  ');
      await user.selectOptions(screen.getByLabelText('Canal'), 'Instagram');
      await user.click(save());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onToast).toHaveBeenCalledWith('success', 'Pauta salva');
      expect(creations).toEqual([
        {
          title: 'Arte do plantão',
          description: '',
          dueDate: null,
          status: 'TODO',
          action: null,
          channel: 'INSTAGRAM',
          estateDevelopmentId: null,
          ownerId: null,
        },
      ]);
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
    });

    it('duplo clique em Salvar não cria duas pautas', async () => {
      const user = userEvent.setup();
      const { api, onClose } = montar(null);
      await screen.findByRole('dialog');
      let concluir: () => void = () => {};
      const lenta = new Promise<ContentBriefResponse>((resolve) => {
        concluir = () => resolve(buildContentBrief({ id: 'x' }));
      });
      vi.mocked(api.post).mockImplementationOnce(
        () => ({ json: () => lenta }) as never,
      );

      await user.type(title(), 'Arte');
      await user.dblClick(save());

      expect(api.post).toHaveBeenCalledTimes(1);
      // Enquanto envia, o nome acessível ganha o "Carregando" do spinner.
      expect(screen.getByRole('button', { name: /Salvar/ })).toBeDisabled();

      await act(async () => concluir());
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('mostra o erro de campo devolvido pela API no campo certo', async () => {
      const user = userEvent.setup();
      const { onClose } = montar(null, {
        failures: {
          'POST content-briefs': new ApiError({
            status: 400,
            code: 'INVALID_TITLE',
          }),
        },
      });
      await screen.findByRole('dialog');

      await user.type(title(), 'Arte');
      await user.click(save());

      expect(
        await screen.findByText('Informe um título com até 140 caracteres.'),
      ).toBeInTheDocument();
      expect(title()).toHaveAttribute('aria-invalid', 'true');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('mostra erro sem campo no topo do painel e mantém o formulário', async () => {
      const user = userEvent.setup();
      const { onClose } = montar(null, {
        failures: {
          'POST content-briefs': new ApiError({
            status: 500,
            code: 'INTERNAL_ERROR',
          }),
        },
      });
      await screen.findByRole('dialog');

      await user.type(title(), 'Arte');
      await user.click(save());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo deu errado do nosso lado',
      );
      expect(title()).toHaveValue('Arte');
      expect(save()).toBeEnabled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('prazo', () => {
    it('os atalhos calculam no calendário local e "Sem prazo" limpa', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 14, 23, 30));
      const user = userEvent.setup();
      montar(null);
      await screen.findByRole('dialog');
      const dueDate = screen.getByLabelText('Prazo');

      await user.click(screen.getByRole('button', { name: 'Hoje' }));
      expect(dueDate).toHaveValue('2026-11-14');
      await user.click(screen.getByRole('button', { name: 'Amanhã' }));
      expect(dueDate).toHaveValue('2026-11-15');
      await user.click(screen.getByRole('button', { name: '+ 1 semana' }));
      expect(dueDate).toHaveValue('2026-11-21');
      await user.click(screen.getByRole('button', { name: 'Sem prazo' }));
      expect(dueDate).toHaveValue('');
    });

    it('envia o prazo digitado e null quando o campo de data está vazio', async () => {
      const user = userEvent.setup();
      const { creations } = montar(null);
      await screen.findByRole('dialog');

      await user.type(title(), 'Com prazo');
      fireEvent.change(screen.getByLabelText('Prazo'), {
        target: { value: '2026-12-01' },
      });
      await user.click(save());
      await waitFor(() => expect(creations).toHaveLength(1));
      expect(creations[0]?.dueDate).toBe('2026-12-01');
    });
  });

  describe('cadastro inline', () => {
    it('cria o empreendimento na hora e salva a pauta com o id novo', async () => {
      const user = userEvent.setup();
      const { creations, api, onClose } = montar(null);
      await screen.findByRole('dialog');

      await user.click(
        screen.getByRole('combobox', { name: 'Empreendimento' }),
      );
      await user.click(
        screen.getByRole('option', { name: '+ Adicionar novo…' }),
      );
      await user.type(
        screen.getByPlaceholderText('Nome do empreendimento'),
        'Parque Novo{Enter}',
      );

      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: 'Empreendimento' }),
        ).toHaveValue('Parque Novo'),
      );
      expect(api.post).toHaveBeenCalledWith('estate-developments', {
        json: { name: 'Parque Novo' },
      });

      await user.type(title(), 'Lançamento');
      await user.click(save());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(creations[0]?.estateDevelopmentId).toBe(
        'estate-developments-novo',
      );
    });

    it('sem registry:write não oferece "+ Adicionar novo…"', async () => {
      const user = userEvent.setup();
      montar(null, {
        auth: {
          permissions: [
            'content-brief:read',
            'content-brief:write',
            'registry:read',
          ],
        },
      });
      await screen.findByRole('dialog');

      await user.click(
        screen.getByRole('combobox', { name: 'Empreendimento' }),
      );

      expect(
        screen.getByRole('option', { name: 'Residencial Aurora' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: '+ Adicionar novo…' }),
      ).toBeNull();
    });
  });

  describe('editar pauta', () => {
    it('carrega a pauta pelo id e preenche todos os campos, mesmo com vínculo arquivado', async () => {
      const brief = fullBrief();
      brief.estateDevelopment = {
        id: 'e2',
        name: 'Edifício Antigo',
        active: false,
      };
      const { api } = montar('p1', { briefs: [brief] });

      expect(screen.getByText('Carregando pauta…')).toBeInTheDocument();
      expect(
        await screen.findByRole('dialog', { name: 'Editar pauta' }),
      ).toBeInTheDocument();
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      expect(api.get).toHaveBeenCalledWith('content-briefs/p1');
      expect(screen.getByLabelText('Sobre o que se trata')).toHaveValue(
        'Detalhes do vídeo',
      );
      expect(screen.getByLabelText('Prazo')).toHaveValue('2026-11-20');
      expect(screen.getByLabelText('Status')).toHaveValue('IN_PROGRESS');
      expect(screen.getByLabelText('Ação')).toHaveValue('CHASE');
      expect(screen.getByLabelText('Canal')).toHaveValue('VIDEO');
      expect(
        screen.getByRole('combobox', { name: 'Empreendimento' }),
      ).toHaveValue('Edifício Antigo (arquivado)');
      expect(screen.getByRole('combobox', { name: 'Responsável' })).toHaveValue(
        'Marina',
      );
    });

    it('PUT leva todos os campos e a version carregada, mesmo mudando só um', async () => {
      const user = userEvent.setup();
      const { edits, onClose, onToast } = montar('p1', {
        briefs: [fullBrief()],
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.clear(title());
      await user.type(title(), 'Cobrar vídeo final');
      await user.click(save());

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onToast).toHaveBeenCalledWith('success', 'Pauta salva');
      expect(edits).toEqual([
        {
          id: 'p1',
          body: {
            title: 'Cobrar vídeo final',
            description: 'Detalhes do vídeo',
            dueDate: '2026-11-20',
            status: 'IN_PROGRESS',
            action: 'CHASE',
            channel: 'VIDEO',
            estateDevelopmentId: 'e1',
            ownerId: 'r1',
            version: 3,
          },
        },
      ]);
    });

    it('limpar o prazo e os selects manda null (o PUT substitui)', async () => {
      const user = userEvent.setup();
      const { edits, onClose } = montar('p1', { briefs: [fullBrief()] });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.click(screen.getByRole('button', { name: 'Sem prazo' }));
      await user.selectOptions(screen.getByLabelText('Ação'), 'Sem ação');
      await user.selectOptions(screen.getByLabelText('Canal'), 'Nenhum');
      await user.click(save());

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(edits[0]?.body).toMatchObject({
        dueDate: null,
        action: null,
        channel: null,
      });
    });

    it('404 ao abrir avisa "Esta pauta não existe mais." e fecha', async () => {
      const { onToast, onClose } = montar('fantasma', { briefs: [] });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onToast).toHaveBeenCalledWith('error', BRIEF_NOT_FOUND_MESSAGE);
      expect(BRIEF_NOT_FOUND_MESSAGE).toBe('Esta pauta não existe mais.');
    });

    it('erro ao abrir (não 404) mostra a mensagem e deixa tentar de novo', async () => {
      const user = userEvent.setup();
      const fake = prepareApi({ briefs: [fullBrief()] });
      const leitura = fake.api.get.getMockImplementation();
      let falhando = true;
      fake.api.get.mockImplementation(((path: string, options?: never) =>
        path === 'content-briefs/p1' && falhando
          ? {
              json: async () => {
                throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' });
              },
            }
          : leitura?.(path, options)) as never);
      const onClose = vi.fn();
      renderWithProviders(
        <ContentBriefEditorDrawer
          briefId="p1"
          onClose={onClose}
          onToast={vi.fn()}
        />,
        { auth: {} },
      );

      // A consulta repete uma vez antes de desistir.
      expect(
        await screen.findByText(/Algo deu errado do nosso lado/, undefined, {
          timeout: 4000,
        }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Título')).toBeNull();

      falhando = false;
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
    });
  });

  describe('edição concorrente (409)', () => {
    async function abrirEEntrarEmConflito() {
      const user = userEvent.setup();
      const briefs = [fullBrief()];
      const ctx = montar('p1', { briefs });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.clear(title());
      await user.type(title(), 'Meu texto digitado');
      // Outra pessoa salva primeiro.
      const noServidor = briefs[0] as ContentBriefResponse;
      noServidor.version = 4;
      noServidor.title = 'Título da outra pessoa';
      await user.click(save());

      expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
      return { user, briefs, ...ctx };
    }

    it('mantém o painel aberto e o texto digitado, e não fecha nem avisa sucesso', async () => {
      const { onClose, onToast } = await abrirEEntrarEmConflito();

      expect(title()).toHaveValue('Meu texto digitado');
      expect(
        screen.getByRole('button', { name: 'Ver versão atual' }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(onToast).not.toHaveBeenCalled();
    });

    it('"Continuar editando" some com o aviso sem tocar no texto', async () => {
      const { user } = await abrirEEntrarEmConflito();

      await user.click(
        screen.getByRole('button', { name: 'Continuar editando' }),
      );

      expect(screen.queryByText(CONFLICT_MESSAGE)).toBeNull();
      expect(title()).toHaveValue('Meu texto digitado');
    });

    it('"Ver versão atual" confirma, descarta o digitado e salva depois com a version nova', async () => {
      const { user, edits, onClose } = await abrirEEntrarEmConflito();

      await user.click(
        screen.getByRole('button', { name: 'Ver versão atual' }),
      );
      const confirmacao = await screen.findByRole('dialog', {
        name: 'Ver a versão atual?',
      });
      expect(title()).toBeInTheDocument();
      await user.click(
        within(confirmacao).getByRole('button', {
          name: 'Descartar e ver versão atual',
        }),
      );

      await waitFor(() =>
        expect(title()).toHaveValue('Título da outra pessoa'),
      );
      expect(screen.queryByText(CONFLICT_MESSAGE)).toBeNull();

      await user.click(save());
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(edits.at(-1)?.body.version).toBe(4);
    });

    it('recusar a confirmação mantém o que foi digitado e o aviso', async () => {
      const { user } = await abrirEEntrarEmConflito();

      await user.click(
        screen.getByRole('button', { name: 'Ver versão atual' }),
      );
      const confirmacao = await screen.findByRole('dialog', {
        name: 'Ver a versão atual?',
      });
      await user.click(
        within(confirmacao).getByRole('button', {
          name: 'Continuar editando',
        }),
      );

      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Ver a versão atual?' }),
        ).toBeNull(),
      );
      expect(title()).toHaveValue('Meu texto digitado');
      expect(screen.getByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    });
  });

  describe('excluir', () => {
    it('só aparece em edição e com content-brief:delete', async () => {
      montar('p1', {
        briefs: [fullBrief()],
        auth: { permissions: ['content-brief:read', 'content-brief:write'] },
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    });

    it('exclui no segundo clique: DELETE, aviso, fecha e invalida', async () => {
      const user = userEvent.setup();
      const { deletions, onClose, onToast, invalidar } = montar('p1', {
        briefs: [fullBrief()],
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.click(screen.getByRole('button', { name: 'Excluir' }));
      expect(deletions).toHaveLength(0);
      await user.click(
        screen.getByRole('button', { name: 'Confirmar exclusão' }),
      );

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(deletions).toEqual(['p1']);
      expect(onToast).toHaveBeenCalledWith('success', 'Pauta excluída');
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['content-briefs'] });
    });

    it('fechar o painel desarma o botão: reabrir mostra "Excluir" de novo', async () => {
      const user = userEvent.setup();
      const briefs = [fullBrief()];
      const primeira = montar('p1', { briefs });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
      await user.click(screen.getByRole('button', { name: 'Excluir' }));
      expect(
        screen.getByRole('button', { name: 'Confirmar exclusão' }),
      ).toBeInTheDocument();
      primeira.unmount();

      montar('p1', { briefs });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
      expect(
        screen.getByRole('button', { name: 'Excluir' }),
      ).toBeInTheDocument();
    });

    it('falha ao excluir mostra o erro no painel e não fecha', async () => {
      const user = userEvent.setup();
      const { onClose } = montar('p1', {
        briefs: [fullBrief()],
        failures: {
          'DELETE content-briefs/p1': new ApiError({
            status: 500,
            code: 'INTERNAL_ERROR',
          }),
        },
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.click(screen.getByRole('button', { name: 'Excluir' }));
      await user.click(
        screen.getByRole('button', { name: 'Confirmar exclusão' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo deu errado',
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('somente leitura (sem content-brief:write)', () => {
    it('bloqueia todos os campos e deixa só "Fechar"', async () => {
      const user = userEvent.setup();
      const { onClose, creations, edits } = montar('p1', {
        briefs: [fullBrief()],
        auth: { permissions: ['content-brief:read', 'registry:read'] },
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      expect(title()).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Sobre o que se trata')).toHaveAttribute(
        'readonly',
      );
      expect(screen.getByLabelText('Prazo')).toBeDisabled();
      expect(screen.getByLabelText('Status')).toBeDisabled();
      expect(screen.getByLabelText('Ação')).toBeDisabled();
      expect(screen.getByLabelText('Canal')).toBeDisabled();
      expect(
        screen.getByRole('combobox', { name: 'Empreendimento' }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Hoje' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();

      const fechar = screen
        .getAllByRole('button', { name: 'Fechar' })
        .at(-1) as HTMLElement;
      await user.click(fechar);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(creations).toHaveLength(0);
      expect(edits).toHaveLength(0);
    });

    it('mostra o vínculo mesmo sem registry:read (rótulo vem da própria pauta)', async () => {
      montar('p1', {
        briefs: [fullBrief()],
        auth: { permissions: ['content-brief:read'] },
      });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      expect(
        screen.getByRole('combobox', { name: 'Empreendimento' }),
      ).toHaveValue('Residencial Aurora');
    });
  });

  describe('alterações não salvas', () => {
    it('sem alteração, Cancelar fecha direto', async () => {
      const user = userEvent.setup();
      const { onClose } = montar('p1', { briefs: [fullBrief()] });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Descartar alterações?')).toBeNull();
    });

    it('com alteração, pede confirmação; "Continuar editando" mantém, "Descartar" fecha', async () => {
      const user = userEvent.setup();
      const { onClose } = montar('p1', { briefs: [fullBrief()] });
      await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
      await user.type(title(), '!');

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      const aviso = await screen.findByRole('dialog', {
        name: 'Descartar alterações?',
      });
      await user.click(
        within(aviso).getByRole('button', { name: 'Continuar editando' }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
        ).toBeNull(),
      );
      expect(onClose).not.toHaveBeenCalled();
      expect(title()).toHaveValue('Cobrar vídeo!');

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      await user.click(
        within(
          await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
        ).getByRole('button', { name: 'Descartar' }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Esc com alteração pede confirmação em vez de fechar', async () => {
      const user = userEvent.setup();
      const { onClose } = montar(null);
      await screen.findByRole('dialog');
      await user.type(title(), 'Rascunho');

      await user.keyboard('{Escape}');

      expect(
        await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Esc sem alteração fecha direto', async () => {
      const user = userEvent.setup();
      const { onClose } = montar(null);
      await screen.findByRole('dialog');

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('navegar pelo roteador com texto por salvar pede confirmação', async () => {
      const user = userEvent.setup();
      prepareApi({ briefs: [] });
      const { router } = renderRoutes(
        [
          {
            path: '/content-briefs',
            element: (
              <ContentBriefEditorDrawer
                briefId={null}
                onClose={vi.fn()}
                onToast={vi.fn()}
              />
            ),
          },
          { path: '/outra', element: <p>Outra screen</p> },
        ],
        { route: '/content-briefs', auth: {} },
      );
      await screen.findByRole('dialog', { name: 'Nova pauta' });
      await user.type(title(), 'Rascunho');

      await act(async () => {
        await router.navigate('/outra');
      });
      const aviso = await screen.findByRole('dialog', {
        name: 'Descartar alterações?',
      });
      expect(router.state.location.pathname).toBe('/content-briefs');

      await user.click(
        within(aviso).getByRole('button', { name: 'Continuar editando' }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
        ).toBeNull(),
      );
      expect(router.state.location.pathname).toBe('/content-briefs');

      await act(async () => {
        await router.navigate('/outra');
      });
      await user.click(
        within(
          await screen.findByRole('dialog', { name: 'Descartar alterações?' }),
        ).getByRole('button', { name: 'Descartar' }),
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/outra'),
      );
    });
  });
});

describe('editor na tela de pautas (URL)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  function Local() {
    const { search } = useLocation();
    return <output data-testid="url">{search}</output>;
  }

  function renderPage(route: string, options: Opcoes = {}) {
    const fake = prepareApi({ briefs: [fullBrief()], ...options });
    const utils = renderWithProviders(
      <>
        <ContentBriefsPage />
        <Local />
      </>,
      { route, auth: options.auth ?? {} },
    );
    return { ...utils, ...fake };
  }
  const url = () => screen.getByTestId('url').textContent;

  it('?brief=<id> abre o editor com a pauta e fechar remove o parâmetro', async () => {
    const user = userEvent.setup();
    renderPage('/content-briefs?brief=p1&view=prazo');

    const painel = await screen.findByRole('dialog', { name: 'Editar pauta' });
    await waitFor(() =>
      expect(within(painel).getByLabelText('Título')).toHaveValue(
        'Cobrar vídeo',
      ),
    );

    await user.click(within(painel).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Editar pauta' })).toBeNull(),
    );
    expect(url()).toBe('?view=prazo');
  });

  it('?new=1 abre o editor vazio e "+ Nova pauta" muda a URL', async () => {
    const user = userEvent.setup();
    renderPage('/content-briefs');
    await screen.findByText('Cobrar vídeo');

    await user.click(screen.getByRole('button', { name: '+ Nova pauta' }));

    expect(url()).toBe('?new=1');
    expect(
      await screen.findByRole('dialog', { name: 'Nova pauta' }),
    ).toBeInTheDocument();
  });

  it('?new=1 sem content-brief:write não abre o editor', async () => {
    renderPage('/content-briefs?new=1', {
      auth: { permissions: ['content-brief:read'] },
    });
    await screen.findByText('Cobrar vídeo');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('salvar pela tela fecha o painel, tira o parâmetro e a lista mostra o novo título', async () => {
    const user = userEvent.setup();
    renderPage('/content-briefs?brief=p1');
    const painel = await screen.findByRole('dialog', { name: 'Editar pauta' });
    await waitFor(() =>
      expect(within(painel).getByLabelText('Título')).toHaveValue(
        'Cobrar vídeo',
      ),
    );

    const campo = within(painel).getByLabelText('Título');
    await user.clear(campo);
    await user.type(campo, 'Vídeo cobrado');
    await user.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Pauta salva')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(url()).toBe('');
    expect(await screen.findByText('Vídeo cobrado')).toBeInTheDocument();
  });

  it('?brief= de uma pauta inexistente avisa e limpa a URL', async () => {
    renderPage('/content-briefs?brief=fantasma');

    expect(
      await screen.findByText('Esta pauta não existe mais.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(url()).toBe(''));
  });
});

describe.each([
  'modal',
  'drawer',
] as const)('editor de pauta apresentado como %s', (presentation) => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ uiTheme: 'soft', formPresentation: presentation }),
    );
  });
  afterEach(() => window.localStorage.clear());

  it('abre no formato escolhido, nomeado pelo título, com rodapé de ações visível', async () => {
    montar(null);

    const dialog = await screen.findByRole('dialog', { name: 'Nova pauta' });
    expect(dialog).toHaveAttribute('data-form-presentation', presentation);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  it('fecha direto pelo botão X quando não há alteração', async () => {
    const user = userEvent.setup();
    const { onClose } = montar(null);
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('com alteração, fechar (X, fundo ou Esc) pede confirmação e só "Descartar" fecha', async () => {
    const user = userEvent.setup();
    const { onClose } = montar(null);
    await screen.findByRole('dialog');
    await user.type(title(), 'Rascunho');

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    let aviso = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    await user.click(
      within(aviso).getByRole('button', { name: 'Continuar editando' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Descartar alterações?' }),
      ).toBeNull(),
    );

    await user.click(document.querySelector('.bg-scrim') as HTMLElement);
    aviso = await screen.findByRole('dialog', {
      name: 'Descartar alterações?',
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(title()).toHaveValue('Rascunho');

    await user.click(within(aviso).getByRole('button', { name: 'Descartar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('409 de versão mantém o texto digitado e oferece "Ver versão atual"', async () => {
    const user = userEvent.setup();
    const briefs = [fullBrief()];
    const { onClose } = montar('p1', { briefs });
    await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
    await user.clear(title());
    await user.type(title(), 'Meu texto digitado');
    (briefs[0] as ContentBriefResponse).version = 4;

    await user.click(save());

    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    expect(title()).toHaveValue('Meu texto digitado');
    expect(
      screen.getByRole('button', { name: 'Ver versão atual' }),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sem content-brief:write mostra a pauta só para leitura, com "Fechar"', async () => {
    montar('p1', {
      briefs: [fullBrief()],
      auth: { permissions: ['content-brief:read'] },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Pauta' });
    expect(dialog).toHaveAttribute('data-form-presentation', presentation);
    await waitFor(() => expect(title()).toHaveValue('Cobrar vídeo'));
    expect(title()).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    // O X do cabeçalho e o "Fechar" do rodapé.
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2);
  });
});

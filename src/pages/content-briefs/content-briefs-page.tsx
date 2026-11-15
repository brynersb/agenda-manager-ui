import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useAuthContext } from '@/auth/use-auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Toast } from '@/components/ui/toast';
import { useContentBriefSummary } from '@/hooks/use-content-brief-summary';
import { useChangeContentBriefStatus } from '@/hooks/use-content-briefs';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage, isCode } from '@/lib/api-error';
import { RegistriesDrawer } from '@/pages/registries/registries-drawer';
import type {
  ContentBriefResponse,
  ContentBriefStatus,
} from '@/types/content-brief';
import { ContentBriefEditorDrawer } from './content-brief-editor-drawer';
import { DueDateList } from './due-date-list';
import { FilterBar } from './filter-bar';
import { QueryError } from './query-error';
import { countQuickFilters, QuickFilters } from './quick-filters';
import { StatusBoard } from './status-board';
import { useUrlFilters } from './use-url-filters';

/** Mensagem do `409` ao trocar o status: a lista já foi recarregada. */
export const BRIEF_CHANGED_MESSAGE =
  'Esta pauta foi alterada por outra pessoa. A lista foi atualizada.';

/**
 * Tela principal: cabeçalho, filtros rápidos com contagem, busca e filtros,
 * e a lista por prazo ou o quadro por status.
 *
 * O estado (visão, filtro rápido, empreendimento, responsável, ação, busca)
 * vive na URL. O editor de pauta abre por `?brief=<id>` (qualquer pessoa com
 * `content-brief:read`, somente leitura sem `content-brief:write`) e por
 * `?new=1` (só com `content-brief:write`); o clique no título e em "+ Nova
 * pauta" só mudam a URL, e fechar o editor remove o parâmetro com `replace`.
 *
 * @returns A página de pautas.
 */
export function ContentBriefsPage() {
  const { hasPermission } = useAuthContext();
  const canWrite = hasPermission('content-brief:write');
  const canReadRegistries = hasPermission('registry:read');
  const canEditRegistries = hasPermission('registry:write');

  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, commonFilters, hasCommonFilter, change, clear } =
    useUrlFilters();
  const queryClient = useQueryClient();
  const summary = useContentBriefSummary(commonFilters);
  const changeStatus = useChangeContentBriefStatus();
  const { toast, show, dismiss } = useToast();

  const [registriesOpen, setRegistriesOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(
    filters.dueStatus === 'completed',
  );

  // Com o chip "Concluídas" o grupo aparece aberto; fora dele a pessoa decide.
  useEffect(() => {
    if (filters.dueStatus === 'completed') setCompletedOpen(true);
  }, [filters.dueStatus]);

  const contentRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);

  // Trocar o status pode mover a pauta de grupo ou coluna, remontando o
  // seletor e jogando o foco no `body`. Devolve o foco ao seletor da pauta
  // depois do re-render, sem roubá-lo se a pessoa já foi para outro controle.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    if (document.activeElement === document.body || !document.activeElement) {
      contentRef.current
        ?.querySelector<HTMLSelectElement>(
          `select[data-content-brief-id="${id}"]`,
        )
        ?.focus();
    }
    if (!changeStatus.isPending) pendingFocus.current = null;
  });

  function updateUrl(mutate: (params: URLSearchParams) => void) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      mutate(next);
      return next;
    });
  }

  const briefId = searchParams.get('brief') || null;
  const creating = canWrite && searchParams.get('new') === '1';
  const editorOpen = briefId !== null || creating;

  const closeEditor = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('brief');
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  function openBrief(id: string) {
    updateUrl((params) => {
      params.set('brief', id);
      params.delete('new');
    });
  }

  function newBrief() {
    updateUrl((params) => {
      params.set('new', '1');
      params.delete('brief');
    });
  }

  function changeBriefStatus(
    brief: ContentBriefResponse,
    status: ContentBriefStatus,
  ) {
    if (status === brief.status) return;
    pendingFocus.current = brief.id;
    changeStatus.mutate(
      { id: brief.id, status, version: brief.version },
      {
        onError: (error) =>
          show(
            'error',
            isCode(error, 'CONTENT_BRIEF_VERSION_OUTDATED')
              ? BRIEF_CHANGED_MESSAGE
              : getApiErrorMessage(error),
          ),
      },
    );
  }

  const data = summary.data;
  const today = data?.today;
  const filterTotal = data
    ? countQuickFilters(data)[filters.dueStatus]
    : undefined;

  const briefActions = {
    today,
    canWrite,
    onOpen: openBrief,
    onChangeStatus: changeBriefStatus,
  };

  function renderContent() {
    if (summary.isError && !data) {
      return (
        <QueryError
          error={summary.error}
          onRetry={() => {
            void queryClient.invalidateQueries({
              queryKey: ['content-briefs'],
            });
          }}
        />
      );
    }
    if (!data) {
      return (
        <p role="status" className="text-muted">
          Carregando pautas…
        </p>
      );
    }
    if (data.total === 0 && !hasCommonFilter) {
      return (
        <EmptyState
          title="Nenhuma pauta cadastrada"
          description="Cadastre a primeira com título, o que ela trata, empreendimento, responsável e prazo."
          actions={canWrite && <Button onClick={newBrief}>Nova pauta</Button>}
        />
      );
    }
    if (filterTotal === 0) {
      return (
        <EmptyState
          title="Nenhuma pauta encontrada"
          description="Nada corresponde aos filtros ou à busca atual."
          actions={
            <Button variant="secondary" onClick={clear}>
              Limpar filtros
            </Button>
          }
        />
      );
    }
    if (filters.view === 'status') {
      return (
        <StatusBoard
          filters={commonFilters}
          filter={filters.dueStatus}
          {...briefActions}
        />
      );
    }
    return (
      <DueDateList
        filters={commonFilters}
        filter={filters.dueStatus}
        completedTotal={data.byDueStatus.completed}
        completedOpen={completedOpen}
        onCompletedOpenChange={setCompletedOpen}
        {...briefActions}
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-balance font-display font-extrabold text-[clamp(32px,6vw,52px)] leading-[1.02] tracking-[-0.03em]">
          Pauta de marketing{' '}
          <mark className="bg-[linear-gradient(transparent_58%,var(--hl-soft)_58%_92%,transparent_92%)] bg-transparent px-[0.08em] text-inherit">
            Bora
          </mark>
        </h1>
        {canWrite && <Button onClick={newBrief}>+ Nova pauta</Button>}
      </div>

      <FilterBar
        filters={filters}
        onChange={change}
        canReadRegistries={canReadRegistries}
        canEditRegistries={canEditRegistries}
        onEditRegistries={() => setRegistriesOpen(true)}
        quickFilters={
          <QuickFilters
            filter={filters.dueStatus}
            summary={data}
            onChange={(dueStatus) => change({ dueStatus })}
          />
        }
      />

      <div ref={contentRef}>{renderContent()}</div>

      {canEditRegistries && (
        <RegistriesDrawer
          open={registriesOpen}
          onOpenChange={setRegistriesOpen}
        />
      )}
      {editorOpen && (
        <ContentBriefEditorDrawer
          key={briefId ?? 'new'}
          briefId={briefId}
          onClose={closeEditor}
          onToast={show}
        />
      )}
      {toast && <Toast {...toast} onClose={dismiss} />}
    </>
  );
}

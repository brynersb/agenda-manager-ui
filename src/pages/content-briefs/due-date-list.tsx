import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  useCompletedContentBriefs,
  useOpenContentBriefs,
} from '@/hooks/use-content-briefs';
import { DUE_STATUS_LABEL, OPEN_DUE_STATUSES } from '@/lib/labels';
import type {
  CommonFilters,
  ContentBriefResponse,
  ContentBriefStatus,
  DueStatus,
  QuickFilter,
} from '@/types/content-brief';
import { ContentBriefItem } from './content-brief-item';
import { QueryError } from './query-error';

interface ContentBriefActions {
  today?: string;
  canWrite: boolean;
  onOpen: (id: string) => void;
  onChangeStatus: (
    brief: ContentBriefResponse,
    status: ContentBriefStatus,
  ) => void;
}

const GROUP_TITLE_CLASS =
  'm-0 mb-2.5 flex items-baseline gap-2.5 font-bold font-display text-[17px] leading-[1.2] tracking-[-0.01em]';
const ROWS_CLASS =
  'divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface [box-shadow:var(--elev-card)]';

function Count({ n }: { n: number }) {
  return (
    <span className="font-medium font-mono text-muted text-xs tabular-nums leading-none">
      {n}
    </span>
  );
}

/**
 * Agrupa as pautas abertas por `dueStatus`, na ordem dos grupos da tela.
 * Grupos vazios não aparecem. A ordem dentro do grupo é a da API (prazo).
 *
 * @param briefs Pautas na ordem recebida.
 * @returns Pares `[situação, pautas]` só dos grupos com itens.
 */
export function groupByDueStatus(
  briefs: ContentBriefResponse[],
): [DueStatus, ContentBriefResponse[]][] {
  return OPEN_DUE_STATUSES.map(
    (dueStatus): [DueStatus, ContentBriefResponse[]] => [
      dueStatus,
      briefs.filter((p) => p.dueStatus === dueStatus),
    ],
  ).filter(([, items]) => items.length > 0);
}

interface DueDateListProps extends ContentBriefActions {
  filters: CommonFilters;
  filter: QuickFilter;
  /** Quantas pautas concluídas existem (do resumo), mesmo com o grupo fechado. */
  completedTotal: number;
  completedOpen: boolean;
  onCompletedOpenChange: (open: boolean) => void;
}

/**
 * Visão por prazo: grupos Atrasadas, Hoje, Próximos 7 dias, Mais adiante e
 * Sem prazo definido, mais "Concluídas" recolhível.
 *
 * Uma única consulta traz as abertas (até 200); o agrupamento é feito aqui
 * pelo `dueStatus` da API. "Concluídas" só consulta quando está aberto; com o
 * chip "Concluídas" as abertas nem são consultadas.
 *
 * @param props.filters Filtros comuns.
 * @param props.filter Filtro rápido ativo.
 * @param props.completedTotal Contagem para o título do grupo.
 * @param props.completedOpen Estado do `<details>`, guardado por quem chama
 * para sobreviver a refetch e troca de visão.
 * @returns Os grupos.
 */
export function DueDateList({
  filters,
  filter,
  completedTotal,
  completedOpen,
  onCompletedOpenChange,
  ...actions
}: DueDateListProps) {
  const showOpen = filter !== 'completed';
  const showCompleted =
    (filter === 'all' || filter === 'completed') && completedTotal > 0;

  return (
    <div>
      {showOpen && (
        <OpenGroups filters={filters} filter={filter} {...actions} />
      )}
      {showCompleted && (
        <CompletedGroup
          filters={filters}
          total={completedTotal}
          open={completedOpen}
          onOpenChange={onCompletedOpenChange}
          {...actions}
        />
      )}
    </div>
  );
}

function OpenGroups({
  filters,
  filter,
  ...actions
}: ContentBriefActions & { filters: CommonFilters; filter: QuickFilter }) {
  const query = useOpenContentBriefs(filters, filter);
  const briefs = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const groups = useMemo(() => groupByDueStatus(briefs), [briefs]);

  if (query.isError && !query.data) {
    return (
      <QueryError error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  if (query.isPending) {
    return (
      <p role="status" className="text-muted">
        Carregando pautas…
      </p>
    );
  }

  return (
    <>
      {groups.map(([dueStatus, items]) => (
        <section
          key={dueStatus}
          aria-labelledby={`grupo-${dueStatus}`}
          className="mb-7 min-w-0"
        >
          <h2
            id={`grupo-${dueStatus}`}
            className={`${GROUP_TITLE_CLASS} ${dueStatus === 'overdue' ? 'text-late' : ''}`}
          >
            {DUE_STATUS_LABEL[dueStatus]} <Count n={items.length} />
          </h2>
          <div className={ROWS_CLASS}>
            {items.map((brief) => (
              <ContentBriefItem
                key={brief.id}
                brief={brief}
                variant="list"
                {...actions}
              />
            ))}
          </div>
        </section>
      ))}
      {query.hasNextPage && (
        <div className="mb-7">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Mostrar mais
          </Button>
        </div>
      )}
    </>
  );
}

interface CompletedGroupProps extends ContentBriefActions {
  filters: CommonFilters;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CompletedGroup({
  filters,
  total,
  open,
  onOpenChange,
  ...actions
}: CompletedGroupProps) {
  const query = useCompletedContentBriefs(filters, open);
  const briefs = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="group mb-7 min-w-0"
    >
      <summary
        className={`${GROUP_TITLE_CLASS} cursor-pointer list-none text-muted marker:hidden [&::-webkit-details-marker]:hidden`}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-4 self-center transition-transform group-open:rotate-90"
        />
        Concluídas <Count n={total} />
      </summary>
      {open && query.isError && !query.data && (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      )}
      {open && query.isPending && !query.isError && (
        <p role="status" className="text-muted">
          Carregando pautas…
        </p>
      )}
      {briefs.length > 0 && (
        <div className={ROWS_CLASS}>
          {briefs.map((brief) => (
            <ContentBriefItem
              key={brief.id}
              brief={brief}
              variant="list"
              {...actions}
            />
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <div className="mt-3">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Carregar mais
          </Button>
        </div>
      )}
    </details>
  );
}

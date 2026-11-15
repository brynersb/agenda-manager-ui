import { Button } from '@/components/ui/button';
import { useContentBriefsByStatus } from '@/hooks/use-content-briefs';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/labels';
import type {
  CommonFilters,
  ContentBriefResponse,
  ContentBriefStatus,
  QuickFilter,
} from '@/types/content-brief';
import { ContentBriefItem } from './content-brief-item';
import { QueryError } from './query-error';

interface StatusBoardProps {
  filters: CommonFilters;
  filter: QuickFilter;
  today?: string;
  canWrite: boolean;
  onOpen: (id: string) => void;
  onChangeStatus: (
    brief: ContentBriefResponse,
    status: ContentBriefStatus,
  ) => void;
}

/**
 * Visão por status: quatro colunas, cada uma com a sua consulta paginada
 * (`status=<X>`, 50 por página) e "Carregar mais".
 *
 * @param props.filters Filtros comuns.
 * @param props.filter Filtro rápido; restringe a situação das colunas.
 * @returns O quadro.
 */
export function StatusBoard({ filters, filter, ...actions }: StatusBoardProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] items-start gap-[18px]">
      {STATUS_ORDER.map((status) => (
        <Column
          key={status}
          status={status}
          filters={filters}
          filter={filter}
          {...actions}
        />
      ))}
    </div>
  );
}

function Column({
  status,
  filters,
  filter,
  ...actions
}: Omit<StatusBoardProps, 'filters' | 'filter'> & {
  status: ContentBriefStatus;
  filters: CommonFilters;
  filter: QuickFilter;
}) {
  const query = useContentBriefsByStatus(status, filters, filter);
  const briefs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.total;

  return (
    <section aria-labelledby={`coluna-${status}`} className="min-w-0">
      <h2
        id={`coluna-${status}`}
        className="m-0 mb-2.5 flex items-baseline gap-2.5 font-bold font-display text-[17px] leading-[1.2] tracking-[-0.01em]"
      >
        {STATUS_LABEL[status]}
        {total !== undefined && (
          <span className="font-medium font-mono text-muted text-xs tabular-nums leading-none">
            {total}
          </span>
        )}
      </h2>
      <div className="flex flex-col gap-2.5">
        {query.isError && !query.data ? (
          <QueryError
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : query.isPending ? (
          <p role="status" className="m-0 text-muted text-sm">
            Carregando…
          </p>
        ) : briefs.length === 0 ? (
          <p className="m-0 text-muted text-sm">Nenhuma pauta</p>
        ) : (
          briefs.map((brief) => (
            <ContentBriefItem
              key={brief.id}
              brief={brief}
              variant="card"
              {...actions}
            />
          ))
        )}
        {query.hasNextPage && (
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Carregar mais
          </Button>
        )}
      </div>
    </section>
  );
}

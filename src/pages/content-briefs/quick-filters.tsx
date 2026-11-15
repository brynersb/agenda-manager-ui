import { Chip } from '@/components/ui/chip';
import { QUICK_FILTERS } from '@/lib/labels';
import type { ContentBriefSummary, QuickFilter } from '@/types/content-brief';

/**
 * Contagem de cada filtro rápido, a partir do resumo da API.
 *
 * "Próximos 7 dias" soma `today` e `next-7-days`, como no protótipo.
 *
 * @param summary Resumo vigente.
 * @returns Mapa filtro → quantidade de pautas.
 */
export function countQuickFilters(
  summary: ContentBriefSummary,
): Record<QuickFilter, number> {
  const { byDueStatus } = summary;
  return {
    all: summary.total,
    overdue: byDueStatus.overdue,
    'next-7-days': byDueStatus.today + byDueStatus['next-7-days'],
    completed: byDueStatus.completed,
  };
}

interface QuickFiltersProps {
  filter: QuickFilter;
  onChange: (filter: QuickFilter) => void;
  /** Sem resumo (carregando), os chips aparecem sem contagem. */
  summary?: ContentBriefSummary;
}

/**
 * Chips de filtro rápido com contagem; "Atrasadas" fica vermelho quando há
 * pautas atrasadas.
 *
 * @param props.filter Filtro ativo.
 * @param props.onChange Recebe o filtro escolhido.
 * @param props.summary Fonte das contagens.
 * @returns O grupo de chips.
 */
export function QuickFilters({ filter, onChange, summary }: QuickFiltersProps) {
  const counts = summary ? countQuickFilters(summary) : undefined;

  return (
    <fieldset
      aria-label="Filtros rápidos"
      className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
    >
      {QUICK_FILTERS.map(({ value, label }) => (
        <Chip
          key={value}
          pressed={filter === value}
          count={counts?.[value]}
          alert={value === 'overdue' && (counts?.overdue ?? 0) > 0}
          onClick={() => onChange(value)}
        >
          {label}
        </Chip>
      ))}
    </fieldset>
  );
}

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select';
import { useRegistries } from '@/hooks/use-registries';
import { ACTION_LABEL, ACTION_ORDER } from '@/lib/labels';
import type { ContentBriefAction, ViewMode } from '@/types/content-brief';
import type { Registry, RegistryKind } from '@/types/registry';
import type { FiltersChange, ScreenFilters } from './use-url-filters';
import { SEARCH_MIN_LENGTH } from './use-url-filters';

const SEARCH_DEBOUNCE_MS = 300;
const ALL = 'all';
const NONE = 'none';

interface Option {
  key: string;
  label: string;
}

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'dueDate', label: 'Por prazo' },
  { value: 'status', label: 'Por status' },
];

function effectiveTerm(text: string): string | undefined {
  const term = text.trim();
  return term.length >= SEARCH_MIN_LENGTH ? term : undefined;
}

function registryOptions(
  registries: Registry[] | undefined,
  allLabel: string,
  noneLabel: string,
): Option[] {
  return [
    { key: ALL, label: allLabel },
    { key: NONE, label: noneLabel },
    ...(registries ?? []).map((r) => ({
      key: r.id,
      label: r.active ? r.name : `${r.name} (arquivado)`,
    })),
  ];
}

interface RegistryFilterProps {
  label: string;
  kind: RegistryKind;
  value: string | undefined;
  allLabel: string;
  noneLabel: string;
  enabled: boolean;
  onChange: (value: string | undefined) => void;
}

function RegistryFilter({
  label,
  kind,
  value,
  allLabel,
  noneLabel,
  enabled,
  onChange,
}: RegistryFilterProps) {
  const { data } = useRegistries(kind, {
    includeArchived: true,
    enabled,
  });
  const options = useMemo(
    () => registryOptions(data, allLabel, noneLabel),
    [data, allLabel, noneLabel],
  );
  const selected = options.find((o) => o.key === (value ?? ALL)) ?? options[0];

  return (
    <div className="min-w-0">
      <SelectField<Option>
        compact
        aria-label={label}
        value={selected}
        items={options}
        getKey={(o) => o.key}
        getLabel={(o) => o.label}
        onValueChange={(o) => onChange(o.key === ALL ? undefined : o.key)}
      />
    </div>
  );
}

const ACTION_OPTIONS: Option[] = [
  { key: ALL, label: 'Todas as ações' },
  ...ACTION_ORDER.map((a) => ({ key: a, label: ACTION_LABEL[a] })),
];

interface FilterBarProps {
  filters: ScreenFilters;
  onChange: (change: FiltersChange) => void;
  /** Lista empreendimentos e responsáveis (`registry:read`). */
  canReadRegistries: boolean;
  /** Mostra o botão de editar os cadastros (`registry:write`). */
  canEditRegistries: boolean;
  onEditRegistries: () => void;
  /** Chips de filtro rápido, que dividem a primeira linha com a busca. */
  quickFilters: ReactNode;
}

/**
 * Busca, alternância Por prazo | Por status e filtros por empreendimento,
 * responsável e ação.
 *
 * A busca guarda o texto digitado localmente e só o leva para a URL depois de
 * 300 ms parado e com 2 caracteres ou mais; com 0 ou 1 caractere o filtro é
 * limpo. Os selects de empreendimento e responsável incluem arquivados
 * (marcados) para que pautas antigas continuem filtráveis. Sem `registry:read`
 * eles não consultam e ficam só com "Todos" e "Sem …".
 *
 * @param props.filters Estado atual vindo da URL.
 * @param props.onChange Aplica uma alteração nos filtros.
 * @param props.canReadRegistries Permite consultar os cadastros.
 * @param props.canEditRegistries Mostra o botão do painel de cadastros.
 * @param props.onEditRegistries Abre o painel de cadastros.
 * @param props.quickFilters Chips exibidos à esquerda da busca.
 * @returns A barra de ferramentas e a linha de filtros.
 */
export function FilterBar({
  filters,
  onChange,
  canReadRegistries,
  canEditRegistries,
  onEditRegistries,
  quickFilters,
}: FilterBarProps) {
  const [text, setText] = useState(filters.q ?? '');

  // A URL pode mudar por fora (Limpar filtros, voltar no histórico).
  useEffect(() => {
    setText((current) =>
      effectiveTerm(current) === filters.q ? current : (filters.q ?? ''),
    );
  }, [filters.q]);

  useEffect(() => {
    const term = effectiveTerm(text);
    if (term === filters.q) return;
    const timeout = setTimeout(() => onChange({ q: term }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [text, filters.q, onChange]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {quickFilters}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <input
            type="search"
            aria-label="Buscar pauta"
            placeholder="Buscar pauta"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-[38px] w-[200px] min-w-0 max-w-full rounded-lg border border-line-strong bg-surface px-3 text-ink text-sm placeholder:text-muted focus:outline-2 focus:outline-accent focus:outline-offset-2"
          />
          <SegmentedControl
            label="Modo de exibição"
            options={VIEW_OPTIONS}
            value={filters.view}
            onChange={(view) => onChange({ view })}
          />
        </div>
      </div>

      <fieldset
        aria-label="Filtros por empreendimento, responsável e ação"
        className="m-0 mb-6 flex min-w-0 flex-wrap items-center gap-2.5 border-0 p-0"
      >
        <span className="mr-0.5 font-medium font-mono text-muted text-xs uppercase leading-none tracking-[0.08em]">
          Filtrar por
        </span>
        <RegistryFilter
          label="Empreendimento"
          kind="estate-developments"
          value={filters.estateDevelopmentId}
          allLabel="Todos os empreendimentos"
          noneLabel="Sem empreendimento"
          enabled={canReadRegistries}
          onChange={(estateDevelopmentId) => onChange({ estateDevelopmentId })}
        />
        <RegistryFilter
          label="Responsável"
          kind="owners"
          value={filters.ownerId}
          allLabel="Todos os responsáveis"
          noneLabel="Sem responsável"
          enabled={canReadRegistries}
          onChange={(ownerId) => onChange({ ownerId })}
        />
        <div className="min-w-0">
          <SelectField<Option>
            compact
            aria-label="Ação"
            value={
              ACTION_OPTIONS.find((o) => o.key === (filters.action ?? ALL)) ??
              ACTION_OPTIONS[0]
            }
            items={ACTION_OPTIONS}
            getKey={(o) => o.key}
            getLabel={(o) => o.label}
            onValueChange={(o) =>
              onChange({
                action:
                  o.key === ALL ? undefined : (o.key as ContentBriefAction),
              })
            }
          />
        </div>
        {canEditRegistries && (
          <Button size="sm" variant="secondary" onClick={onEditRegistries}>
            Editar empreendimentos e responsáveis
          </Button>
        )}
      </fieldset>
    </>
  );
}

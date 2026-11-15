import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { usePreferences } from '@/hooks/use-preferences';
import { ACTION_ORDER } from '@/lib/labels';
import type {
  CommonFilters,
  ContentBriefAction,
  QuickFilter,
  ViewMode,
} from '@/types/content-brief';

/** Tamanho mínimo da busca (contrato §4); abaixo disso o filtro é limpo. */
export const SEARCH_MIN_LENGTH = 2;

const VIEWS: ViewMode[] = ['dueDate', 'status'];
const QUICK_FILTER_VALUES: QuickFilter[] = [
  'all',
  'overdue',
  'next-7-days',
  'completed',
];

/**
 * Estado da tela guardado na URL. As chaves são os próprios parâmetros da URL
 * (`view`, `dueStatus`, `estateDevelopmentId`, `ownerId`, `action`, `q`).
 */
export interface ScreenFilters {
  view: ViewMode;
  /** Filtro rápido (chip), que a URL guarda como `dueStatus`. */
  dueStatus: QuickFilter;
  /** Uuid do empreendimento ou `'none'`. */
  estateDevelopmentId?: string;
  /** Uuid do responsável ou `'none'`. */
  ownerId?: string;
  action?: ContentBriefAction;
  /** Termo de busca já com 2 caracteres ou mais. */
  q?: string;
}

/** Campos que a tela pode alterar; `undefined` remove o parâmetro da URL. */
export type FiltersChange = {
  [K in keyof ScreenFilters]?: ScreenFilters[K] | undefined;
};

function optionOf<T extends string>(
  value: string | null,
  valid: readonly T[],
): T | undefined {
  return valid.find((v) => v === value);
}

/**
 * Filtros da tela de pautas, guardados na URL, para que o link copiado
 * reproduza a tela.
 *
 * `view` e `dueStatus` ausentes da URL caem nas preferências do `localStorage`
 * e, sem elas, em "Por prazo" e "Todas". As alterações usam `replace` (filtro
 * não deve poluir o histórico) e preservam os demais parâmetros, como
 * `?brief=<id>` do editor.
 *
 * @returns `filters` da tela, `commonFilters` no formato da API, `change` e
 * `clear`.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const { preferences, save } = usePreferences();

  const view = optionOf(params.get('view'), VIEWS) ?? preferences.view;
  const dueStatus =
    optionOf(params.get('dueStatus'), QUICK_FILTER_VALUES) ??
    preferences.dueStatus;
  const estateDevelopmentId = params.get('estateDevelopmentId') || undefined;
  const ownerId = params.get('ownerId') || undefined;
  const action = optionOf(params.get('action'), ACTION_ORDER);
  const term = params.get('q')?.trim() ?? '';
  const q = term.length >= SEARCH_MIN_LENGTH ? term : undefined;

  const filters: ScreenFilters = {
    view,
    dueStatus,
    estateDevelopmentId,
    ownerId,
    action,
    q,
  };

  const commonFilters = useMemo<CommonFilters>(
    () => ({
      estateDevelopmentId,
      ownerId,
      action,
      q,
    }),
    [estateDevelopmentId, ownerId, action, q],
  );

  const change = useCallback(
    (alteration: FiltersChange) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(alteration)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
      if (alteration.view || alteration.dueStatus) {
        save({
          ...(alteration.view && { view: alteration.view }),
          ...(alteration.dueStatus && { dueStatus: alteration.dueStatus }),
        });
      }
    },
    [setParams, save],
  );

  /** Volta aos filtros padrão; mantém a visão escolhida. */
  const clear = useCallback(
    () =>
      change({
        dueStatus: 'all',
        estateDevelopmentId: undefined,
        ownerId: undefined,
        action: undefined,
        q: undefined,
      }),
    [change],
  );

  const hasCommonFilter =
    estateDevelopmentId !== undefined ||
    ownerId !== undefined ||
    action !== undefined ||
    q !== undefined;

  return { filters, commonFilters, hasCommonFilter, change, clear };
}

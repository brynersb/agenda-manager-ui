import { useQuery } from '@tanstack/react-query';

import {
  CONTENT_BRIEF_QUERY_OPTIONS,
  toSearchParams,
} from '@/hooks/use-content-briefs';
import { useApi } from '@/lib/api';
import type { CommonFilters, ContentBriefSummary } from '@/types/content-brief';

/**
 * Contagens da tela (`GET /content-briefs/summary`): total, por situação e por
 * status.
 *
 * Alimenta os chips e decide os estados vazios. Respeita os filtros comuns
 * (empreendimento, responsável, ação, busca) e ignora o chip: por isso cada
 * chip mostra quantas pautas teria, mesmo com outro selecionado. A chave
 * começa em `['content-briefs']` para ser invalidada junto com as listas.
 *
 * @param filters Filtros comuns.
 * @returns A query com `ContentBriefSummary` em `data`; `data.today` é a data
 * de referência do servidor.
 */
export function useContentBriefSummary(filters: CommonFilters) {
  const api = useApi();

  return useQuery({
    queryKey: ['content-briefs', 'summary', filters],
    queryFn: () =>
      api
        .get('content-briefs/summary', {
          searchParams: toSearchParams(filters),
        })
        .json<ContentBriefSummary>(),
    ...CONTENT_BRIEF_QUERY_OPTIONS,
  });
}

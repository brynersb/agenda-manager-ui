import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi } from '@/lib/api';
import type { Registry, RegistryKind } from '@/types/registry';

/** Opções da listagem de cadastros. */
interface UseRegistriesOptions {
  /** Inclui os arquivados na resposta; padrão `false`. */
  includeArchived?: boolean;
  /** `false` não consulta (ex.: sem `registry:read`); padrão `true`. */
  enabled?: boolean;
}

/** Entrada do `PATCH` de renomear. */
interface RenameRegistryInput {
  id: string;
  name: string;
  /** `version` lida na listagem, para detectar edição concorrente. */
  version: number;
}

const FIVE_MINUTES_MS = 1000 * 60 * 5;

/**
 * Lista empreendimentos ou responsáveis, ordenados por nome pela API.
 *
 * A lista muda pouco, então fica 5 minutos sem refetch; as mutações abaixo
 * invalidam a chave `['registries', kind]` e atualizam a tela na hora.
 *
 * @param kind Qual recurso consultar.
 * @param options `includeArchived` para trazer também os arquivados;
 * `enabled` para não consultar.
 * @returns O resultado da query com `Registry[]` em `data`.
 */
export function useRegistries(
  kind: RegistryKind,
  { includeArchived = false, enabled = true }: UseRegistriesOptions = {},
) {
  const api = useApi();

  return useQuery({
    queryKey: ['registries', kind, { includeArchived }],
    queryFn: () =>
      api.get(kind, { searchParams: { includeArchived } }).json<Registry[]>(),
    staleTime: FIVE_MINUTES_MS,
    enabled,
  });
}

/**
 * Cria um cadastro (`POST /<kind>`).
 *
 * Erros (`*_NAME_DUPLICATED`...) sobem para quem chama mostrar no campo.
 *
 * @param kind Qual recurso criar.
 * @returns A mutation; a variável é o `name`.
 */
export function useCreateRegistry(kind: RegistryKind) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api.post(kind, { json: { name } }).json<Registry>(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['registries', kind] }),
  });
}

/**
 * Renomeia um cadastro (`PATCH /<kind>/:id`).
 *
 * Invalida também `['content-briefs']`: o nome vem embutido em cada pauta.
 *
 * @param kind Qual recurso renomear.
 * @returns A mutation; a variável é `{ id, name, version }`.
 */
export function useRenameRegistry(kind: RegistryKind) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, version }: RenameRegistryInput) =>
      api.patch(`${kind}/${id}`, { json: { name, version } }).json<Registry>(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registries', kind] }),
        queryClient.invalidateQueries({ queryKey: ['content-briefs'] }),
      ]),
  });
}

/**
 * Arquiva um cadastro (`POST /<kind>/:id/archive`, idempotente).
 *
 * Invalida também `['content-briefs']`: as pautas continuam com o nome, mas
 * passam a exibi-lo como arquivado.
 *
 * @param kind Qual recurso arquivar.
 * @returns A mutation; a variável é o `id`.
 */
export function useArchiveRegistry(kind: RegistryKind) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${kind}/${id}/archive`).json<Registry>(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registries', kind] }),
        queryClient.invalidateQueries({ queryKey: ['content-briefs'] }),
      ]),
  });
}

/**
 * Reativa um cadastro arquivado (`POST /<kind>/:id/reactivate`, idempotente).
 *
 * @param kind Qual recurso reativar.
 * @returns A mutation; a variável é o `id`.
 */
export function useReactivateRegistry(kind: RegistryKind) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post(`${kind}/${id}/reactivate`).json<Registry>(),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['registries', kind] }),
        queryClient.invalidateQueries({ queryKey: ['content-briefs'] }),
      ]),
  });
}

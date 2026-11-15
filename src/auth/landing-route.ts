import type { Permission } from '@/types/auth';

/**
 * Primeira tela que a pessoa pode usar, na ordem de prioridade.
 *
 * Só há uma tela hoje; a lista existe para que acrescentar telas não mude a
 * regra de quem cai onde.
 */
const LANDING_ROUTES: ReadonlyArray<{
  permission: Permission;
  path: string;
}> = [{ permission: 'content-brief:read', path: '/content-briefs' }];

/**
 * Rota de entrada para um conjunto de permissões.
 *
 * @param permissions Permissões vindas de `/auth/user-info`.
 * @returns `/content-briefs` com `content-brief:read`; `/no-permission` quando nada serve.
 */
export function getLandingRoute(permissions: readonly Permission[]): string {
  return (
    LANDING_ROUTES.find(({ permission }) => permissions.includes(permission))
      ?.path ?? '/no-permission'
  );
}

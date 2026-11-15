import type { Permission } from '@/types/auth';

/**
 * Primeira tela que a pessoa pode usar, na ordem de prioridade.
 *
 * A lista existe para que acrescentar telas não mude a regra de quem cai onde.
 */
const LANDING_ROUTES: ReadonlyArray<{
  permission: Permission;
  path: string;
}> = [
  { permission: 'content-brief:read', path: '/content-briefs' },
  { permission: 'user:read', path: '/users' },
];

/**
 * Rota de entrada para um conjunto de permissões.
 *
 * @param permissions Permissões da sessão (vindas da API).
 * @returns `/content-briefs` com `content-brief:read`, `/users` só com
 * `user:read`; `/no-permission` quando nada serve.
 */
export function getLandingRoute(permissions: readonly Permission[]): string {
  return (
    LANDING_ROUTES.find(({ permission }) => permissions.includes(permission))
      ?.path ?? '/no-permission'
  );
}

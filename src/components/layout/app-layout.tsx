import { Outlet } from 'react-router';

import logoBora from '@/assets/logo-bora.png';
import { useAuthContext } from '@/auth/use-auth';
import { UserMenu } from '@/components/layout/user-menu';
import { formatLongDate } from '@/lib/date';

/**
 * Layout das telas autenticadas.
 *
 * Sem sidebar: a navegação fica no menu da pessoa (Pautas, Usuários). Barra
 * superior com logo, data de hoje por extenso e esse menu; abaixo, o conteúdo da rota num bloco
 * centralizado de até 1120 px com gutter de 16 px.
 *
 * @returns A barra e a área da página (`Outlet`).
 */
export function AppLayout() {
  const { name, role, signOut, hasPermission } = useAuthContext();

  return (
    <div className="mx-auto max-w-[1120px] px-4 pt-6 pb-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <span className="inline-flex rounded-card bg-white px-3 py-1.5">
          <img src={logoBora} alt="Bora" className="block h-[42px] w-auto" />
        </span>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <time className="font-medium font-mono text-muted text-xs uppercase leading-none tracking-[0.08em]">
            {formatLongDate()}
          </time>
          <UserMenu
            name={name}
            userRole={role}
            canReadContentBriefs={hasPermission('content-brief:read')}
            canReadUsers={hasPermission('user:read')}
            onSignOut={signOut}
          />
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

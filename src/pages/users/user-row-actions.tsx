import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  UserCheck,
  UserX,
} from 'lucide-react';

import type { User } from '@/types/user';

const ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover';

/** Ação escolhida no menu da linha. */
export type UserAction = 'edit' | 'deactivate' | 'reactivate' | 'reset';

interface UserRowActionsProps {
  user: User;
  /** A linha é a da pessoa logada: não desativa nem redefine a si mesma. */
  isSelf: boolean;
  onAction: (action: UserAction, user: User) => void;
}

/**
 * Menu "Ações" de uma linha da lista de usuários (só com `user:write`).
 *
 * A própria pessoa logada só pode editar o nome: nada de desativar a si mesma
 * (`CANNOT_MODIFY_SELF`) nem de redefinir a própria senha (que encerraria a
 * sessão em uso; para trocá-la há "Alterar senha" no menu do usuário).
 *
 * @param props.user Usuário da linha.
 * @param props.isSelf Se é a pessoa logada.
 * @param props.onAction Recebe a ação escolhida.
 * @returns O gatilho e o menu.
 */
export function UserRowActions({
  user,
  isSelf,
  onAction,
}: UserRowActionsProps) {
  const active = user.status === 'ACTIVE';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${user.name}`}
          data-user-actions={user.id}
          className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface text-ink hover:bg-hover"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-30 min-w-48 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-float"
        >
          <DropdownMenu.Item
            onSelect={() => onAction('edit', user)}
            className={ITEM_CLASS}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </DropdownMenu.Item>
          {!isSelf && (
            <>
              <DropdownMenu.Item
                onSelect={() => onAction('reset', user)}
                className={ITEM_CLASS}
              >
                <KeyRound className="size-4" aria-hidden="true" />
                Redefinir senha
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() =>
                  onAction(active ? 'deactivate' : 'reactivate', user)
                }
                className={`${ITEM_CLASS} ${active ? 'text-late' : ''}`}
              >
                {active ? (
                  <UserX className="size-4" aria-hidden="true" />
                ) : (
                  <UserCheck className="size-4" aria-hidden="true" />
                )}
                {active ? 'Desativar' : 'Reativar'}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

import { USER_STATUS_LABEL } from '@/lib/labels';
import type { UserStatus } from '@/types/user';

/**
 * Aparência da pílula de cada situação, só com tokens `pill-*` (o tema `soft`
 * troca os valores, sem mudar as classes): ativo no tom de destaque,
 * desativado no tom neutro.
 */
const STATUS_CLASSES: Record<UserStatus, string> = {
  ACTIVE: 'border-transparent bg-pill-progress-bg text-pill-progress-ink',
  DEACTIVATED: 'border-pill-todo-line bg-pill-todo-bg text-pill-todo-ink',
};

/**
 * Pílula da situação do usuário (Ativo ou Desativado).
 *
 * @param props.status Situação do cadastro.
 * @returns A pílula com o rótulo em pt-BR.
 */
export function UserStatusPill({ status }: { status: UserStatus }) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center rounded-full border px-2.5 font-semibold text-xs leading-none ${STATUS_CLASSES[status]}`}
    >
      {USER_STATUS_LABEL[status]}
    </span>
  );
}

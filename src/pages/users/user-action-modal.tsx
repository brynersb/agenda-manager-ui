import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Modal } from '@/components/ui/modal';
import {
  useDeactivateUser,
  useReactivateUser,
  useResetUserPassword,
  usersKeys,
} from '@/hooks/use-users';
import { getApiErrorMessage, isCode } from '@/lib/api-error';
import type { User, UserWithTemporaryPassword } from '@/types/user';

/** Ações que pedem confirmação antes de mexer no usuário. */
export type ConfirmableUserAction = 'deactivate' | 'reactivate' | 'reset';

/** O que a confirmação entrega à tela ao dar certo. */
export type UserActionResult =
  | { action: 'deactivate' | 'reactivate'; user: User }
  | { action: 'reset'; result: UserWithTemporaryPassword };

interface UserActionModalProps {
  action: ConfirmableUserAction;
  user: User;
  onClose: () => void;
  onDone: (result: UserActionResult) => void;
}

const COPY: Record<
  ConfirmableUserAction,
  { title: (name: string) => string; description: string; confirm: string }
> = {
  deactivate: {
    title: (name) => `Desativar "${name}"?`,
    description:
      'A pessoa perde o acesso: não consegue mais entrar nem renovar a sessão (a sessão já aberta pode durar alguns minutos). Você pode reativá-la quando quiser.',
    confirm: 'Desativar',
  },
  reactivate: {
    title: (name) => `Reativar "${name}"?`,
    description:
      'A pessoa volta a poder entrar com a senha atual e a conta é destravada, se estiver bloqueada.',
    confirm: 'Reativar',
  },
  reset: {
    title: (name) => `Redefinir a senha de "${name}"?`,
    description:
      'Uma senha provisória será gerada e mostrada uma única vez. As sessões abertas da pessoa são encerradas, a conta é destravada e ela terá de trocar a senha no próximo acesso.',
    confirm: 'Redefinir senha',
  },
};

/**
 * Confirmação de desativar, reativar ou redefinir a senha de um usuário.
 *
 * O erro da API aparece dentro do modal, que fica aberto para tentar de novo ou
 * cancelar: `LAST_ADMIN` e `CANNOT_MODIFY_SELF` explicam por que a regra
 * barrou, e um `409` de versão ou `404` também recarrega a lista, que já pode
 * ter mudado.
 *
 * @param props.action Ação a confirmar.
 * @param props.user Usuário alvo.
 * @param props.onClose Cancela ou fecha.
 * @param props.onDone Recebe o resultado depois de dar certo.
 * @returns O modal de confirmação.
 */
export function UserActionModal({
  action,
  user,
  onClose,
  onDone,
}: UserActionModalProps) {
  const queryClient = useQueryClient();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const reset = useResetUserPassword();
  const [error, setError] = useState<string | null>(null);

  const pending =
    deactivate.isPending || reactivate.isPending || reset.isPending;
  const copy = COPY[action];

  async function confirm() {
    setError(null);
    try {
      if (action === 'reset') {
        onDone({ action, result: await reset.mutateAsync(user.id) });
      } else if (action === 'deactivate') {
        onDone({ action, user: await deactivate.mutateAsync(user.id) });
      } else {
        onDone({ action, user: await reactivate.mutateAsync(user.id) });
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
      if (isCode(e, 'USER_VERSION_OUTDATED') || isCode(e, 'USER_NOT_FOUND')) {
        void queryClient.invalidateQueries({ queryKey: usersKeys.all });
      }
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={copy.title(user.name)}
      description={copy.description}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={action === 'reactivate' ? 'primary' : 'danger'}
            loading={pending}
            onClick={() => void confirm()}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      {error && (
        <div role="alert">
          <FieldError>{error}</FieldError>
        </div>
      )}
    </Modal>
  );
}

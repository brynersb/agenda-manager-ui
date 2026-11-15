import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { User } from '@/types/user';

interface TemporaryPasswordDialogProps {
  user: User;
  /** Senha provisória devolvida pela API; some quando o diálogo fecha. */
  password: string;
  /** `created` (cadastro) ou `reset` (redefinição), só para o título. */
  reason: 'created' | 'reset';
  onClose: () => void;
}

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copia pelo caminho antigo (`execCommand`) quando a API de área de
 * transferência não está disponível: ela exige contexto seguro e permissão, e
 * a demonstração pode ser aberta por `http` fora do `localhost`. O campo
 * temporário fica dentro do diálogo, onde o foco preso do Radix o aceita.
 */
function legacyCopy(text: string, container: HTMLElement): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.className = 'fixed top-0 left-0 size-px opacity-0';
  container.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/**
 * Mostra a senha provisória **uma única vez**: a API não a devolve de novo.
 *
 * Tem botão de copiar e um aviso claro de que a senha não será mostrada outra
 * vez. O clique fora não fecha o diálogo (um toque perdido apagaria a senha
 * para sempre); "Concluir" e Esc fecham. A senha vive só no estado deste
 * componente e some ao fechar.
 *
 * @param props.user Usuário dono da senha.
 * @param props.password A senha provisória.
 * @param props.reason Cadastro ou redefinição.
 * @param props.onClose Fecha o diálogo.
 * @returns O diálogo.
 */
export function TemporaryPasswordDialog({
  user,
  password,
  reason,
  onClose,
}: TemporaryPasswordDialogProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');

  async function copy(container: HTMLElement) {
    try {
      await navigator.clipboard.writeText(password);
      setCopyState('copied');
    } catch {
      setCopyState(legacyCopy(password, container) ? 'copied' : 'failed');
    }
  }

  return (
    <Modal
      open
      dismissOnOutsideClick={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={reason === 'created' ? 'Usuário criado' : 'Senha redefinida'}
      description={`Senha provisória de ${user.name}. Repasse por um canal seguro: no primeiro acesso a pessoa terá de definir uma senha nova.`}
      footer={<Button onClick={onClose}>Concluir</Button>}
    >
      <p
        role="alert"
        className="m-0 rounded-lg border border-late bg-late-bg p-3 font-semibold text-late text-sm"
      >
        Esta senha não será mostrada de novo. Copie agora.
      </p>
      <div className="flex flex-col gap-2 rounded-lg border border-line-strong bg-hover p-3">
        <span className="text-muted text-xs">Senha provisória</span>
        <code className="select-all break-all font-medium font-mono text-lg">
          {password}
        </code>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={
              copyState === 'copied' ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )
            }
            onClick={(event) =>
              void copy(
                event.currentTarget.parentElement ?? event.currentTarget,
              )
            }
          >
            {copyState === 'copied' ? 'Copiada' : 'Copiar senha'}
          </Button>
          <span role="status" className="text-sm">
            {copyState === 'copied' &&
              'Senha copiada para a área de transferência.'}
            {copyState === 'failed' &&
              'Não foi possível copiar. Selecione a senha e copie manualmente.'}
          </span>
        </div>
      </div>
    </Modal>
  );
}

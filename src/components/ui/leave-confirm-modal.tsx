import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface LeaveConfirmModalProps {
  /** Se o aviso está aberto. */
  open: boolean;
  /** Notifica abertura e fechamento; fechar equivale a "Continuar editando". */
  onOpenChange: (open: boolean) => void;
  /** Chamado ao confirmar a saída, descartando o que foi preenchido. */
  onLeave: () => void;
  /** Texto de apoio; o padrão serve a qualquer formulário. */
  description?: string;
}

/**
 * Aviso "Descartar alterações?" exibido ao sair de um formulário com
 * alterações não salvas. A ação segura ("Continuar editando") é a principal e
 * Esc também a escolhe.
 *
 * @param props.open Se o aviso está aberto.
 * @param props.onOpenChange Notifica abertura e fechamento.
 * @param props.onLeave Chamado ao escolher "Descartar".
 * @param props.description Texto explicativo opcional.
 * @returns O modal de confirmação.
 */
export function LeaveConfirmModal({
  open,
  onOpenChange,
  onLeave,
  description = 'O que você alterou ainda não foi salvo e será perdido. Essa ação não pode ser desfeita.',
}: LeaveConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Descartar alterações?"
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onLeave}>
            Descartar
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Continuar editando
          </Button>
        </>
      }
    />
  );
}

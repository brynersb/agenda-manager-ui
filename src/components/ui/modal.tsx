import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Texto de apoio abaixo do título; vira `aria-describedby`. */
  description?: string;
  /** Ações (normalmente "Cancelar" e a ação principal). */
  footer?: ReactNode;
  children?: ReactNode;
  /**
   * `false` ignora o clique fora do diálogo (Esc e os botões continuam
   * fechando). Para conteúdo que não se recupera, como a senha provisória.
   */
  dismissOnOutsideClick?: boolean;
}

/**
 * Diálogo modal centralizado, usado para confirmações.
 *
 * Não tem botão "X": a saída é pelo botão de cancelar do rodapé ou por Esc.
 *
 * @param props.open Se o modal está aberto.
 * @param props.onOpenChange Notifica abertura e fechamento.
 * @param props.title Título (nome acessível do diálogo).
 * @param props.description Texto explicativo.
 * @param props.footer Botões de ação.
 * @param props.children Conteúdo extra.
 * @param props.dismissOnOutsideClick Se o clique fora fecha; padrão `true`.
 * @returns O modal.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  dismissOnOutsideClick = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-overlay-in bg-scrim" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          onInteractOutside={
            dismissOnOutsideClick ? undefined : (e) => e.preventDefault()
          }
          className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-overlay-in flex-col gap-4 rounded-xl border border-line bg-surface p-6 text-ink shadow-float"
        >
          <Dialog.Title className="m-0 font-bold font-display text-xl leading-tight tracking-tight">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="m-0 text-muted">
              {description}
            </Dialog.Description>
          )}
          {children}
          {footer && (
            <div className="flex flex-wrap justify-end gap-2.5">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

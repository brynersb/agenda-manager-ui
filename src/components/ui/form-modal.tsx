import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import type { DrawerProps } from './drawer';
import { resolveEscapeKeyDown } from './escape-local';

/** Largura máxima do modal: `md` serve a formulários, `lg` a listas. */
type FormModalSize = 'md' | 'lg';

export interface FormModalProps extends DrawerProps {
  /** Largura do modal em telas largas; padrão `md` (640 px). */
  size?: FormModalSize;
}

const SIZE_CLASSES: Record<FormModalSize, string> = {
  md: 'max-w-[640px]',
  lg: 'max-w-[760px]',
};

/**
 * Modal centralizado de formulário, o par do `Drawer` (mesmo contrato).
 *
 * Usa o Dialog do Radix, então o foco fica preso e volta a quem abriu, Esc e
 * clique fora pedem para fechar (quem usa decide, ex.: confirmar descarte) e o
 * `Dialog.Title` vira o nome acessível. O corpo rola por dentro, com altura
 * máxima de 90% da tela, e o rodapé de ações fica sempre visível. Até 640 px
 * vira uma folha colada na base da tela (com até 92% da altura), que é mais
 * natural de alcançar com o polegar do que um quadro flutuante.
 *
 * @param props.open Se o modal está aberto.
 * @param props.onOpenChange Notifica abertura e fechamento.
 * @param props.title Título exibido no cabeçalho.
 * @param props.children Conteúdo rolável.
 * @param props.footer Ações do rodapé.
 * @param props.onEscapeKeyDown Intercepta Esc; o padrão respeita `data-esc-local`.
 * @param props.size Largura máxima em telas largas.
 * @returns O modal de formulário.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  onEscapeKeyDown,
  onOpenAutoFocus,
  onCloseAutoFocus,
  size = 'md',
}: FormModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-overlay-in bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          data-form-presentation="modal"
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) =>
            resolveEscapeKeyDown(event, onEscapeKeyDown)
          }
          className={`fixed top-1/2 left-1/2 z-50 flex max-h-[min(90dvh,860px)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 animate-modal-in flex-col rounded-xl border border-line bg-surface text-ink shadow-float max-[640px]:top-auto max-[640px]:bottom-0 max-[640px]:left-0 max-[640px]:max-h-[92dvh] max-[640px]:w-full max-[640px]:max-w-none max-[640px]:translate-x-0 max-[640px]:translate-y-0 max-[640px]:animate-sheet-in max-[640px]:rounded-t-xl max-[640px]:rounded-b-none ${SIZE_CLASSES[size]}`}
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 max-[640px]:px-5">
            <Dialog.Title className="m-0 font-bold font-display text-xl leading-tight tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2 max-[640px]:px-5">
            {children}
          </div>
          {footer && (
            <div className="flex flex-wrap gap-2.5 border-line border-t px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-[640px]:px-5">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

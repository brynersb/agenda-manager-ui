import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { resolveEscapeKeyDown } from './escape-local';

/** Contrato comum dos painéis de formulário (`Drawer`, `FormModal`). */
export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título do painel; também é o nome acessível (`aria-labelledby`). */
  title: string;
  children: ReactNode;
  /** Barra de ações fixa no rodapé do painel. */
  footer?: ReactNode;
  /**
   * Chamado quando Esc é pressionado; `event.preventDefault()` mantém o painel
   * aberto. Por padrão, Esc dentro de um elemento com `data-esc-local` (ou de
   * um descendente dele) não fecha o painel.
   */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Chamado quando o foco entra no painel (antes de ir ao primeiro controle). */
  onOpenAutoFocus?: (event: Event) => void;
  /** Chamado quando o painel fecha; `preventDefault()` assume o destino do foco. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Painel lateral direito com overlay, foco preso e fechamento por Esc.
 *
 * Usa o Dialog do Radix: o `Dialog.Title` vira o `aria-labelledby` do painel e
 * o foco volta ao elemento que o abriu. A animação de entrada some quando a
 * pessoa pede menos movimento (regra global em `index.css`).
 *
 * @param props.open Se o painel está aberto.
 * @param props.onOpenChange Notifica abertura e fechamento.
 * @param props.title Título exibido no cabeçalho.
 * @param props.children Conteúdo rolável.
 * @param props.footer Ações do rodapé.
 * @param props.onEscapeKeyDown Intercepta Esc; o padrão respeita `data-esc-local`.
 * @returns O painel lateral.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
  onEscapeKeyDown,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-overlay-in bg-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          data-form-presentation="drawer"
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) =>
            resolveEscapeKeyDown(event, onEscapeKeyDown)
          }
          className="fixed inset-y-0 right-0 z-50 flex h-full w-[min(500px,100%)] animate-drawer-in flex-col bg-surface text-ink shadow-drawer"
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <Dialog.Title className="m-0 font-display font-extrabold text-2xl leading-tight tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-2">{children}</div>
          {footer && (
            <div className="flex flex-wrap gap-2.5 border-line border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { X } from 'lucide-react';

/** Tom do feedback exibido: confirmação de sucesso ou erro. */
export type ToastVariant = 'success' | 'error';

/** Ação opcional oferecida no toast, como "Tentar novamente". */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
  onClose: () => void;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-toast-ok bg-toast-ok text-toast-ok-ink',
  error: 'border-late bg-late-bg text-late',
};

/**
 * Aviso temporário na parte inferior central da tela.
 *
 * Usa `role="status"` (educado, sem interromper a leitura), como o protótipo.
 *
 * @param props.variant Tom do feedback.
 * @param props.title Mensagem principal.
 * @param props.description Detalhe abaixo do título.
 * @param props.action Ação opcional, como repetir a operação que falhou.
 * @param props.onClose Chamado ao fechar o toast.
 * @returns O toast.
 */
export function Toast({
  variant,
  title,
  description,
  action,
  onClose,
}: ToastProps) {
  return (
    <div
      role="status"
      className={`fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-1/2 z-[70] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 animate-toast-in items-center gap-3 rounded-lg border px-4 py-2.5 shadow-float ${VARIANT_STYLES[variant]}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="m-0 font-medium text-sm leading-snug">{title}</p>
        {description && (
          <p className="m-0 text-[13px] leading-snug opacity-90">
            {description}
          </p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 cursor-pointer font-semibold text-[13px] underline underline-offset-2 hover:no-underline"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={onClose}
        className="shrink-0 cursor-pointer rounded p-0.5 hover:opacity-70"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

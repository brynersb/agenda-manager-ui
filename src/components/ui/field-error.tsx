import type { ReactNode } from 'react';

/**
 * Classes que marcam um controle de formulário inválido: borda e texto
 * `late` sobre fundo `late-bg`. Centralizadas aqui para que input, textarea e
 * select tenham exatamente o mesmo estado de erro.
 */
export const INVALID_CONTROL_CLASS = 'border-late bg-late-bg';

/**
 * Classes comuns de borda, fundo e foco de um controle de texto.
 */
export const CONTROL_CLASS =
  'w-full rounded-lg border bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-accent focus:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

interface FieldErrorProps {
  /** Id usado por `aria-describedby` do controle. */
  id?: string;
  children: ReactNode;
}

/**
 * Mensagem de erro exibida abaixo de um campo.
 *
 * @param props.id Id referenciado pelo controle em `aria-describedby`.
 * @param props.children Texto da mensagem.
 * @returns O parágrafo da mensagem de erro.
 */
export function FieldError({ id, children }: FieldErrorProps) {
  return (
    <p id={id} className="m-0 text-late text-sm">
      {children}
    </p>
  );
}

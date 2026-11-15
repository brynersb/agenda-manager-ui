import { type ReactNode, useId } from 'react';

import { FieldError } from './field-error';

/** Atributos que o controle filho deve receber para ficar ligado ao campo. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid': boolean;
}

interface FieldProps {
  /** Rótulo visível, ligado ao controle por `htmlFor`. */
  label: string;
  /** Texto de ajuda abaixo do controle. */
  help?: string;
  /** Mensagem de erro; também marca o controle como inválido. */
  error?: string;
  /** Contador "atual/máximo" de caracteres no canto do rótulo. */
  counter?: { current: number; max: number };
  /** Recebe os atributos de ligação e devolve o controle. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Casca de um campo de formulário: rótulo, controle, ajuda, erro e contador.
 *
 * O controle chega por render prop para que `id`, `aria-describedby` e
 * `aria-invalid` fiquem sempre consistentes sem `cloneElement`.
 *
 * @param props.label Rótulo do campo.
 * @param props.help Texto de ajuda.
 * @param props.error Mensagem de erro.
 * @param props.counter Contador de caracteres.
 * @param props.children Função que renderiza o controle.
 * @returns O campo completo.
 */
export function Field({ label, help, error, counter, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-ajuda`;
  const errorId = `${id}-erro`;
  const describedBy =
    [error ? errorId : null, help ? helpId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold text-[13px] leading-tight">
          {label}
        </label>
        {counter && (
          <span
            aria-live="off"
            className={`font-mono text-xs tabular-nums ${counter.current > counter.max ? 'text-late' : 'text-muted'}`}
          >
            {counter.current}/{counter.max}
          </span>
        )}
      </div>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })}
      {error && <FieldError id={errorId}>{error}</FieldError>}
      {help && (
        <p id={helpId} className="m-0 text-muted text-sm">
          {help}
        </p>
      )}
    </div>
  );
}

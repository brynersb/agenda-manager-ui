import type { TextareaHTMLAttributes } from 'react';

import { CONTROL_CLASS, INVALID_CONTROL_CLASS } from './field-error';

/**
 * Campo de texto multilinha. Use dentro de `Field` para rótulo e erro.
 *
 * @param props.aria-invalid Quando `true`, aplica o estado de erro visual.
 * @returns O textarea.
 */
export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const invalid = props['aria-invalid'] === true;
  return (
    <textarea
      className={`min-h-[110px] resize-y py-2.5 ${CONTROL_CLASS} ${invalid ? INVALID_CONTROL_CLASS : 'border-line-strong'} ${className}`}
      {...props}
    />
  );
}

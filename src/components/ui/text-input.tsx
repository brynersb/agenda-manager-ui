import type { ComponentProps } from 'react';

import { CONTROL_CLASS, INVALID_CONTROL_CLASS } from './field-error';

/**
 * Campo de texto de uma linha. Use dentro de `Field` para rótulo e erro.
 *
 * @param props.ref Ref do `<input>`, para quem precisa focá-lo.
 * @param props.aria-invalid Quando `true`, aplica o estado de erro visual.
 * @returns O input.
 */
export function TextInput({
  className = '',
  ...props
}: ComponentProps<'input'>) {
  const invalid = props['aria-invalid'] === true;
  return (
    <input
      className={`h-[42px] ${CONTROL_CLASS} ${invalid ? INVALID_CONTROL_CLASS : 'border-line-strong'} ${className}`}
      {...props}
    />
  );
}

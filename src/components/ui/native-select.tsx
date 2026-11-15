import { ChevronDown } from 'lucide-react';

import type { FieldControlProps } from './field';
import { CONTROL_CLASS, INVALID_CONTROL_CLASS } from './field-error';

/** Opção de um `NativeSelect`; o `value` pode ser `''` ("Nenhum"). */
export interface SelectOption {
  value: string;
  label: string;
}

interface NativeSelectProps {
  control: FieldControlProps;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled: boolean;
}

/**
 * `<select>` nativo com o visual dos demais controles. Nativo de propósito:
 * aceita o valor vazio de "Sem ação"/"Nenhum" (o Radix Select não aceita) e dá
 * teclado e seletor de celular de graça.
 *
 * @param props.control Atributos de ligação vindos de `Field`.
 * @param props.value Valor selecionado.
 * @param props.onChange Recebe o valor escolhido.
 * @param props.options Opções exibidas.
 * @param props.disabled Bloqueia a escolha.
 * @returns O seletor.
 */
export function NativeSelect({
  control,
  value,
  onChange,
  options,
  disabled,
}: NativeSelectProps) {
  return (
    <div className="relative">
      <select
        {...control}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`h-[42px] cursor-pointer appearance-none pr-9 ${CONTROL_CLASS} ${control['aria-invalid'] ? INVALID_CONTROL_CLASS : 'border-line-strong'}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}

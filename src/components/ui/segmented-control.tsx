interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nome acessível do grupo, como "Agrupar pautas". */
  label: string;
}

/**
 * Grupo de botões exclusivos, como "Por prazo | Por status".
 *
 * Cada opção é um botão com `aria-pressed` (padrão do protótipo), e não um
 * `radio`, para manter a navegação por Tab entre as opções.
 *
 * @param props.options Opções com valor e rótulo.
 * @param props.value Valor selecionado.
 * @param props.onChange Recebe o valor escolhido.
 * @param props.label Nome acessível do grupo.
 * @returns O grupo segmentado.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 inline-flex min-w-0 overflow-hidden rounded-lg border border-line-strong bg-surface p-0"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="h-9 cursor-pointer border-line-strong border-l px-3.5 font-medium text-sm first:border-l-0 aria-pressed:bg-seg-on aria-pressed:text-seg-on-ink"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

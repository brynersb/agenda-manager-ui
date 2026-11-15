import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

import { INVALID_CONTROL_CLASS } from './field-error';
import { Spinner } from './spinner';

/** Contrato do campo de seleção única. */
export interface SelectFieldProps<T> {
  /** Item selecionado, ou `null`. */
  value: T | null;
  /** Recebe o item escolhido. */
  onValueChange: (item: T) => void;
  /** Opções disponíveis. */
  items: T[];
  /** Extrai o rótulo exibido de um item. */
  getLabel: (item: T) => string;
  /** Extrai a chave única de um item. */
  getKey: (item: T) => string;
  /** Texto exibido sem seleção; também é o nome acessível se não houver `id` de rótulo. */
  placeholder?: string;
  disabled?: boolean;
  /** Mostra o spinner e bloqueia o campo. */
  isLoading?: boolean;
  /** Estilo compacto de filtro (altura 36). */
  compact?: boolean;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  /** Nome acessível quando não há `<label>` associado. */
  'aria-label'?: string;
}

/**
 * Campo de seleção única baseado no Select do Radix.
 *
 * @param props.value Item selecionado, ou `null`.
 * @param props.items Opções disponíveis.
 * @param props.onValueChange Recebe o item escolhido.
 * @param props.isLoading Mostra o spinner e bloqueia a interação.
 * @param props.compact Altura de filtro em vez de altura de formulário.
 * @returns O campo de seleção.
 */
export function SelectField<T>({
  value,
  onValueChange,
  items,
  getLabel,
  getKey,
  placeholder,
  disabled = false,
  isLoading = false,
  compact = false,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid = false,
  'aria-label': ariaLabel,
}: SelectFieldProps<T>) {
  const itemByKey = new Map(items.map((item) => [getKey(item), item]));

  return (
    <RadixSelect.Root
      value={value ? getKey(value) : ''}
      onValueChange={(key) => {
        const item = itemByKey.get(key);
        if (item) onValueChange(item);
      }}
      disabled={disabled || isLoading}
    >
      <RadixSelect.Trigger
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-busy={isLoading || undefined}
        aria-label={ariaLabel ?? (id ? undefined : placeholder)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 text-ink disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-muted ${
          compact ? 'h-9 font-medium text-sm' : 'h-[42px] text-[15px]'
        } ${ariaInvalid ? INVALID_CONTROL_CLASS : 'border-line-strong bg-surface'}`}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          {isLoading ? (
            <Spinner label="Carregando opções" className="text-muted" />
          ) : (
            <ChevronDown className="size-4 text-muted" aria-hidden="true" />
          )}
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-[60] max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line-strong bg-surface text-ink shadow-float"
        >
          <RadixSelect.Viewport className="p-1">
            {items.length === 0 ? (
              <p className="m-0 px-3 py-2.5 text-muted text-sm">
                Nenhuma opção disponível.
              </p>
            ) : (
              items.map((item) => (
                <RadixSelect.Item
                  key={getKey(item)}
                  value={getKey(item)}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover"
                >
                  <RadixSelect.ItemText>{getLabel(item)}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check className="size-4 text-accent" aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))
            )}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

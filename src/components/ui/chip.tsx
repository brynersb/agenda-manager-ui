import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** Filtro ativo; vira `aria-pressed`. */
  pressed: boolean;
  /** Contagem exibida em fonte mono ao lado do rótulo. */
  count?: number;
  /** Variante de alert (texto e borda `late` quando não está ativo). */
  alert?: boolean;
  children: ReactNode;
}

/**
 * Filtro rápido em formato de pílula, com contagem opcional.
 *
 * @param props.pressed Se o filtro está ativo.
 * @param props.count Número exibido ao lado do rótulo.
 * @param props.alert Destaca em vermelho quando há algo a resolver.
 * @returns O botão-chip com `aria-pressed`.
 */
export function Chip({
  pressed,
  count,
  alert = false,
  children,
  className = '',
  ...props
}: ChipProps) {
  const tone = pressed
    ? 'border-chip-on bg-chip-on text-chip-on-ink'
    : alert
      ? 'border-late bg-transparent text-late hover:bg-surface'
      : 'border-line-strong bg-transparent text-ink hover:bg-surface';

  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 font-medium text-sm leading-none ${tone} ${className}`}
      {...props}
    >
      {children}
      {count !== undefined && ' '}
      {count !== undefined && (
        <b className="font-medium font-mono text-xs tabular-nums">{count}</b>
      )}
    </button>
  );
}

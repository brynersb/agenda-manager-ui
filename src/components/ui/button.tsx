import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra o spinner e bloqueia cliques enquanto uma operação roda. */
  loading?: boolean;
  /**
   * Só vale na variante `danger`: segundo clique de uma ação destrutiva em dois
   * passos; o botão vira vermelho cheio.
   */
  confirm?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/** Classes de cada variante visual, só com tokens. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-accent-ink hover:brightness-110',
  secondary: 'border-line-strong bg-surface text-ink hover:bg-hover',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-hover',
  danger: 'border-late bg-transparent text-late hover:bg-late-bg',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-2.5 text-[13px]',
  md: 'min-h-10 px-4 text-sm',
};

/** Estado de confirmação da variante `danger`: fundo `late` cheio. */
const CONFIRM_CLASSES = 'border-late bg-late text-bg hover:bg-late';

/**
 * Botão padrão da aplicação.
 *
 * @param props.variant `primary` (padrão), `secondary`, `ghost` ou `danger`.
 * @param props.size `md` (padrão) ou `sm`.
 * @param props.loading Exibe spinner e desabilita o botão.
 * @param props.confirm Na variante `danger`, marca o passo de confirmação.
 * @param props.icon Ícone exibido antes do texto.
 * @returns O botão.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  confirm = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const visual =
    variant === 'danger' && confirm
      ? CONFIRM_CLASSES
      : VARIANT_CLASSES[variant];

  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border font-body font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASSES[size]} ${visual} ${className}`}
      {...props}
    >
      {loading ? <Spinner label="Carregando" /> : icon}
      {children}
    </button>
  );
}

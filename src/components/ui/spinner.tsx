import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  /** Texto lido por leitores de tela; padrão "Carregando". */
  label?: string;
  className?: string;
}

/**
 * Indicador de carregamento girando.
 *
 * @param props.label Texto anunciado para leitores de tela.
 * @returns O ícone animado com `role="status"`.
 */
export function Spinner({
  label = 'Carregando',
  className = '',
}: SpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={`size-4 animate-spin ${className}`}
    />
  );
}

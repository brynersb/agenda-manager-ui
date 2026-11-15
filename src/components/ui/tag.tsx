import type { ReactNode } from 'react';

type TagVariant = 'neutral' | 'action';

interface TagProps {
  /** `neutral` (padrão, cinza) ou `action` (accent). */
  variant?: TagVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<TagVariant, string> = {
  neutral: 'border-line-strong text-muted',
  action: 'border-accent-line text-accent',
};

/**
 * Etiqueta mono em caixa alta, usada para ação e canal da pauta.
 *
 * @param props.variant Tom da etiqueta.
 * @param props.children Texto.
 * @returns A etiqueta.
 */
export function Tag({ variant = 'neutral', children }: TagProps) {
  return (
    <span
      className={`inline-block rounded-sm border px-[7px] py-1 font-medium font-mono text-[11px] uppercase leading-none tracking-[0.06em] ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}

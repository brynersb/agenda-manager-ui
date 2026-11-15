import type { ReactNode } from 'react';

import type { ContentBriefStatus } from '@/types/content-brief';

interface StatusPillProps {
  status: ContentBriefStatus;
  /** Rótulo em pt-BR; vem de `lib/labels.ts` quando as telas existirem. */
  children: ReactNode;
  className?: string;
}

/**
 * Aparência da pílula de cada status, só com tokens `pill-*` (o tema `soft`
 * troca os valores por tints mais claros, sem mudar as classes).
 */
export const STATUS_CLASSES: Record<ContentBriefStatus, string> = {
  TODO: 'border-pill-todo-line bg-pill-todo-bg text-pill-todo-ink',
  IN_PROGRESS: 'border-transparent bg-pill-progress-bg text-pill-progress-ink',
  IN_REVIEW: 'border-pill-review-line bg-pill-review-bg text-pill-review-ink',
  DONE: 'border-transparent bg-pill-done-bg text-pill-done-ink',
};

/**
 * Pílula visual do status da pauta. É só aparência: o seletor de status das
 * telas reutiliza estas classes por cima de um controle interativo.
 *
 * @param props.status Status representado.
 * @param props.children Rótulo exibido.
 * @returns A pílula.
 */
export function StatusPill({
  status,
  children,
  className = '',
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex min-h-[30px] items-center rounded-full border px-3 font-semibold text-xs leading-none ${STATUS_CLASSES[status]} ${className}`}
    >
      {children}
    </span>
  );
}

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  /** Ações, como "Nova pauta" ou "Limpar filtros". */
  actions?: ReactNode;
}

/**
 * Estado vazio com borda tracejada, título, texto e ações.
 *
 * @param props.title Título.
 * @param props.description Explicação.
 * @param props.actions Botões de ação.
 * @returns O bloco de estado vazio.
 */
export function EmptyState({ title, description, actions }: EmptyStateProps) {
  return (
    <div className="max-w-[640px] rounded-xl border border-line-strong border-dashed px-6 py-8">
      <h2 className="m-0 mb-1.5 font-bold font-display text-xl leading-tight tracking-tight">
        {title}
      </h2>
      <p className="m-0 mb-4 max-w-[52ch] text-muted">{description}</p>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

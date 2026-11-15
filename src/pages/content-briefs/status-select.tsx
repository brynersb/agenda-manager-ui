import { ChevronDown } from 'lucide-react';

import { STATUS_CLASSES } from '@/components/ui/status-pill';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/labels';
import type { ContentBriefStatus } from '@/types/content-brief';

interface StatusSelectProps {
  /** Id da pauta; vira `data-content-brief-id` para devolver o foco depois do refetch. */
  briefId: string;
  title: string;
  status: ContentBriefStatus;
  /** Sem `content-brief:write` o seletor só mostra o status. */
  disabled: boolean;
  onChange: (status: ContentBriefStatus) => void;
}

/** Cor da seta de cada status (a mesma do texto da pílula). */
const CHEVRON: Record<ContentBriefStatus, string> = {
  TODO: 'text-pill-todo-ink',
  IN_PROGRESS: 'text-pill-progress-ink',
  IN_REVIEW: 'text-pill-review-ink',
  DONE: 'text-pill-done-ink',
};

/**
 * Seletor de status em formato de pílula, direto no cartão da pauta.
 *
 * É um `<select>` nativo (teclado e leitor de tela de graça) pintado com as
 * mesmas classes do `StatusPill`. Sem permissão de escrita fica desabilitado e
 * sem a seta, para parecer só informação.
 *
 * @param props.briefId Id da pauta.
 * @param props.title Título, usado no nome acessível "Status de <título>".
 * @param props.status Status atual.
 * @param props.disabled Bloqueia a troca.
 * @param props.onChange Recebe o status escolhido.
 * @returns A pílula interativa.
 */
export function StatusSelect({
  briefId,
  title,
  status,
  disabled,
  onChange,
}: StatusSelectProps) {
  return (
    <span className="relative z-[1] inline-flex max-w-full">
      <select
        data-content-brief-id={briefId}
        aria-label={`Status de ${title}`}
        value={status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ContentBriefStatus)}
        className={`min-h-[30px] min-w-0 max-w-full cursor-pointer appearance-none rounded-full border py-0 font-body font-semibold text-xs leading-none disabled:cursor-default ${STATUS_CLASSES[status]} ${disabled ? 'px-3' : 'pr-7 pl-3'}`}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s} className="bg-surface text-ink">
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {!disabled && (
        <ChevronDown
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 ${CHEVRON[status]}`}
        />
      )}
    </span>
  );
}

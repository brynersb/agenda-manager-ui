import { Button } from '@/components/ui/button';
import { dueDateShortcut } from '@/lib/due-date';

interface DueDateShortcutsProps {
  /** Recebe a data `YYYY-MM-DD`, ou `''` para "Sem prazo". */
  onPick: (dueDate: string) => void;
  disabled?: boolean;
}

/** Atalhos na ordem do protótipo; `days: null` limpa o prazo. */
const SHORTCUTS: { label: string; days: number | null }[] = [
  { label: 'Hoje', days: 0 },
  { label: 'Amanhã', days: 1 },
  { label: '+ 1 semana', days: 7 },
  { label: 'Sem prazo', days: null },
];

/**
 * Botões "Hoje", "Amanhã", "+ 1 semana" e "Sem prazo" ao lado do campo de
 * prazo. A data sai do calendário local do navegador (`dueDateShortcut`).
 *
 * @param props.onPick Recebe o prazo calculado.
 * @param props.disabled Bloqueia os botões (editor somente leitura).
 * @returns O grupo de botões.
 */
export function DueDateShortcuts({ onPick, disabled }: DueDateShortcutsProps) {
  return (
    <fieldset
      aria-label="Atalhos de prazo"
      className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0"
    >
      {SHORTCUTS.map(({ label, days }) => (
        <Button
          key={label}
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => onPick(dueDateShortcut(days))}
        >
          {label}
        </Button>
      ))}
    </fieldset>
  );
}

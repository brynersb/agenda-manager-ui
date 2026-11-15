const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formata um prazo `YYYY-MM-DD` como "sáb 14 nov".
 *
 * O dia da semana sai do calendário (UTC, sem hora), então não depende do fuso
 * do navegador. O ano só aparece quando difere do ano de `today`; sem `today`
 * (resumo ainda não carregou) o ano é omitido.
 *
 * @param dueDate Data de calendário `YYYY-MM-DD`.
 * @param today Data de referência da API (`ContentBriefSummary.today`), opcional.
 * @returns O texto curto, ou `''` se `dueDate` não for uma data válida.
 */
export function formatDueDate(dueDate: string, today?: string): string {
  const parts = ISO.exec(dueDate);
  if (!parts) return '';

  const [, year, month, day] = parts;
  const weekday = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  ).getUTCDay();
  const text = `${WEEKDAYS[weekday]} ${Number(day)} ${MONTHS[Number(month) - 1]}`;

  const currentYear = today ? ISO.exec(today)?.[1] : undefined;
  return currentYear && currentYear !== year ? `${text} ${year}` : text;
}

/**
 * Texto relativo de um prazo, a partir de `daysUntilDue` (calculado pela API).
 *
 * @param daysUntilDue Dias até o prazo; negativo quando já passou.
 * @returns "Atrasada 1 dia", "Atrasada 3 dias", "Hoje", "Amanhã" ou "Em 5 dias".
 */
export function relativeText(daysUntilDue: number): string {
  if (daysUntilDue < 0) {
    const late = -daysUntilDue;
    return `Atrasada ${late} ${late === 1 ? 'dia' : 'dias'}`;
  }
  if (daysUntilDue === 0) return 'Hoje';
  if (daysUntilDue === 1) return 'Amanhã';
  return `Em ${daysUntilDue} dias`;
}

function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Data de um atalho de prazo ("Hoje", "Amanhã", "+ 1 semana") como
 * `YYYY-MM-DD`, no fuso do navegador.
 *
 * Diferente da classificação de prazo (que é da API, no fuso da operação), o
 * atalho é uma escolha da pessoa diante do próprio calendário: "hoje" é o dia
 * que ela vê na tela. Por isso usa os componentes locais da data, nunca
 * `toISOString()`, que viraria o dia à noite em fusos atrás do UTC.
 *
 * @param days Dias a somar a hoje, ou `null` para "Sem prazo".
 * @param now Instante de referência; padrão é agora (injetável em teste).
 * @returns A data `YYYY-MM-DD`, ou `''` (campo vazio) para "Sem prazo".
 */
export function dueDateShortcut(days: number | null, now: Date = new Date()) {
  if (days === null) return '';
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
  );
  return `${target.getFullYear()}-${twoDigits(target.getMonth() + 1)}-${twoDigits(target.getDate())}`;
}

/**
 * Data por extenso em pt-BR, como "sábado, 14 de novembro de 2026".
 *
 * @param date Data a formatar; padrão é hoje.
 * @returns O texto em minúsculas; a caixa alta é aplicada por CSS.
 */
export function formatLongDate(date: Date = new Date()): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Data e hora curtas em pt-BR, como "14/11/2026 12:00", no fuso do navegador.
 *
 * @param iso Instante em ISO-8601 (UTC), como a API devolve.
 * @returns O texto formatado; vazio se a data for inválida.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Hora curta em pt-BR, como "14:32", no fuso do navegador.
 *
 * @param iso Instante em ISO-8601 (UTC).
 * @returns O texto formatado; vazio se a data for inválida.
 */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

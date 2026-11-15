/**
 * Normaliza um texto para comparação e busca: minúsculas e sem acentos.
 *
 * A busca da pauta ignora acentuação (digitar "joao" acha "João"), por isso a
 * mesma dobra é aplicada ao termo e ao texto comparado.
 *
 * @param s Texto original.
 * @returns O texto em minúsculas, sem diacríticos.
 */
export function removeAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Inicial maiúscula de um nome, para o círculo do responsável.
 *
 * @param name Nome completo; espaços nas pontas são ignorados.
 * @returns A primeira letra em maiúscula, ou `?` quando o nome é vazio.
 */
export function initial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?';
}

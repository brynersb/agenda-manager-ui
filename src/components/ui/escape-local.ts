/** Atributo dos controles que tratam Esc sozinhos (cancelar edição, fechar lista). */
const ESC_LOCAL_SELECTOR = '[data-esc-local]';

function isHandledLocally(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof Element && target.closest(ESC_LOCAL_SELECTOR) !== null
  );
}

/**
 * Decide o que o Esc faz dentro de um painel de formulário (drawer ou modal).
 *
 * Existe porque listas com edição em linha (ex.: renomear um cadastro) usam Esc
 * para cancelar a edição, e esse Esc não pode fechar o painel inteiro. Por
 * isso, sem um tratador próprio, o Esc dentro de um elemento com
 * `data-esc-local` (ou de um descendente dele) é ignorado pelo painel.
 *
 * @param event Evento de teclado entregue pelo Radix.
 * @param custom Tratador do chamador; quando existe, só ele decide (pode chamar
 * `event.preventDefault()` para manter o painel aberto).
 */
export function resolveEscapeKeyDown(
  event: KeyboardEvent,
  custom?: (event: KeyboardEvent) => void,
) {
  if (custom) {
    custom(event);
  } else if (isHandledLocally(event)) {
    event.preventDefault();
  }
}

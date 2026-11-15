/**
 * Leva o navegador para `/login` com recarga completa da página.
 *
 * Isolado em módulo próprio porque o jsdom não implementa navegação e os
 * testes substituem esta função.
 */
export function goToLogin(): void {
  window.location.href = '/login';
}

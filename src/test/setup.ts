import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: true,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

/**
 * Node 26 expõe um `localStorage` próprio que não funciona sem
 * `--localstorage-file` e esconde o do jsdom (`window.localStorage` fica
 * `undefined`, e ler a propriedade imprime um aviso). Este armazenamento em
 * memória o substitui nos testes, sem ler o original.
 */
{
  const dados = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return dados.size;
      },
      key: (indice: number) => [...dados.keys()][indice] ?? null,
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => {
        dados.set(chave, String(valor));
      },
      removeItem: (chave: string) => {
        dados.delete(chave);
      },
      clear: () => dados.clear(),
    },
  });
}

afterEach(() => {
  cleanup();
});

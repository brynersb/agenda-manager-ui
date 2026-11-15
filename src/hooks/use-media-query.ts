import { useEffect, useState } from 'react';

/**
 * Acompanha uma media query CSS e re-renderiza quando o resultado muda.
 *
 * @param query Media query, como `(max-width: 719px)`.
 * @returns `true` enquanto a media query casa com a janela.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = () => setMatches(mediaQueryList.matches);
    listener();
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

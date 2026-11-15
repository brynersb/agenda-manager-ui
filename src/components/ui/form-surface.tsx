import { useRef } from 'react';

import { useAppearance } from '@/hooks/use-preferences';
import { Drawer } from './drawer';
import { FormModal, type FormModalProps } from './form-modal';

/** Mesmas props do `FormModal` (que estende as do `Drawer`). */
export type FormSurfaceProps = FormModalProps;

/**
 * Devolve o foco a quem abriu o formulário quando ele fecha.
 *
 * O Radix só devolve o foco a um `Dialog.Trigger`, e aqui a abertura vem de
 * botões comuns que mudam a URL ou o estado da tela; sem isto o foco cairia no
 * `body` e quem navega pelo teclado perderia o lugar. Se o elemento de origem
 * já saiu da tela (a lista foi recarregada), o foco segue o padrão do Radix.
 */
function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      if (target?.isConnected && target !== document.body) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}

/**
 * Superfície única dos formulários: renderiza o modal centralizado ou o painel
 * lateral conforme a escolha da pessoa (`formPresentation`; padrão do ambiente
 * em `VITE_FORM_PRESENTATION`).
 *
 * Existe para que editor de pauta e cadastros não saibam como se apresentam:
 * ficam com o mesmo conteúdo, rodapé, tratamento de Esc e confirmação de
 * saída nos dois modos, e reverter para o painel lateral é só uma preferência.
 * Nos dois, o foco volta ao botão que abriu o formulário.
 * O `size` só vale no modal; o painel lateral tem largura fixa.
 *
 * @param props As mesmas do `Drawer`, mais `size` opcional.
 * @returns O modal ou o painel lateral, com o mesmo conteúdo.
 */
export function FormSurface({ size, ...props }: FormSurfaceProps) {
  const { appearance } = useAppearance();
  const focus = useReturnFocus();

  return appearance.formPresentation === 'drawer' ? (
    <Drawer {...focus} {...props} />
  ) : (
    <FormModal size={size} {...focus} {...props} />
  );
}

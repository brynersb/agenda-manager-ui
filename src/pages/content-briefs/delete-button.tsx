import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

/** Tempo, em ms, que o botão fica armado antes de voltar a "Excluir". */
export const CONFIRM_WINDOW_MS = 4000;

interface DeleteButtonProps {
  /** Chamado no segundo clique, dentro da janela de confirmação. */
  onDelete: () => void;
  /** Exclusão em andamento: bloqueia novos cliques. */
  deleting?: boolean;
}

/**
 * "Excluir" em dois cliques: o primeiro troca o texto para "Confirmar
 * exclusão" (fundo `late`) por 4 s; o segundo exclui. Passados os 4 s, volta
 * ao estado inicial.
 *
 * Os dois passos protegem de um clique distraído sem abrir um modal por cima
 * do painel. Como o botão desmonta com o painel, fechar o editor também zera o
 * estado e o timer (o `resetDel` do protótipo).
 *
 * @param props.onDelete Executa a exclusão.
 * @param props.deleting Mostra o carregamento e bloqueia o botão.
 * @returns O botão.
 */
export function DeleteButton({ onDelete, deleting }: DeleteButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleClick() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
      return;
    }
    clearTimeout(timer.current);
    onDelete();
  }

  return (
    <Button
      variant="danger"
      confirm={armed}
      loading={deleting}
      onClick={handleClick}
    >
      {armed ? 'Confirmar exclusão' : 'Excluir'}
    </Button>
  );
}

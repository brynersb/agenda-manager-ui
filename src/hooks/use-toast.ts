import { useCallback, useEffect, useState } from 'react';

import type { ToastAction, ToastVariant } from '@/components/ui/toast';

interface ToastState {
  variant: ToastVariant;
  title: string;
  description?: string;
  action?: ToastAction;
}

const DEFAULT_DURATION_MS = 4000;
const WITH_ACTION_DURATION_MS = 10000;

/**
 * Controla o toast de uma tela: exibe, esconde e fecha sozinho.
 *
 * Toasts com ação ficam mais tempo em tela, porque a pessoa precisa de tempo
 * para decidir se vai usá-la antes de o aviso desaparecer.
 *
 * @returns `toast` com o estado atual (ou `null`), `show` para exibir e
 * `dismiss` para fechar antes do tempo.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback(
    (
      variant: ToastVariant,
      title: string,
      description?: string,
      action?: ToastAction,
    ) => {
      setToast({ variant, title, description, action });
    },
    [],
  );

  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.action
      ? WITH_ACTION_DURATION_MS
      : DEFAULT_DURATION_MS;
    const timeout = setTimeout(dismiss, duration);
    return () => clearTimeout(timeout);
  }, [toast, dismiss]);

  return { toast, show, dismiss };
}

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api-error';

interface QueryErrorProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * Mensagem de falha ao carregar pautas, com "Tentar de novo".
 *
 * @param props.error Erro da consulta; a mensagem sai de `getApiErrorMessage`.
 * @param props.onRetry Refaz a consulta.
 * @returns O aviso de erro.
 */
export function QueryError({ error, onRetry }: QueryErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-late bg-late-bg px-4 py-3 text-late text-sm"
    >
      <span>{getApiErrorMessage(error)}</span>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}

import { Link } from 'react-router';

import { FullScreen } from '@/components/layout/full-screen';

/**
 * Página para rotas que não existem.
 *
 * @returns A mensagem com link de volta para a pauta.
 */
export function NotFoundPage() {
  return (
    <FullScreen>
      <div className="max-w-md text-center">
        <h1 className="m-0 mb-2 font-bold font-display text-2xl tracking-tight">
          Página não encontrada
        </h1>
        <p className="m-0 mb-6 text-muted">
          O endereço que você abriu não existe.
        </p>
        <Link
          to="/content-briefs"
          className="font-semibold text-accent underline underline-offset-2"
        >
          Voltar para a pauta
        </Link>
      </div>
    </FullScreen>
  );
}

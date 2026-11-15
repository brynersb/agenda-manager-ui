import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Tela inteira centralizada, para login, carregamento e erros de sessão.
 *
 * @param props.children Conteúdo centralizado.
 * @returns O contêiner de altura total.
 */
export function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-4 text-ink">
      {children}
    </div>
  );
}

/**
 * Tela cheia com spinner, enquanto a sessão ou as permissões carregam.
 *
 * @returns O indicador de carregamento centralizado.
 */
export function LoadingScreen() {
  return (
    <FullScreen>
      <Spinner label="Carregando" className="size-8 text-accent" />
    </FullScreen>
  );
}

/**
 * Falha ao buscar `/auth/user-info`.
 *
 * É uma tela própria, com "Recarregar", porque erro de carregamento não pode
 * ser confundido com "sem permissão": quem tem acesso não deve ser mandado para
 * `/no-permission` por uma falha de rede.
 *
 * @returns A mensagem de erro com o botão de recarregar.
 */
export function PermissionsLoadError() {
  return (
    <FullScreen>
      <AlertCircle className="size-12 text-late" aria-hidden="true" />
      <div className="max-w-md text-center">
        <h1 className="m-0 mb-2 font-bold font-display text-xl">
          Erro ao carregar permissões
        </h1>
        <p className="m-0 mb-4 text-muted">
          Não conseguimos carregar suas permissões. Tente recarregar a página.
        </p>
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
      </div>
    </FullScreen>
  );
}

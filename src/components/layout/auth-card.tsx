import type { ReactNode } from 'react';

import logoBora from '@/assets/logo-bora.png';
import { FullScreen } from '@/components/layout/full-screen';

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Cartão central das telas de acesso (login e troca de senha): logo Bora,
 * título e texto de apoio.
 *
 * @param props.title Título da tela (`h1`).
 * @param props.description Texto de apoio abaixo do título.
 * @param props.children Formulário e avisos.
 * @returns A tela cheia com o cartão.
 */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <FullScreen>
      <span className="inline-flex rounded-[10px] bg-white px-3 py-1.5">
        <img src={logoBora} alt="Bora" className="block h-[42px] w-auto" />
      </span>
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <h1 className="m-0 mb-1 font-bold font-display text-2xl tracking-tight">
          {title}
        </h1>
        <p className="m-0 mb-6 text-muted">{description}</p>
        {children}
      </div>
    </FullScreen>
  );
}

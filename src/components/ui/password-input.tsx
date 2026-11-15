import { Eye, EyeOff } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useState } from 'react';

import { TextInput } from './text-input';

interface PasswordInputProps
  extends Omit<ComponentProps<'input'>, 'type' | 'className'> {
  /**
   * Complemento do nome do botão ("Mostrar <complemento>"); distingue os
   * botões quando há mais de um campo de senha na tela.
   */
  visibilityLabel?: string;
}

/**
 * Campo de senha com botão "Mostrar/Ocultar". Use dentro de `Field` para
 * rótulo e erro.
 *
 * O botão fica fora da ordem de leitura do valor (`aria-pressed` diz o estado)
 * e a senha volta a ficar oculta ao desmontar, nunca persiste visível.
 *
 * @param props.visibilityLabel Nome do campo no botão; padrão "senha".
 * @returns O input com o botão de visibilidade.
 */
export function PasswordInput({
  visibilityLabel = 'senha',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <TextInput
        {...props}
        type={visible ? 'text' : 'password'}
        className="pr-11"
      />
      <button
        type="button"
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${visibilityLabel}`}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildUser } from '@/test/users-fake';
import { TemporaryPasswordDialog } from './temporary-password-dialog';

const SENHA = 'Vq7#kT9m-Rw2xPz4';

function montar(onClose = vi.fn()) {
  render(
    <TemporaryPasswordDialog
      user={buildUser({ id: 'maria', name: 'Maria Souza' })}
      password={SENHA}
      reason="created"
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('<TemporaryPasswordDialog />', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: remove o stub de teste do jsdom
    delete (document as any).execCommand;
  });

  it('mostra a senha, de quem é e o aviso de que não será mostrada de novo', () => {
    montar();

    const dialogo = screen.getByRole('dialog', { name: 'Usuário criado' });
    expect(dialogo).toHaveTextContent('Senha provisória de Maria Souza');
    expect(screen.getByText(SENHA)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta senha não será mostrada de novo.',
    );
  });

  it('copia pela área de transferência e confirma', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: 'Copiar senha' }));

    expect(await navigator.clipboard.readText()).toBe(SENHA);
    expect(screen.getByRole('button', { name: 'Copiada' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Senha copiada/);
  });

  it('sem a API de área de transferência (http fora do localhost) copia pelo caminho antigo', async () => {
    const user = userEvent.setup();
    montar();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('negado', 'NotAllowedError'),
    );
    const execCommand = vi.fn().mockReturnValue(true);
    Object.assign(document, { execCommand });

    await user.click(screen.getByRole('button', { name: 'Copiar senha' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(await screen.findByText(/Senha copiada/)).toBeInTheDocument();
  });

  it('se nenhuma forma de copiar funciona, orienta a copiar manualmente', async () => {
    const user = userEvent.setup();
    montar();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new DOMException('negado', 'NotAllowedError'),
    );

    await user.click(screen.getByRole('button', { name: 'Copiar senha' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Selecione a senha e copie manualmente.',
    );
  });

  it('"Concluir" e Esc fecham o diálogo', async () => {
    const onClose = montar();

    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Toast } from './toast';

describe('<Toast />', () => {
  it('anuncia título e descrição como status', () => {
    render(
      <Toast
        variant="success"
        title="Pauta salva"
        description="Alterações gravadas."
        onClose={vi.fn()}
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Pauta salva');
    expect(status).toHaveTextContent('Alterações gravadas.');
  });

  it('o erro usa os tokens late, o sucesso não', () => {
    const { rerender } = render(
      <Toast variant="success" title="Ok" onClose={vi.fn()} />,
    );
    expect(screen.getByRole('status')).not.toHaveClass('text-late');

    rerender(<Toast variant="error" title="Falhou" onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveClass('text-late');
  });

  it('fecha pelo botão', async () => {
    const onClose = vi.fn();
    render(<Toast variant="success" title="Ok" onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('executa a ação oferecida', async () => {
    const onClick = vi.fn();
    render(
      <Toast
        variant="error"
        title="Falhou"
        action={{ label: 'Tentar de novo', onClick }}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar de novo' }),
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

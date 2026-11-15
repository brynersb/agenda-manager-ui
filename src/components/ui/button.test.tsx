import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('<Button />', () => {
  it('dispara onClick e é do tipo button por padrão (não envia formulário)', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);

    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveAttribute('type', 'button');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('em loading mostra o spinner, fica ocupado e ignora cliques', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );

    const button = screen.getByRole('button', { name: /Salvar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeInTheDocument();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('danger com confirm troca o contorno vermelho pelo fundo vermelho cheio', () => {
    const { rerender } = render(<Button variant="danger">Excluir</Button>);
    const button = screen.getByRole('button', { name: 'Excluir' });
    expect(button).toHaveClass('text-late');
    expect(button).not.toHaveClass('bg-late');

    rerender(
      <Button variant="danger" confirm>
        Excluir
      </Button>,
    );
    expect(button).toHaveClass('bg-late');
  });

  it('confirm é ignorado fora da variante danger', () => {
    render(
      <Button variant="secondary" confirm>
        Cancelar
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toHaveClass(
      'bg-late',
    );
  });

  it('respeita disabled', () => {
    render(<Button disabled>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });
});

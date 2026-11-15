import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './chip';

describe('<Chip />', () => {
  it('expõe o estado ativo em aria-pressed', () => {
    const { rerender } = render(<Chip pressed={false}>Todas</Chip>);
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(<Chip pressed>Todas</Chip>);
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('mostra a contagem junto ao rótulo, inclusive zero', () => {
    render(
      <Chip pressed={false} count={0}>
        Atrasadas
      </Chip>,
    );
    expect(screen.getByRole('button', { name: 'Atrasadas 0' })).toBeVisible();
  });

  it('dispara onClick', async () => {
    const onClick = vi.fn();
    render(
      <Chip pressed={false} onClick={onClick}>
        Concluídas
      </Chip>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('alert pinta de vermelho só enquanto não está ativo', () => {
    const { rerender } = render(
      <Chip pressed={false} alert>
        Atrasadas
      </Chip>,
    );
    expect(screen.getByRole('button')).toHaveClass('text-late', 'border-late');

    rerender(
      <Chip pressed alert>
        Atrasadas
      </Chip>,
    );
    expect(screen.getByRole('button')).not.toHaveClass('text-late');
    expect(screen.getByRole('button')).toHaveClass('bg-chip-on');
  });
});

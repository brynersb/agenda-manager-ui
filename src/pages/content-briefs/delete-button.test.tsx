import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CONFIRM_WINDOW_MS, DeleteButton } from './delete-button';

const excluir = () => screen.getByRole('button', { name: 'Excluir' });
const confirmar = () =>
  screen.getByRole('button', { name: 'Confirmar exclusão' });

describe('BotaoExcluir', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exclui só no segundo clique, depois de pedir confirmação', () => {
    const onDelete = vi.fn();
    render(<DeleteButton onDelete={onDelete} />);

    fireEvent.click(excluir());
    expect(onDelete).not.toHaveBeenCalled();
    expect(confirmar()).toHaveClass('bg-late');

    fireEvent.click(confirmar());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('volta a "Excluir" depois de 4 s sem o segundo clique', () => {
    const onDelete = vi.fn();
    render(<DeleteButton onDelete={onDelete} />);

    fireEvent.click(excluir());
    act(() => {
      vi.advanceTimersByTime(CONFIRM_WINDOW_MS - 1);
    });
    expect(confirmar()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    fireEvent.click(excluir());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('nasce desarmado quando o painel reabre (o botão remonta)', () => {
    const { unmount } = render(<DeleteButton onDelete={vi.fn()} />);
    fireEvent.click(excluir());
    unmount();

    render(<DeleteButton onDelete={vi.fn()} />);
    expect(excluir()).toBeInTheDocument();
  });
});

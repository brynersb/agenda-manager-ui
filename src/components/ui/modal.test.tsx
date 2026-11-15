import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './modal';

describe('<Modal />', () => {
  it('não renderiza quando fechado', () => {
    render(<Modal open={false} onOpenChange={vi.fn()} title="Excluir pauta" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre como diálogo nomeado, com descrição associada e rodapé', () => {
    render(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Excluir pauta"
        description="Esta ação não pode ser desfeita."
        footer={<button type="button">Cancelar</button>}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Excluir pauta' });
    expect(dialog).toHaveAccessibleDescription(
      'Esta ação não pode ser desfeita.',
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  it('não tem botão X: a saída é pelo rodapé ou por Esc', async () => {
    const onOpenChange = vi.fn();
    render(<Modal open onOpenChange={onOpenChange} title="Excluir pauta" />);

    expect(
      screen.queryByRole('button', { name: 'Fechar' }),
    ).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

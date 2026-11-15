import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Drawer } from './drawer';

describe('<Drawer />', () => {
  it('não renderiza nada quando fechado', () => {
    render(
      <Drawer open={false} onOpenChange={vi.fn()} title="Editar pauta">
        conteúdo
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre como diálogo nomeado pelo título (aria-labelledby) com conteúdo e rodapé', () => {
    render(
      <Drawer
        open
        onOpenChange={vi.fn()}
        title="Editar pauta"
        footer={<button type="button">Salvar</button>}
      >
        conteúdo
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Editar pauta' })).toBeVisible();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('pede para fechar pelo botão Fechar e pela tecla Esc', async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Editar pauta">
        conteúdo
      </Drawer>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('não fecha com Esc dentro de um controle marcado com data-esc-local', async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange} title="Editar pauta">
        <input aria-label="Renomear" data-esc-local />
        <div data-esc-local>
          <input aria-label="Dentro do marcado" />
        </div>
        <input aria-label="Comum" />
      </Drawer>,
    );

    await userEvent.click(screen.getByLabelText('Renomear'));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByLabelText('Dentro do marcado'));
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Comum'));
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('entrega o Esc a onEscapeKeyDown, que pode manter o painel aberto', async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer
        open
        onOpenChange={onOpenChange}
        title="Editar pauta"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <input aria-label="Comum" />
      </Drawer>,
    );

    await userEvent.click(screen.getByLabelText('Comum'));
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('prende o foco dentro do painel', async () => {
    render(
      <>
        <button type="button">Fora</button>
        <Drawer open onOpenChange={vi.fn()} title="Editar pauta">
          <button type="button">Dentro</button>
        </Drawer>
      </>,
    );

    for (let i = 0; i < 4; i++) await userEvent.tab();
    expect(screen.getByRole('dialog')).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { APPEARANCE_KEY } from '@/hooks/use-preferences';
import { FormSurface } from './form-surface';

function salvarApresentacao(formPresentation: 'modal' | 'drawer') {
  window.localStorage.setItem(
    APPEARANCE_KEY,
    JSON.stringify({ uiTheme: 'soft', formPresentation }),
  );
}

describe('<FormSurface />', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it('abre em modal quando não há preferência nem variável de ambiente', () => {
    render(
      <FormSurface open onOpenChange={vi.fn()} title="Nova pauta">
        conteúdo
      </FormSurface>,
    );

    expect(screen.getByRole('dialog', { name: 'Nova pauta' })).toHaveAttribute(
      'data-form-presentation',
      'modal',
    );
  });

  it('abre em painel lateral quando a preferência salva é "drawer"', () => {
    salvarApresentacao('drawer');
    render(
      <FormSurface open onOpenChange={vi.fn()} title="Nova pauta">
        conteúdo
      </FormSurface>,
    );

    expect(screen.getByRole('dialog', { name: 'Nova pauta' })).toHaveAttribute(
      'data-form-presentation',
      'drawer',
    );
  });

  it('usa VITE_FORM_PRESENTATION como padrão e a preferência da pessoa vence', () => {
    vi.stubEnv('VITE_FORM_PRESENTATION', 'drawer');
    const { unmount } = render(
      <FormSurface open onOpenChange={vi.fn()} title="Nova pauta">
        conteúdo
      </FormSurface>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'data-form-presentation',
      'drawer',
    );
    unmount();

    salvarApresentacao('modal');
    render(
      <FormSurface open onOpenChange={vi.fn()} title="Nova pauta">
        conteúdo
      </FormSurface>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'data-form-presentation',
      'modal',
    );
  });

  it('ignora VITE_FORM_PRESENTATION com valor desconhecido', () => {
    vi.stubEnv('VITE_FORM_PRESENTATION', 'tela-cheia');
    render(
      <FormSurface open onOpenChange={vi.fn()} title="Nova pauta">
        conteúdo
      </FormSurface>,
    );

    expect(screen.getByRole('dialog')).toHaveAttribute(
      'data-form-presentation',
      'modal',
    );
  });

  describe.each([
    'modal',
    'drawer',
  ] as const)('contrato comum (%s)', (presentation) => {
    beforeEach(() => salvarApresentacao(presentation));

    it('mostra título, conteúdo rolável e o rodapé de ações', () => {
      render(
        <FormSurface
          open
          onOpenChange={vi.fn()}
          title="Editar pauta"
          footer={<button type="button">Salvar</button>}
        >
          conteúdo
        </FormSurface>,
      );

      const dialog = screen.getByRole('dialog', { name: 'Editar pauta' });
      expect(dialog).toHaveAttribute('data-form-presentation', presentation);
      expect(screen.getByText('conteúdo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeVisible();
    });

    it('pede para fechar pelo botão Fechar, por Esc e por clique no fundo', async () => {
      const onOpenChange = vi.fn();
      render(
        <FormSurface open onOpenChange={onOpenChange} title="Editar pauta">
          conteúdo
        </FormSurface>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
      expect(onOpenChange).toHaveBeenLastCalledWith(false);

      await userEvent.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(2);

      const fundo = document.querySelector('.bg-scrim') as HTMLElement;
      await userEvent.click(fundo);
      expect(onOpenChange).toHaveBeenCalledTimes(3);
    });

    it('não fecha com Esc dentro de controle marcado com data-esc-local', async () => {
      const onOpenChange = vi.fn();
      render(
        <FormSurface open onOpenChange={onOpenChange} title="Cadastros">
          <input aria-label="Renomear" data-esc-local />
        </FormSurface>,
      );

      await userEvent.click(screen.getByLabelText('Renomear'));
      await userEvent.keyboard('{Escape}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('entrega o Esc a onEscapeKeyDown, que pode manter o formulário aberto', async () => {
      const onOpenChange = vi.fn();
      render(
        <FormSurface
          open
          onOpenChange={onOpenChange}
          title="Editar pauta"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <input aria-label="Comum" />
        </FormSurface>,
      );

      await userEvent.click(screen.getByLabelText('Comum'));
      await userEvent.keyboard('{Escape}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('prende o foco dentro do formulário e o devolve a quem abriu', async () => {
      function Cena({ aberto }: { aberto: boolean }) {
        return (
          <>
            <button type="button">Abrir</button>
            <FormSurface
              open={aberto}
              onOpenChange={vi.fn()}
              title="Nova pauta"
            >
              <button type="button">Dentro</button>
            </FormSurface>
          </>
        );
      }
      const { rerender } = render(<Cena aberto={false} />);
      const abrir = screen.getByRole('button', { name: 'Abrir' });
      abrir.focus();

      rerender(<Cena aberto />);
      for (let i = 0; i < 5; i++) await userEvent.tab();
      expect(screen.getByRole('dialog')).toContainElement(
        document.activeElement as HTMLElement,
      );

      rerender(<Cena aberto={false} />);
      await waitFor(() => expect(abrir).toHaveFocus());
    });
  });

  it('o modal rola por dentro e mantém o rodapé fora da área rolável', () => {
    render(
      <FormSurface
        open
        onOpenChange={vi.fn()}
        title="Nova pauta"
        footer={<button type="button">Salvar</button>}
      >
        <p>conteúdo longo</p>
      </FormSurface>,
    );

    const dialog = screen.getByRole('dialog');
    const rolavel = screen.getByText('conteúdo longo').parentElement;
    const rodape = screen.getByRole('button', { name: 'Salvar' }).parentElement;
    expect(dialog.className).toContain('max-h-[min(90dvh');
    expect(rolavel).toHaveClass('overflow-y-auto');
    expect(rodape).not.toHaveClass('overflow-y-auto');
    expect(dialog).toContainElement(rodape);
    expect(rolavel).not.toContainElement(rodape);
  });
});

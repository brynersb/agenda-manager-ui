import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPEARANCE_KEY, readAppearance } from '@/hooks/use-preferences';
import { renderWithProviders } from '@/test/render-with-providers';
import { UserMenu } from './user-menu';

async function abrirMenu() {
  await userEvent.click(
    screen.getByRole('button', { name: 'Menu do usuário' }),
  );
}

describe('<UserMenu /> aparência', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-ui-theme');
  });

  function montar() {
    return renderWithProviders(
      <UserMenu
        name="Maria"
        roles={['content-brief-editor']}
        onSignOut={vi.fn()}
      />,
    );
  }

  it('oferece Suave e Clássica, com Suave marcada por padrão', async () => {
    montar();
    await abrirMenu();

    expect(
      await screen.findByRole('menuitemradio', { name: 'Suave' }),
    ).toBeChecked();
    expect(
      screen.getByRole('menuitemradio', { name: 'Clássica' }),
    ).not.toBeChecked();
  });

  it('escolher Clássica aplica data-ui-theme="classic" no <html> e persiste', async () => {
    montar();
    await abrirMenu();

    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Clássica' }),
    );

    expect(document.documentElement).toHaveAttribute(
      'data-ui-theme',
      'classic',
    );
    expect(readAppearance().uiTheme).toBe('classic');
    expect(
      JSON.parse(window.localStorage.getItem(APPEARANCE_KEY) ?? '{}').uiTheme,
    ).toBe('classic');
    expect(
      screen.getByRole('menuitemradio', { name: 'Clássica' }),
    ).toBeChecked();
  });

  it('o tema escolhido volta marcado ao montar de novo (preferência persistida)', async () => {
    window.localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ uiTheme: 'classic', formPresentation: 'drawer' }),
    );
    montar();
    await abrirMenu();

    expect(
      await screen.findByRole('menuitemradio', { name: 'Clássica' }),
    ).toBeChecked();
    expect(
      screen.getByRole('menuitemradio', { name: 'Painel lateral' }),
    ).toBeChecked();
    expect(document.documentElement).toHaveAttribute(
      'data-ui-theme',
      'classic',
    );
  });

  it('oferece Modal e Painel lateral e persiste a escolha, sem mudar o tema', async () => {
    montar();
    await abrirMenu();
    expect(
      await screen.findByRole('menuitemradio', { name: 'Modal' }),
    ).toBeChecked();

    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Painel lateral' }),
    );

    expect(readAppearance()).toEqual({
      uiTheme: 'soft',
      formPresentation: 'drawer',
    });
    expect(
      screen.getByRole('menuitemradio', { name: 'Painel lateral' }),
    ).toBeChecked();
  });

  it('o menu continua aberto depois de escolher, para ver o efeito', async () => {
    montar();
    await abrirMenu();

    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Clássica' }),
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

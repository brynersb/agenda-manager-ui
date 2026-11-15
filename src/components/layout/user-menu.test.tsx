import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APPEARANCE_KEY, readAppearance } from '@/hooks/use-preferences';
import { renderWithProviders } from '@/test/render-with-providers';
import { UserMenu } from './user-menu';

function LocalizacaoAtual() {
  return <p data-testid="local">{useLocation().pathname}</p>;
}

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
        userRole="content-brief-editor"
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

describe('<UserMenu /> navegação e sessão', () => {
  function montar(
    props: Partial<Parameters<typeof UserMenu>[0]> = {},
    route = '/content-briefs',
  ) {
    return renderWithProviders(
      <>
        <UserMenu
          name="Maria"
          userRole="admin"
          onSignOut={vi.fn()}
          {...props}
        />
        <Routes>
          <Route path="*" element={<LocalizacaoAtual />} />
        </Routes>
      </>,
      { route },
    );
  }

  it('mostra o rótulo do papel de administrador', async () => {
    montar();
    await abrirMenu();

    expect(await screen.findByText('Administrador')).toBeInTheDocument();
  });

  it('só oferece "Usuários" a quem tem user:read, e navega até a tela', async () => {
    montar({ canReadUsers: true });
    await abrirMenu();

    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Usuários' }),
    );

    expect(screen.getByTestId('local')).toHaveTextContent('/users');
  });

  it('esconde "Usuários" de quem não tem user:read', async () => {
    montar({ canReadUsers: false, userRole: 'content-brief-editor' });
    await abrirMenu();

    await screen.findByRole('menuitem', { name: 'Alterar senha' });
    expect(screen.queryByRole('menuitem', { name: 'Usuários' })).toBeNull();
  });

  it('oferece "Alterar senha" a todos e leva à tela de troca', async () => {
    montar({ userRole: 'content-brief-viewer' });
    await abrirMenu();

    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Alterar senha' }),
    );

    expect(screen.getByTestId('local')).toHaveTextContent('/change-password');
  });

  it('só oferece "Pautas" a quem pode ler pautas', async () => {
    montar({ canReadContentBriefs: false });
    await abrirMenu();

    await screen.findByRole('menuitem', { name: 'Alterar senha' });
    expect(screen.queryByRole('menuitem', { name: 'Pautas' })).toBeNull();
  });

  it('espera o logout terminar, mostrando o andamento no botão "Sair"', async () => {
    let concluir: () => void = () => undefined;
    const onSignOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        }),
    );
    montar({ onSignOut });
    await abrirMenu();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );
    const dialogo = await screen.findByRole('dialog', {
      name: 'Sair da pauta?',
    });

    await userEvent.click(
      within(dialogo).getByRole('button', { name: 'Sair' }),
    );

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(
      within(dialogo).getByRole('button', { name: /Sair/ }),
    ).toBeDisabled();
    concluir();
    await waitFor(() =>
      expect(
        within(dialogo).getByRole('button', { name: 'Sair' }),
      ).toBeEnabled(),
    );
  });
});

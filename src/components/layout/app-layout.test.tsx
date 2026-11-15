import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { formatLongDate } from '@/lib/date';
import { renderWithProviders } from '@/test/render-with-providers';
import { AppLayout } from './app-layout';

function renderLayout(auth: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<div>Conteúdo da rota</div>} />
      </Route>
    </Routes>,
    auth,
  );
}

describe('<AppLayout />', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra logo, data de hoje por extenso e o conteúdo da rota', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 14, 10));

    renderLayout({ auth: {} });

    expect(screen.getByAltText('Bora')).toBeInTheDocument();
    expect(
      screen.getByText('sábado, 14 de novembro de 2026'),
    ).toBeInTheDocument();
    expect(formatLongDate(new Date(2026, 10, 14))).toBe(
      'sábado, 14 de novembro de 2026',
    );
    expect(screen.getByText('Conteúdo da rota')).toBeInTheDocument();
  });

  it('mostra o nome e o papel "Editor" no menu do usuário', async () => {
    renderLayout({
      auth: { name: 'Maria Souza', role: 'content-brief-editor' },
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Menu do usuário' }),
    );

    expect(await screen.findByText('Editor')).toBeInTheDocument();
    expect(screen.getAllByText('Maria Souza')).toHaveLength(2);
  });

  it('mostra o papel "Leitor" para quem só lê', async () => {
    renderLayout({ auth: { name: 'Leo', role: 'content-brief-viewer' } });

    await userEvent.click(
      screen.getByRole('button', { name: 'Menu do usuário' }),
    );

    expect(await screen.findByText('Leitor')).toBeInTheDocument();
  });

  it('pede confirmação antes de sair e só encerra a sessão ao confirmar', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderLayout({ auth: { signOut } });

    await userEvent.click(
      screen.getByRole('button', { name: 'Menu do usuário' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: 'Sair da pauta?',
    });
    expect(signOut).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(signOut).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Menu do usuário' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Sair' }),
    );
    const reaberto = await screen.findByRole('dialog', {
      name: 'Sair da pauta?',
    });
    await userEvent.click(
      within(reaberto).getByRole('button', { name: 'Sair' }),
    );

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

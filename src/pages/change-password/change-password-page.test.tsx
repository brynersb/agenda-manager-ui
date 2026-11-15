import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import { ChangePasswordPage } from './change-password-page';

const SENHA_NOVA = 'minha-senha-nova';

function renderPagina(
  auth: Parameters<typeof renderWithProviders>[1],
  route = '/change-password',
) {
  return renderWithProviders(
    <Routes>
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/" element={<div>Tela inicial</div>} />
      <Route path="/login" element={<div>Tela de login</div>} />
    </Routes>,
    { ...auth, route },
  );
}

async function preencher(atual: string, nova: string, confirmacao = nova) {
  await userEvent.type(screen.getByLabelText('Senha atual'), atual);
  await userEvent.type(screen.getByLabelText('Nova senha'), nova);
  await userEvent.type(
    screen.getByLabelText('Confirmar nova senha'),
    confirmacao,
  );
}

const salvar = () =>
  userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

describe('<ChangePasswordPage />', () => {
  describe('senha provisória pendente', () => {
    it('mostra só o formulário de troca, com a saída pelo logout', async () => {
      const signOut = vi.fn().mockResolvedValue(undefined);
      renderPagina({ auth: { mustChangePassword: true, signOut } });

      expect(
        screen.getByRole('heading', { name: 'Defina uma nova senha' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

      expect(signOut).toHaveBeenCalledTimes(1);
    });

    it('troca a senha e segue para a tela inicial', async () => {
      const changePassword = vi.fn().mockResolvedValue(undefined);
      renderPagina({ auth: { mustChangePassword: true, changePassword } });

      await preencher('provisoria-123', SENHA_NOVA);
      await salvar();

      expect(changePassword).toHaveBeenCalledWith('provisoria-123', SENHA_NOVA);
      expect(await screen.findByText('Tela inicial')).toBeInTheDocument();
    });
  });

  describe('troca voluntária (menu do usuário)', () => {
    it('é a mesma tela, com "Cancelar" em vez de "Sair"', async () => {
      renderPagina({ auth: { mustChangePassword: false } });

      expect(
        screen.getByRole('heading', { name: 'Alterar senha' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.getByText('Tela inicial')).toBeInTheDocument();
    });
  });

  describe('validação (mesma regra da API: 10 a 128 caracteres)', () => {
    it('exige a senha atual', async () => {
      const changePassword = vi.fn();
      renderPagina({ auth: { changePassword } });

      await userEvent.type(screen.getByLabelText('Nova senha'), SENHA_NOVA);
      await userEvent.type(
        screen.getByLabelText('Confirmar nova senha'),
        SENHA_NOVA,
      );
      await salvar();

      expect(screen.getByText('Informe a senha atual.')).toBeInTheDocument();
      expect(screen.getByLabelText('Senha atual')).toHaveFocus();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('recusa nova senha com menos de 10 caracteres', async () => {
      const changePassword = vi.fn();
      renderPagina({ auth: { changePassword } });

      await preencher('provisoria', 'curta-123');
      await salvar();

      expect(
        screen.getByText('A nova senha deve ter pelo menos 10 caracteres.'),
      ).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('aceita exatamente 10 caracteres', async () => {
      const changePassword = vi.fn().mockResolvedValue(undefined);
      renderPagina({ auth: { changePassword } });

      await preencher('provisoria', '1234567890');
      await salvar();

      expect(changePassword).toHaveBeenCalledWith('provisoria', '1234567890');
    });

    it('recusa nova senha igual à atual', async () => {
      const changePassword = vi.fn();
      renderPagina({ auth: { changePassword } });

      await preencher('mesma-senha-123', 'mesma-senha-123');
      await salvar();

      expect(
        screen.getByText('A nova senha deve ser diferente da atual.'),
      ).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('recusa confirmação diferente da nova senha', async () => {
      const changePassword = vi.fn();
      renderPagina({ auth: { changePassword } });

      await preencher('provisoria', SENHA_NOVA, 'outra-coisa-aqui');
      await salvar();

      expect(
        screen.getByText('A confirmação não é igual à nova senha.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Confirmar nova senha')).toHaveFocus();
      expect(changePassword).not.toHaveBeenCalled();
    });
  });

  describe('erros da API, decididos pelo code', () => {
    it('INVALID_CURRENT_PASSWORD marca o campo da senha atual', async () => {
      const changePassword = vi
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 400, code: 'INVALID_CURRENT_PASSWORD' }),
        );
      renderPagina({ auth: { changePassword } });

      await preencher('errada-errada', SENHA_NOVA);
      await salvar();

      expect(
        await screen.findByText('A senha atual não confere.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Senha atual')).toHaveFocus();
    });

    it('WEAK_PASSWORD marca o campo da nova senha, com o texto da API', async () => {
      const changePassword = vi.fn().mockRejectedValue(
        new ApiError({
          status: 400,
          code: 'WEAK_PASSWORD',
          message: 'A nova senha deve ser diferente da atual.',
        }),
      );
      renderPagina({ auth: { changePassword } });

      await preencher('provisoria', SENHA_NOVA);
      await salvar();

      expect(
        await screen.findByText('A nova senha deve ser diferente da atual.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Nova senha')).toHaveFocus();
    });

    it('outros erros aparecem num aviso no topo', async () => {
      const changePassword = vi
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 429, code: 'TOO_MANY_REQUESTS' }),
        );
      renderPagina({ auth: { changePassword } });

      await preencher('provisoria', SENHA_NOVA);
      await salvar();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Muitas tentativas. Aguarde um instante.',
      );
    });
  });

  it('cada campo de senha tem o seu botão de mostrar/ocultar', async () => {
    renderPagina({ auth: {} });

    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar nova senha' }),
    );

    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Senha atual')).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('manda quem não tem sessão para /login', () => {
    renderPagina({ auth: { isAuthenticated: false } });

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('mostra a tela de recarregar quando a reconferência da sessão falha', () => {
    renderPagina({ auth: { permissionsError: new Error('falhou') } });

    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();
  });

  it('bloqueia o envio enquanto a troca está em andamento', async () => {
    let concluir: () => void = () => undefined;
    const changePassword = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        }),
    );
    renderPagina({ auth: { changePassword } });

    await preencher('provisoria', SENHA_NOVA);
    await salvar();

    expect(
      screen.getByRole('button', { name: /Salvar nova senha/ }),
    ).toBeDisabled();
    concluir();
    await waitFor(() =>
      expect(screen.getByText('Tela inicial')).toBeInTheDocument(),
    );
  });
});

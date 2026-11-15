import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkError } from 'ky';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/use-auth');

import { SESSION_NOTICE_KEY } from '@/auth/session-storage';
import { ApiError, CONNECTION_MESSAGE } from '@/lib/api-error';
import { renderWithProviders } from '@/test/render-with-providers';
import { LoginPage } from './login-page';

function renderLogin(
  auth: Parameters<typeof renderWithProviders>[1],
  route = '/login',
) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/content-briefs" element={<div>Lista de pautas</div>} />
      <Route path="/users" element={<div>Lista de usuários</div>} />
      <Route path="/no-permission" element={<div>Sem acesso</div>} />
      <Route path="/change-password" element={<div>Troca de senha</div>} />
    </Routes>,
    { ...auth, route },
  );
}

async function preencher(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), password);
}

describe('<LoginPage />', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('envia e-mail e senha ao clicar em "Entrar"', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    renderLogin({ auth: { isAuthenticated: false, signIn } });

    await preencher('dev.editor@pauta.local', 'senha-qualquer');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(signIn).toHaveBeenCalledWith(
      'dev.editor@pauta.local',
      'senha-qualquer',
    );
  });

  it('o Enter no campo da senha envia o formulário', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    renderLogin({ auth: { isAuthenticated: false, signIn } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'a@pauta.local');
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo{Enter}');

    expect(signIn).toHaveBeenCalledWith('a@pauta.local', 'segredo');
  });

  it('leva o foco ao e-mail ao abrir a tela', () => {
    renderLogin({ auth: { isAuthenticated: false } });

    expect(screen.getByLabelText('E-mail')).toHaveFocus();
  });

  it('não envia com campos vazios e aponta o que falta', async () => {
    const signIn = vi.fn();
    renderLogin({ auth: { isAuthenticated: false, signIn } });

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveFocus();

    await userEvent.type(screen.getByLabelText('E-mail'), 'a@pauta.local');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveFocus();
  });

  it('mostra e oculta a senha pelo botão do campo', async () => {
    renderLogin({ auth: { isAuthenticated: false } });
    const campo = screen.getByLabelText('Senha');
    expect(campo).toHaveAttribute('type', 'password');

    await userEvent.click(
      screen.getByRole('button', { name: 'Mostrar senha' }),
    );
    expect(campo).toHaveAttribute('type', 'text');

    await userEvent.click(
      screen.getByRole('button', { name: 'Ocultar senha' }),
    );
    expect(campo).toHaveAttribute('type', 'password');
  });

  it('bloqueia o botão enquanto o login está em andamento', async () => {
    let concluir: () => void = () => undefined;
    const signIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          concluir = resolve;
        }),
    );
    renderLogin({ auth: { isAuthenticated: false, signIn } });

    await preencher('a@pauta.local', 'segredo');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getByRole('button', { name: /Entrar/ })).toBeDisabled();

    concluir();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled(),
    );
  });

  describe('erros do login, decididos pelo code da API', () => {
    async function falharCom(error: unknown) {
      const signIn = vi.fn().mockRejectedValue(error);
      renderLogin({ auth: { isAuthenticated: false, signIn } });
      await preencher('a@pauta.local', 'senha-errada');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
      return screen.findByRole('alert');
    }

    it('INVALID_CREDENTIALS: e-mail ou senha inválidos, com a senha limpa e o foco nela', async () => {
      const alerta = await falharCom(
        new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' }),
      );

      expect(alerta).toHaveTextContent('E-mail ou senha inválidos.');
      expect(screen.getByLabelText('Senha')).toHaveValue('');
      expect(screen.getByLabelText('Senha')).toHaveFocus();
      expect(screen.getByLabelText('E-mail')).toHaveValue('a@pauta.local');
    });

    it('ACCOUNT_LOCKED: mostra o tempo restante que a API informa', async () => {
      const alerta = await falharCom(
        new ApiError({
          status: 403,
          code: 'ACCOUNT_LOCKED',
          message:
            'Conta bloqueada por excesso de tentativas. Tente novamente em 12 minutos.',
        }),
      );

      expect(alerta).toHaveTextContent('Tente novamente em 12 minutos.');
    });

    it('USER_DEACTIVATED: orienta a procurar um administrador', async () => {
      const alerta = await falharCom(
        new ApiError({ status: 403, code: 'USER_DEACTIVATED' }),
      );

      expect(alerta).toHaveTextContent('Procure um administrador');
    });

    it('TOO_MANY_REQUESTS: pede para aguardar', async () => {
      const alerta = await falharCom(
        new ApiError({ status: 429, code: 'TOO_MANY_REQUESTS' }),
      );

      expect(alerta).toHaveTextContent(
        'Muitas tentativas. Aguarde um instante.',
      );
    });

    it('sem conexão: fala de conexão, não de alterações não salvas', async () => {
      const alerta = await falharCom(
        new NetworkError(new Request('http://api.test/auth/login'), {
          cause: new TypeError('Failed to fetch'),
        }),
      );

      expect(alerta).toHaveTextContent(CONNECTION_MESSAGE);
    });
  });

  it('leva quem já tem sessão e acesso para /content-briefs', () => {
    renderLogin({ auth: { permissions: ['content-brief:read'] } });

    expect(screen.getByText('Lista de pautas')).toBeInTheDocument();
  });

  it('leva quem só administra usuários para /users', () => {
    renderLogin({ auth: { permissions: ['user:read'] } });

    expect(screen.getByText('Lista de usuários')).toBeInTheDocument();
  });

  it('leva quem está com senha provisória para /change-password, antes de qualquer tela', () => {
    renderLogin({
      auth: { permissions: ['content-brief:read'], mustChangePassword: true },
    });

    expect(screen.getByText('Troca de senha')).toBeInTheDocument();
  });

  it('mostra a tela de recarregar quando a reconferência da sessão falha', () => {
    renderLogin({
      auth: { permissions: [], permissionsError: new Error('falhou') },
    });

    expect(screen.getByText('Erro ao carregar permissões')).toBeInTheDocument();
  });

  it('mostra o aviso de sessão expirada uma única vez', () => {
    window.sessionStorage.setItem(SESSION_NOTICE_KEY, 'expired');
    renderLogin({ auth: { isAuthenticated: false } });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Sua sessão expirou. Entre de novo.',
    );
    expect(window.sessionStorage.getItem(SESSION_NOTICE_KEY)).toBeNull();
  });

  it('não mostra aviso numa visita normal', () => {
    renderLogin({ auth: { isAuthenticated: false } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

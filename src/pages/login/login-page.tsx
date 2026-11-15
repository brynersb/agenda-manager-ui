import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router';

import { getLandingRoute } from '@/auth/landing-route';
import { readSessionNotice, writeSessionNotice } from '@/auth/session-storage';
import { useAuthContext } from '@/auth/use-auth';
import { AuthCard } from '@/components/layout/auth-card';
import {
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { TextInput } from '@/components/ui/text-input';
import {
  CONNECTION_MESSAGE,
  getApiErrorMessage,
  isOfflineError,
} from '@/lib/api-error';

/** Aviso do login quando a sessão terminou sem a pessoa pedir. */
export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre de novo.';

interface LoginErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  if (!email.trim()) errors.email = 'Informe o e-mail.';
  if (!password) errors.password = 'Informe a senha.';
  return errors;
}

/**
 * Tela de entrada: e-mail e senha.
 *
 * Quem já tem sessão é redirecionado (para a troca de senha, se a senha for
 * provisória). As falhas do login aparecem num aviso acima do formulário,
 * decididas pelo `code` da API: credenciais inválidas, conta bloqueada (com o
 * tempo restante que a API informa), usuário desativado, excesso de tentativas
 * e falta de conexão. Enter envia; depois de uma falha o foco volta ao campo
 * da senha.
 *
 * @returns A tela de login, um redirecionamento ou uma tela de estado.
 */
export function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    mustChangePassword,
    permissions,
    isLoadingPermissions,
    permissionsError,
    signIn,
  } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice] = useState(readSessionNotice);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // O aviso vale uma vez: recarregar a página não o mostra de novo.
  useEffect(() => {
    writeSessionNotice(null);
  }, []);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (isLoading || (isAuthenticated && isLoadingPermissions)) {
    return <LoadingScreen />;
  }
  if (isAuthenticated && permissionsError) return <PermissionsLoadError />;
  if (isAuthenticated && mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (isAuthenticated) {
    return <Navigate to={getLandingRoute(permissions)} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(email, password);
    setErrors(found);
    setFormError(null);
    if (found.email) {
      emailRef.current?.focus();
      return;
    }
    if (found.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(
        isOfflineError(error) ? CONNECTION_MESSAGE : getApiErrorMessage(error),
      );
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Pauta de marketing"
      description="Entre com a sua conta para ver e editar a pauta da equipe."
    >
      {notice && !formError && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-hover p-3 text-ink text-sm"
        >
          {SESSION_EXPIRED_NOTICE}
        </p>
      )}
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-late-bg p-3 text-late text-sm"
        >
          <p className="m-0 font-semibold">Não foi possível entrar.</p>
          <p className="m-0 break-words">{formError}</p>
        </div>
      )}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field label="E-mail" error={errors.email}>
          {(control) => (
            <TextInput
              {...control}
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Senha" error={errors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              ref={passwordRef}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" className="mt-1 w-full" loading={submitting}>
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}

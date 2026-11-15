import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { useAuthContext } from '@/auth/use-auth';
import { AuthCard } from '@/components/layout/auth-card';
import {
  LoadingScreen,
  PermissionsLoadError,
} from '@/components/layout/full-screen';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import {
  CONNECTION_MESSAGE,
  getApiErrorMessage,
  isCode,
  isOfflineError,
} from '@/lib/api-error';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy';

interface ChangePasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmation?: string;
}

function validate(
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): ChangePasswordErrors {
  const errors: ChangePasswordErrors = {};
  if (!currentPassword) errors.currentPassword = 'Informe a senha atual.';
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = `A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.newPassword = `A nova senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  } else if (newPassword === currentPassword) {
    errors.newPassword = 'A nova senha deve ser diferente da atual.';
  }
  if (!errors.newPassword && confirmation !== newPassword) {
    errors.confirmation = 'A confirmação não é igual à nova senha.';
  }
  return errors;
}

/**
 * Tela de troca de senha, para a senha provisória e para o uso voluntário.
 *
 * Com `mustChangePassword` é a única tela liberada (as rotas protegidas
 * redirecionam para cá e a API recusa o resto) e a saída é "Sair". Fora disso
 * é a troca voluntária do menu do usuário, com "Cancelar". Em ambos, a API
 * devolve uma sessão nova, que substitui a atual, e a pessoa segue para a tela
 * inicial.
 *
 * Erros por código: `INVALID_CURRENT_PASSWORD` marca a senha atual,
 * `WEAK_PASSWORD` marca a nova; os demais aparecem num aviso no topo.
 *
 * @returns O formulário, um redirecionamento ou uma tela de estado.
 */
export function ChangePasswordPage() {
  const {
    isAuthenticated,
    isLoading,
    isLoadingPermissions,
    permissionsError,
    mustChangePassword,
    changePassword,
    signOut,
  } = useAuthContext();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const currentRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentRef.current?.focus();
  }, []);

  if (isLoading || (isAuthenticated && isLoadingPermissions)) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (permissionsError) return <PermissionsLoadError />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const found = validate(currentPassword, newPassword, confirmation);
    setErrors(found);
    setFormError(null);
    if (found.currentPassword) return currentRef.current?.focus();
    if (found.newPassword) return newRef.current?.focus();
    if (found.confirmation) return confirmationRef.current?.focus();

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/', { replace: true });
    } catch (error) {
      if (isCode(error, 'INVALID_CURRENT_PASSWORD')) {
        setErrors({ currentPassword: getApiErrorMessage(error) });
        currentRef.current?.focus();
      } else if (isCode(error, 'WEAK_PASSWORD')) {
        setErrors({ newPassword: getApiErrorMessage(error) });
        newRef.current?.focus();
      } else {
        setFormError(
          isOfflineError(error)
            ? CONNECTION_MESSAGE
            : getApiErrorMessage(error),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <AuthCard
      title={mustChangePassword ? 'Defina uma nova senha' : 'Alterar senha'}
      description={
        mustChangePassword
          ? 'Sua senha é provisória. Defina uma senha nova para continuar.'
          : 'Informe a senha atual e escolha uma nova. Os outros aparelhos conectados precisarão entrar de novo.'
      }
    >
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-late-bg p-3 text-late text-sm"
        >
          <p className="m-0 font-semibold">Não foi possível trocar a senha.</p>
          <p className="m-0 break-words">{formError}</p>
        </div>
      )}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <Field label="Senha atual" error={errors.currentPassword}>
          {(control) => (
            <PasswordInput
              {...control}
              ref={currentRef}
              name="currentPassword"
              autoComplete="current-password"
              visibilityLabel="senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Nova senha"
          error={errors.newPassword}
          help={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres, diferente da atual.`}
        >
          {(control) => (
            <PasswordInput
              {...control}
              ref={newRef}
              name="newPassword"
              autoComplete="new-password"
              visibilityLabel="nova senha"
              maxLength={PASSWORD_MAX_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmation}>
          {(control) => (
            <PasswordInput
              {...control}
              ref={confirmationRef}
              name="confirmation"
              autoComplete="new-password"
              visibilityLabel="confirmação da nova senha"
              maxLength={PASSWORD_MAX_LENGTH}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}
        </Field>
        <div className="mt-1 flex flex-wrap gap-2.5">
          <Button type="submit" loading={submitting} className="flex-1">
            Salvar nova senha
          </Button>
          {mustChangePassword ? (
            <Button
              variant="ghost"
              disabled={submitting}
              loading={leaving}
              onClick={() => void handleLeave()}
            >
              Sair
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => navigate('/')}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}

import { useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormSurface } from '@/components/ui/form-surface';
import { LeaveConfirmModal } from '@/components/ui/leave-confirm-modal';
import { Modal } from '@/components/ui/modal';
import { NativeSelect } from '@/components/ui/native-select';
import { PasswordInput } from '@/components/ui/password-input';
import { TextInput } from '@/components/ui/text-input';
import {
  useCreateUser,
  useFetchUser,
  usersKeys,
  useUpdateUser,
} from '@/hooks/use-users';
import { getApiErrorMessage, isCode } from '@/lib/api-error';
import { ROLE_LABEL, ROLE_ORDER } from '@/lib/labels';
import type { User, UserWithTemporaryPassword } from '@/types/user';
import {
  buildCreateBody,
  buildUpdateBody,
  EMAIL_MAX,
  EMPTY_VALUES,
  errorsFromApi,
  isChanged,
  NAME_MAX,
  type UserFormErrors,
  type UserFormValues,
  validate,
  valuesOf,
} from './user-form-values';

/** Aviso do `409` de versão, no topo do formulário (mesmo padrão da pauta). */
export const USER_CONFLICT_MESSAGE =
  'Este usuário foi alterado por outra pessoa.';

const FORM_ID = 'user-form';

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({
  value: role,
  label: ROLE_LABEL[role],
}));

/** Resultado de salvar: o que a tela de usuários precisa mostrar a seguir. */
export type UserFormResult =
  | { kind: 'created'; result: UserWithTemporaryPassword }
  | { kind: 'updated'; user: User };

interface UserFormDialogProps {
  /** Usuário a editar, ou `null` para cadastrar um novo. */
  user: User | null;
  /** Id da pessoa logada: ela não troca o próprio papel. */
  currentUserId: string;
  onClose: () => void;
  onSaved: (result: UserFormResult) => void;
}

/** Foto do formulário: o que foi carregado e o que a pessoa fez com isso. */
interface FormState {
  /** Usuário carregado; `null` no cadastro. Traz a `version` do `PATCH`. */
  origin: User | null;
  base: UserFormValues;
  values: UserFormValues;
}

function stateOf(origin: User | null): FormState {
  const base = origin ? valuesOf(origin) : EMPTY_VALUES;
  return { origin, base, values: base };
}

/**
 * Formulário de cadastrar e editar usuário, em modal ou painel lateral
 * conforme a preferência da pessoa (`FormSurface`).
 *
 * Cadastro: nome, e-mail, papel e senha opcional (sem ela a API gera uma
 * provisória, mostrada pela tela de usuários uma única vez). Edição: nome e
 * papel (o e-mail não muda); quem edita a si mesmo não troca o próprio papel.
 * Erros da API vão ao campo certo pelo `code` (`EMAIL_ALREADY_REGISTERED` no
 * e-mail, `LAST_ADMIN` no papel...). O `409` de versão mantém o que foi
 * digitado e oferece "Ver versão atual". Fechar com alterações pede
 * confirmação.
 *
 * @param props.user Usuário a editar, ou `null` para novo.
 * @param props.currentUserId Id de quem está logado.
 * @param props.onClose Fecha o formulário.
 * @param props.onSaved Recebe o resultado de salvar com sucesso.
 * @returns O formulário.
 */
export function UserFormDialog({
  user,
  currentUserId,
  onClose,
  onSaved,
}: UserFormDialogProps) {
  const isNew = user === null;
  const queryClient = useQueryClient();
  const create = useCreateUser();
  const update = useUpdateUser();
  const fetchUser = useFetchUser();

  const [form, setForm] = useState<FormState>(() => stateOf(user));
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [conflict, setConflict] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [confirmingReload, setConfirmingReload] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  const isSelf = form.origin?.id === currentUserId;
  const dirty = isChanged(form.values, form.base);
  const saving = create.isPending || update.isPending;

  // O Radix leva o foco ao primeiro controle ("Fechar") depois de montar; o
  // quadro seguinte devolve o foco ao nome.
  useEffect(() => {
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  function change(partial: Partial<UserFormValues>) {
    setForm((current) => ({
      ...current,
      values: { ...current.values, ...partial },
    }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(partial)) {
        delete next[field as keyof UserFormErrors];
      }
      return next;
    });
  }

  function focusFirstError(found: UserFormErrors) {
    if (found.name) nameRef.current?.focus();
    else if (found.email) emailRef.current?.focus();
  }

  function handleSaveError(error: unknown) {
    if (isCode(error, 'USER_VERSION_OUTDATED')) {
      setConflict(true);
      void queryClient.invalidateQueries({ queryKey: usersKeys.all });
      return;
    }
    const found = errorsFromApi(error);
    setErrors(found);
    focusFirstError(found);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    const mode = isNew ? 'create' : 'edit';
    const invalid = validate(form.values, mode);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      focusFirstError(invalid);
      return;
    }

    submitting.current = true;
    setErrors({});
    try {
      if (form.origin) {
        const saved = await update.mutateAsync({
          id: form.origin.id,
          input: buildUpdateBody(form.values, form.origin),
        });
        onSaved({ kind: 'updated', user: saved });
      } else {
        const result = await create.mutateAsync(buildCreateBody(form.values));
        onSaved({ kind: 'created', result });
      }
    } catch (error) {
      handleSaveError(error);
    } finally {
      submitting.current = false;
    }
  }

  async function reload() {
    setConfirmingReload(false);
    if (!form.origin) return;
    try {
      const fresh = await fetchUser(form.origin.id);
      setForm(stateOf(fresh));
      setErrors({});
      setConflict(false);
    } catch (error) {
      setErrors({ general: getApiErrorMessage(error) });
    }
  }

  function requestReload() {
    if (dirty) setConfirmingReload(true);
    else void reload();
  }

  function tryClose() {
    if (dirty) setConfirmingExit(true);
    else onClose();
  }

  const title = isNew ? 'Novo usuário' : 'Editar usuário';

  return (
    <>
      <FormSurface
        open
        onOpenChange={(open) => {
          if (!open) tryClose();
        }}
        title={title}
        footer={
          <>
            <span className="flex-1" />
            <Button variant="secondary" onClick={tryClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              loading={saving}
              disabled={!isNew && !dirty}
            >
              {isNew ? 'Criar usuário' : 'Salvar'}
            </Button>
          </>
        }
      >
        {conflict && (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-2.5 rounded-lg border border-late bg-late-bg p-3 text-late text-sm"
          >
            <p className="m-0 font-semibold">{USER_CONFLICT_MESSAGE}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={requestReload}>
                Ver versão atual
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConflict(false)}
              >
                Continuar editando
              </Button>
            </div>
          </div>
        )}
        {errors.general && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-lg border border-late bg-late-bg p-3 text-late text-sm"
          >
            {errors.general}
          </p>
        )}
        <form
          id={FORM_ID}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4 pb-2"
        >
          <Field
            label="Nome"
            error={errors.name}
            counter={{ current: form.values.name.length, max: NAME_MAX }}
          >
            {(control) => (
              <TextInput
                {...control}
                ref={nameRef}
                name="name"
                autoComplete="off"
                maxLength={NAME_MAX}
                value={form.values.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="E-mail"
            error={errors.email}
            help={isNew ? undefined : 'O e-mail não pode ser alterado.'}
          >
            {(control) => (
              <TextInput
                {...control}
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="off"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={EMAIL_MAX}
                disabled={!isNew}
                value={form.values.email}
                onChange={(e) => change({ email: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Papel"
            error={errors.role}
            help={isSelf ? 'Você não pode alterar o próprio papel.' : undefined}
          >
            {(control) => (
              <NativeSelect
                control={control}
                value={form.values.role}
                options={ROLE_OPTIONS}
                disabled={isSelf}
                onChange={(role) =>
                  change({ role: role as UserFormValues['role'] })
                }
              />
            )}
          </Field>
          {isNew && (
            <Field
              label="Senha provisória (opcional)"
              error={errors.password}
              help="Deixe em branco para a API gerar uma senha. Em qualquer caso, a pessoa terá de trocá-la no primeiro acesso."
            >
              {(control) => (
                <PasswordInput
                  {...control}
                  name="password"
                  autoComplete="new-password"
                  visibilityLabel="senha provisória"
                  value={form.values.password}
                  onChange={(e) => change({ password: e.target.value })}
                />
              )}
            </Field>
          )}
        </form>
      </FormSurface>

      <LeaveConfirmModal
        open={confirmingExit}
        onOpenChange={setConfirmingExit}
        onLeave={() => {
          setConfirmingExit(false);
          onClose();
        }}
      />

      <Modal
        open={confirmingReload}
        onOpenChange={setConfirmingReload}
        title="Ver a versão atual?"
        description="O que você digitou será descartado e o formulário mostrará a versão salva por outra pessoa."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingReload(false)}>
              Continuar editando
            </Button>
            <Button onClick={() => void reload()}>Ver versão atual</Button>
          </>
        }
      />
    </>
  );
}

import { getApiErrorMessage, getFieldErrors, isCode } from '@/lib/api-error';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/password-policy';
import type { Role } from '@/types/auth';
import type { CreateUserInput, UpdateUserInput, User } from '@/types/user';

/** Limite de caracteres do nome (`INVALID_USER_NAME`). */
export const NAME_MAX = 120;

/** Limite de caracteres do e-mail (`INVALID_EMAIL`). */
export const EMAIL_MAX = 254;

/** Valores do formulário, no formato dos controles. */
export interface UserFormValues {
  name: string;
  email: string;
  role: Role;
  /** Só na criação; vazio pede à API uma senha provisória gerada. */
  password: string;
}

/** Campos que recebem mensagem de erro, mais `general` para o aviso do topo. */
export type UserFormErrors = Partial<
  Record<keyof UserFormValues | 'general', string>
>;

/**
 * Valores de um usuário novo. O papel padrão é o de menor privilégio: quem
 * cadastra escolhe subir, e esquecer de escolher não dá acesso de mais.
 */
export const EMPTY_VALUES: UserFormValues = {
  name: '',
  email: '',
  role: 'content-brief-viewer',
  password: '',
};

/**
 * Valores iniciais da edição.
 *
 * @param user Usuário carregado.
 * @returns Nome, e-mail e papel do usuário; senha sempre vazia.
 */
export function valuesOf(user: User): UserFormValues {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    password: '',
  };
}

/**
 * Diz se o formulário difere do estado carregado (nome ou papel; o e-mail não
 * muda na edição e a senha só existe na criação).
 *
 * @param values Valores atuais.
 * @param base Valores carregados.
 * @returns `true` se há algo por salvar.
 */
export function isChanged(
  values: UserFormValues,
  base: UserFormValues,
): boolean {
  return (
    values.name !== base.name ||
    values.email !== base.email ||
    values.role !== base.role ||
    values.password !== base.password
  );
}

/**
 * Valida o formulário no cliente, com as mesmas regras da API (a API continua
 * sendo a palavra final: os limites vêm do contrato `docs/auth.md`).
 *
 * @param values Valores a validar.
 * @param mode `create` exige e-mail e confere a senha opcional; `edit` só nome.
 * @returns Mapa campo → mensagem; vazio quando está tudo certo.
 */
export function validate(
  values: UserFormValues,
  mode: 'create' | 'edit',
): UserFormErrors {
  const errors: UserFormErrors = {};
  const name = values.name.trim();

  if (name.length === 0 || name.length > NAME_MAX) {
    errors.name = `Informe um nome com até ${NAME_MAX} caracteres.`;
  }

  if (mode === 'create') {
    const email = values.email.trim();
    if (email.length === 0) {
      errors.email = 'Informe o e-mail.';
    } else if (email.length > EMAIL_MAX || !/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = 'Informe um e-mail válido.';
    }

    const { password } = values;
    if (
      password.length > 0 &&
      (password.length < PASSWORD_MIN_LENGTH ||
        password.length > PASSWORD_MAX_LENGTH)
    ) {
      errors.password = `A senha deve ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres.`;
    }
  }

  return errors;
}

/**
 * Corpo de `POST /users`.
 *
 * @param values Valores já validados.
 * @returns Nome e e-mail sem espaços nas pontas; `password` só se digitada.
 */
export function buildCreateBody(values: UserFormValues): CreateUserInput {
  const body: CreateUserInput = {
    name: values.name.trim(),
    email: values.email.trim(),
    role: values.role,
  };
  if (values.password) body.password = values.password;
  return body;
}

/**
 * Corpo de `PATCH /users/:id`: só o que mudou, mais a `version` carregada.
 *
 * @param values Valores atuais.
 * @param origin Usuário carregado (de onde vêm a `version` e o que mudou).
 * @returns O corpo do `PATCH`.
 */
export function buildUpdateBody(
  values: UserFormValues,
  origin: User,
): UpdateUserInput {
  const body: UpdateUserInput = { version: origin.version };
  const name = values.name.trim();
  if (name !== origin.name) body.name = name;
  if (values.role !== origin.role) body.role = values.role;
  return body;
}

const FORM_FIELDS: ReadonlyArray<keyof UserFormValues> = [
  'name',
  'email',
  'role',
  'password',
];

/**
 * Converte um erro da API em mensagens no lugar certo do formulário, decidido
 * pelo `code`: e-mail repetido ou inválido no e-mail, nome inválido no nome,
 * senha fraca na senha, `LAST_ADMIN` e `CANNOT_MODIFY_SELF` no papel. O resto
 * (inclusive falta de conexão) vira o aviso do topo.
 *
 * @param error Erro da requisição.
 * @returns Mensagens por campo e/ou `general`.
 */
export function errorsFromApi(error: unknown): UserFormErrors {
  const message = getApiErrorMessage(error);

  if (
    isCode(error, 'EMAIL_ALREADY_REGISTERED') ||
    isCode(error, 'INVALID_EMAIL')
  ) {
    return { email: message };
  }
  if (isCode(error, 'INVALID_USER_NAME')) return { name: message };
  if (isCode(error, 'WEAK_PASSWORD')) return { password: message };
  if (isCode(error, 'LAST_ADMIN') || isCode(error, 'CANNOT_MODIFY_SELF')) {
    return { role: message };
  }

  if (isCode(error, 'INVALID_REQUEST')) {
    const errors: UserFormErrors = {};
    for (const [field, text] of Object.entries(getFieldErrors(error))) {
      if ((FORM_FIELDS as readonly string[]).includes(field)) {
        errors[field as keyof UserFormValues] = text;
      }
    }
    if (Object.keys(errors).length > 0) return errors;
  }

  return { general: message };
}

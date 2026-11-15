import { isHTTPError, isNetworkError, isTimeoutError } from 'ky';

import type { ApiErrorBody, FieldError } from '@/types/api';

/** Mensagem exibida quando a API não responde (rede caída ou servidor fora). */
export const OFFLINE_MESSAGE =
  'Sem conexão com o servidor. Suas alterações não foram salvas.';

/** Última rede de segurança: erro sem `code` conhecido nem `message` da API. */
export const FALLBACK_MESSAGE = 'Não foi possível concluir. Tente de novo.';

/**
 * Mensagem em pt-BR de cada `code` do catálogo da API (plan técnico §5.6).
 *
 * A decisão é sempre pelo `code`, nunca pelo texto da API (ADR-008): o texto
 * pode mudar sem aviso, o `code` é estável.
 */
export const CODE_MESSAGES = {
  UNAUTHENTICATED: 'Sua sessão expirou. Entre de novo.',
  FORBIDDEN: 'Você não tem permissão para executar esta ação.',
  INVALID_REQUEST: 'Confira os campos destacados e tente de novo.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  TOO_MANY_REQUESTS: 'Muitas tentativas. Aguarde um instante.',
  INVALID_REGISTRY_NAME: 'Informe um nome com até 80 caracteres.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
  ESTATE_DEVELOPMENT_NOT_FOUND:
    'Este empreendimento não foi encontrado. Atualize a página.',
  ESTATE_DEVELOPMENT_NAME_DUPLICATED:
    'Já existe um empreendimento com este nome. Se ele estiver arquivado, reative-o.',
  ESTATE_DEVELOPMENT_UNAVAILABLE:
    'Este empreendimento está arquivado e não pode ser usado em pautas novas.',
  ESTATE_DEVELOPMENT_VERSION_OUTDATED:
    'Este empreendimento foi alterado por outra pessoa. Recarregue para ver a versão atual.',
  OWNER_NOT_FOUND: 'Este responsável não foi encontrado. Atualize a página.',
  OWNER_NAME_DUPLICATED:
    'Já existe um responsável com este nome. Se ele estiver arquivado, reative-o.',
  OWNER_UNAVAILABLE:
    'Este responsável está arquivado e não pode ser usado em pautas novas.',
  OWNER_VERSION_OUTDATED:
    'Este responsável foi alterado por outra pessoa. Recarregue para ver a versão atual.',
  INVALID_TITLE: 'Informe um título com até 140 caracteres.',
  INVALID_DESCRIPTION: 'A descrição pode ter no máximo 1200 caracteres.',
  CONTENT_BRIEF_NOT_FOUND:
    'Esta pauta não foi encontrada. Ela pode ter sido excluída.',
  CONTENT_BRIEF_VERSION_OUTDATED:
    'Esta pauta foi alterada por outra pessoa. Recarregue para ver a versão atual.',
} as const;

/** Códigos de erro conhecidos pelo front. */
export type ApiErrorCode = keyof typeof CODE_MESSAGES;

interface ApiErrorInit {
  status: number;
  code?: string;
  message?: string;
  fields?: FieldError[];
}

/**
 * Erro devolvido pela API, já no formato do contrato (ADR-008).
 *
 * `code` é vazio quando a resposta não trouxe corpo no padrão (ex.: proxy
 * devolvendo HTML); nesse caso a mensagem cai no fallback.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];

  constructor({ status, code = '', message = '', fields = [] }: ApiErrorInit) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function isBody(data: unknown): data is Partial<ApiErrorBody> {
  return typeof data === 'object' && data !== null;
}

/**
 * Converte um erro HTTP do `ky` em `ApiError`, lendo o corpo `{ statusCode,
 * code, message, fields? }`.
 *
 * @param error Erro HTTP já com `data` populado pelo `ky`.
 * @returns O erro no formato do contrato; campos ausentes ficam vazios.
 */
export function toApiError(error: {
  response: { status: number };
  data?: unknown;
}): ApiError {
  const body = isBody(error.data) ? error.data : {};
  return new ApiError({
    status: error.response.status,
    code: typeof body.code === 'string' ? body.code : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
    fields: Array.isArray(body.fields) ? body.fields : undefined,
  });
}

function asApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (isHTTPError(error)) return toApiError(error);
  return null;
}

/**
 * Diz se o erro é de conectividade: rede caída, servidor fora ou tempo
 * esgotado. Nesses casos não há resposta da API para interpretar.
 *
 * @param error Erro da requisição.
 * @returns `true` quando a requisição nem chegou a ter resposta.
 */
export function isOfflineError(error: unknown): boolean {
  return isNetworkError(error) || isTimeoutError(error);
}

/**
 * Diz se o erro da API tem o `code` informado.
 *
 * @param error Erro da requisição.
 * @param code Código do catálogo (`CONTENT_BRIEF_VERSION_OUTDATED`...).
 * @returns `true` quando é um erro da API com esse código.
 */
export function isCode(error: unknown, code: ApiErrorCode): boolean {
  return asApiError(error)?.code === code;
}

/**
 * Status HTTP do erro, quando ele veio da API.
 *
 * @param error Erro da requisição.
 * @returns O status, ou `undefined` para erros sem resposta (rede, bug).
 */
export function getErrorStatus(error: unknown): number | undefined {
  return asApiError(error)?.status;
}

/**
 * Mensagem de erro para o usuário, decidida pelo `code` da API.
 *
 * Ordem: sem conexão; mapa `code → mensagem`; `message` da própria API (que já
 * vem em pt-BR); texto genérico.
 *
 * @param error Erro da requisição.
 * @returns O texto em pt-BR a exibir.
 */
export function getApiErrorMessage(error: unknown): string {
  if (isOfflineError(error)) return OFFLINE_MESSAGE;

  const apiError = asApiError(error);
  if (!apiError) return FALLBACK_MESSAGE;

  if (apiError.code in CODE_MESSAGES) {
    return CODE_MESSAGES[apiError.code as ApiErrorCode];
  }
  return apiError.message || FALLBACK_MESSAGE;
}

/**
 * Erros por campo de um `400 INVALID_REQUEST`, para marcar o formulário.
 *
 * @param error Erro da requisição.
 * @returns Mapa `campo → mensagem`; vazio quando o erro não traz campos.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const fields = asApiError(error)?.fields ?? [];
  return Object.fromEntries(fields.map((f) => [f.field, f.message]));
}

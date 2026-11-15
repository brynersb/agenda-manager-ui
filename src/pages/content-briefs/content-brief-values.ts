import type { ContentBriefBody } from '@/hooks/use-content-briefs';
import {
  type ApiErrorCode,
  getApiErrorMessage,
  getFieldErrors,
  isCode,
} from '@/lib/api-error';
import type {
  ContentBriefAction,
  ContentBriefChannel,
  ContentBriefResponse,
  ContentBriefStatus,
} from '@/types/content-brief';

/** Limite do título (plan técnico §4.1). */
export const TITLE_MAX = 140;

/** Limite da descrição (plan técnico §4.1). */
export const DESCRIPTION_MAX = 1200;

/** Mensagem do título vazio, a mesma do protótipo. */
export const TITLE_REQUIRED_MESSAGE = 'Escreva um título para a pauta.';

/**
 * Valores do formulário, no formato dos controles: `''` é "vazio" nos campos
 * de texto, data e select (um `<select>` e um `<input type="date">` não
 * representam `null`). A conversão para `null` acontece em `buildBody`.
 */
export interface ContentBriefValues {
  title: string;
  description: string;
  estateDevelopmentId: string | null;
  ownerId: string | null;
  action: ContentBriefAction | '';
  channel: ContentBriefChannel | '';
  /** `'YYYY-MM-DD'` ou `''`. */
  dueDate: string;
  status: ContentBriefStatus;
}

/** Campos que aceitam mensagem de erro no formulário. */
export type ContentBriefField = keyof ContentBriefValues;

/** Erros por campo; `general` é o que não pertence a nenhum campo. */
export type ContentBriefErrors = Partial<
  Record<ContentBriefField | 'general', string>
>;

/** Pauta nova: tudo vazio e status "A fazer". */
export const EMPTY_VALUES: ContentBriefValues = {
  title: '',
  description: '',
  estateDevelopmentId: null,
  ownerId: null,
  action: '',
  channel: '',
  dueDate: '',
  status: 'TODO',
};

/**
 * Valores do formulário a partir de uma pauta carregada.
 *
 * @param brief Pauta devolvida por `GET /content-briefs/:id`.
 * @returns Os valores iniciais do editor.
 */
export function valuesOf(brief: ContentBriefResponse): ContentBriefValues {
  return {
    title: brief.title,
    description: brief.description,
    estateDevelopmentId: brief.estateDevelopment?.id ?? null,
    ownerId: brief.owner?.id ?? null,
    action: brief.action ?? '',
    channel: brief.channel ?? '',
    dueDate: brief.dueDate ?? '',
    status: brief.status,
  };
}

/**
 * Diz se o formulário difere do que foi carregado (ou do vazio, na pauta
 * nova). Espaços nas pontas contam: quem digitou e apagou ainda assim mexeu.
 *
 * @param current Valores no formulário.
 * @param base Valores com que o formulário abriu.
 * @returns `true` quando há alteração a perder.
 */
export function isChanged(
  current: ContentBriefValues,
  base: ContentBriefValues,
): boolean {
  return (Object.keys(base) as ContentBriefField[]).some(
    (field) => current[field] !== base[field],
  );
}

/**
 * Valida o formulário antes de enviar. Só o título é obrigatório; os demais
 * limites já são impostos pelos `maxLength` dos controles.
 *
 * @param values Valores no formulário.
 * @returns Erros por campo; vazio quando pode enviar.
 */
export function validate(values: ContentBriefValues): ContentBriefErrors {
  const errors: ContentBriefErrors = {};
  if (values.title.trim() === '') {
    errors.title = TITLE_REQUIRED_MESSAGE;
  }
  return errors;
}

/**
 * Monta o corpo do `POST`/`PUT` sempre a partir do estado completo.
 *
 * O `PUT` substitui a pauta: omitir um campo faria a API apagá-lo. Por isso
 * todos vão, com `null` no que está vazio (inclusive o `''` do input de data).
 *
 * @param values Valores no formulário.
 * @returns O corpo, com texto aparado nas pontas.
 */
export function buildBody(values: ContentBriefValues): ContentBriefBody {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    dueDate: values.dueDate === '' ? null : values.dueDate,
    status: values.status,
    action: values.action === '' ? null : values.action,
    channel: values.channel === '' ? null : values.channel,
    estateDevelopmentId: values.estateDevelopmentId,
    ownerId: values.ownerId,
  };
}

/** Código de domínio que pertence a um campo do formulário. */
const FIELD_BY_CODE: Partial<Record<ApiErrorCode, ContentBriefField>> = {
  INVALID_TITLE: 'title',
  INVALID_DESCRIPTION: 'description',
  ESTATE_DEVELOPMENT_UNAVAILABLE: 'estateDevelopmentId',
  OWNER_UNAVAILABLE: 'ownerId',
};

/**
 * Traduz um erro de gravação da API em erros de campo.
 *
 * Aceita `fields` do `400 INVALID_REQUEST` (campo `field` igual ao nome do
 * campo do corpo) e os códigos de domínio que apontam para um campo. O que não
 * casa com nenhum campo vira `general`, com a mensagem decidida pelo `code`.
 *
 * @param error Erro da requisição.
 * @returns Erros por campo, ou só `general`.
 */
export function errorsFromApi(error: unknown): ContentBriefErrors {
  const errors: ContentBriefErrors = {};

  for (const [field, message] of Object.entries(getFieldErrors(error))) {
    if (field in EMPTY_VALUES) errors[field as ContentBriefField] = message;
  }
  for (const [code, field] of Object.entries(FIELD_BY_CODE)) {
    if (isCode(error, code as ApiErrorCode)) {
      errors[field] = getApiErrorMessage(error);
    }
  }

  if (Object.keys(errors).length === 0) {
    errors.general = getApiErrorMessage(error);
  }
  return errors;
}

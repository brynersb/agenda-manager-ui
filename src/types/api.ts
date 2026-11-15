/** Erro de campo devolvido pela API em `400 INVALID_REQUEST`. */
export interface FieldError {
  field: string;
  message: string;
}

/** Corpo de erro padrão da API (ADR-008). */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  fields?: FieldError[];
}

/** Lista paginada (ADR-010). */
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

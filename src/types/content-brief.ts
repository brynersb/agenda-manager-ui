/** Status de uma pauta (enum do banco, em caixa alta). */
export type ContentBriefStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

/** Ação que a pauta pede da equipe. */
export type ContentBriefAction =
  | 'CHASE'
  | 'DEVELOP'
  | 'PAYMENT'
  | 'CREATE'
  | 'FOLLOW_UP'
  | 'ANALYZE';

/** Canal de divulgação da pauta. */
export type ContentBriefChannel =
  | 'INSTAGRAM'
  | 'EMAIL'
  | 'BLOG'
  | 'ADS'
  | 'VIDEO'
  | 'WEBSITE'
  | 'REPORT'
  | 'OTHER';

/**
 * Situação do prazo, calculada pela API com a data de hoje no fuso da operação
 * (ADR-005). O front nunca recalcula: só agrupa e formata.
 */
export type DueStatus =
  | 'overdue'
  | 'today'
  | 'next-7-days'
  | 'later'
  | 'no-due-date'
  | 'completed';

/** Referência resumida a um empreendimento ou responsável dentro da pauta. */
export interface ContentBriefLink {
  id: string;
  name: string;
  /** `false` quando o cadastro foi arquivado depois de atribuído. */
  active: boolean;
}

/** Pessoa que criou ou alterou a pauta (snapshot do nome). */
export interface ContentBriefAuthor {
  id: string;
  name: string | null;
}

/** Pauta como devolvida por `GET /content-briefs` (plan técnico §5.3). */
export interface ContentBriefResponse {
  id: string;
  title: string;
  description: string;
  /** `'YYYY-MM-DD'` ou `null`. */
  dueDate: string | null;
  dueStatus: DueStatus;
  daysUntilDue: number | null;
  status: ContentBriefStatus;
  action: ContentBriefAction | null;
  channel: ContentBriefChannel | null;
  estateDevelopment: ContentBriefLink | null;
  owner: ContentBriefLink | null;
  completedAt: string | null;
  /** Controle de concorrência: vai de volta em `PUT` e `PATCH` (ADR-006). */
  version: number;
  createdAt: string;
  createdBy: ContentBriefAuthor;
  updatedAt: string;
  updatedBy: ContentBriefAuthor;
}

/** Resposta de `GET /content-briefs/summary`. */
export interface ContentBriefSummary {
  /** Data de referência usada pela API (`YYYY-MM-DD`, `APP_TIMEZONE`). */
  today: string;
  total: number;
  byDueStatus: Record<DueStatus, number>;
  byStatus: Record<ContentBriefStatus, number>;
}

/**
 * Query de `GET /content-briefs` e `GET /content-briefs/summary` (o resumo
 * ignora `dueStatus`, `page`, `limit` e `sort`).
 */
export interface ContentBriefFilters {
  /** CSV de `DueStatus`. */
  dueStatus?: string;
  /** CSV de `ContentBriefStatus`. */
  status?: string;
  /** Uuid ou `'none'`. */
  estateDevelopmentId?: string;
  /** Uuid ou `'none'`. */
  ownerId?: string;
  action?: ContentBriefAction;
  /** Busca textual, 2 a 100 caracteres. */
  q?: string;
  sort?: 'dueDate' | '-dueDate' | 'updatedAt';
  page?: number;
  limit?: number;
}

/** Filtros que valem para a lista e para o resumo (não dependem do chip). */
export type CommonFilters = Pick<
  ContentBriefFilters,
  'estateDevelopmentId' | 'ownerId' | 'action' | 'q'
>;

/**
 * Filtro rápido (chips): decide quais situações a tela mostra. Vai para a URL
 * como `dueStatus`.
 */
export type QuickFilter = 'all' | 'overdue' | 'next-7-days' | 'completed';

/** Modo de exibição: grupos por prazo ou quadro por status. */
export type ViewMode = 'dueDate' | 'status';

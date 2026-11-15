import type { Role } from '@/types/auth';
import type {
  ContentBriefAction,
  ContentBriefChannel,
  ContentBriefStatus,
  DueStatus,
  QuickFilter,
} from '@/types/content-brief';
import type { UserStatus, UserStatusFilter } from '@/types/user';

/** Papéis na ordem dos seletores (do mais ao menos privilegiado). */
export const ROLE_ORDER: Role[] = [
  'admin',
  'content-brief-editor',
  'content-brief-viewer',
];

/** Rótulo em pt-BR de cada papel, para o menu do usuário e a lista de usuários. */
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  'content-brief-editor': 'Editor',
  'content-brief-viewer': 'Leitor',
};

/** Filtros de situação da lista de usuários, na ordem do controle. */
export const USER_STATUS_FILTERS: { value: UserStatusFilter; label: string }[] =
  [
    { value: 'ALL', label: 'Todos' },
    { value: 'ACTIVE', label: 'Ativos' },
    { value: 'DEACTIVATED', label: 'Desativados' },
  ];

/** Rótulo em pt-BR da situação de um usuário. */
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Ativo',
  DEACTIVATED: 'Desativado',
};

/** Status na ordem do quadro e do seletor (a mesma do protótipo). */
export const STATUS_ORDER: ContentBriefStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
];

/** Rótulo em pt-BR de cada status. */
export const STATUS_LABEL: Record<ContentBriefStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  IN_REVIEW: 'Em revisão',
  DONE: 'Concluída',
};

/** Ações na ordem do protótipo. */
export const ACTION_ORDER: ContentBriefAction[] = [
  'CHASE',
  'DEVELOP',
  'PAYMENT',
  'CREATE',
  'FOLLOW_UP',
  'ANALYZE',
];

/** Rótulo em pt-BR de cada ação. */
export const ACTION_LABEL: Record<ContentBriefAction, string> = {
  CHASE: 'Cobrar',
  DEVELOP: 'Desenvolver',
  PAYMENT: 'Pagamento',
  CREATE: 'Criar',
  FOLLOW_UP: 'Acompanhar',
  ANALYZE: 'Analisar',
};

/** Canais na ordem do protótipo. */
export const CHANNEL_ORDER: ContentBriefChannel[] = [
  'INSTAGRAM',
  'EMAIL',
  'BLOG',
  'ADS',
  'VIDEO',
  'WEBSITE',
  'REPORT',
  'OTHER',
];

/** Rótulo em pt-BR de cada canal. */
export const CHANNEL_LABEL: Record<ContentBriefChannel, string> = {
  INSTAGRAM: 'Instagram',
  EMAIL: 'E-mail',
  BLOG: 'Blog',
  ADS: 'Anúncios',
  VIDEO: 'Vídeo',
  WEBSITE: 'Site',
  REPORT: 'Relatório',
  OTHER: 'Outro',
};

/** Título de cada grupo da visão por prazo. */
export const DUE_STATUS_LABEL: Record<DueStatus, string> = {
  overdue: 'Atrasadas',
  today: 'Hoje',
  'next-7-days': 'Próximos 7 dias',
  later: 'Mais adiante',
  'no-due-date': 'Sem prazo definido',
  completed: 'Concluídas',
};

/** Situações das pautas abertas, na ordem dos grupos da visão por prazo. */
export const OPEN_DUE_STATUSES: DueStatus[] = [
  'overdue',
  'today',
  'next-7-days',
  'later',
  'no-due-date',
];

/** Filtros rápidos na ordem dos chips, com o rótulo de cada um. */
export const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'next-7-days', label: 'Próximos 7 dias' },
  { value: 'completed', label: 'Concluídas' },
];

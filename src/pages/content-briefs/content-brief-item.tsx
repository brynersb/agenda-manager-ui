import { AvatarInitial } from '@/components/ui/avatar-initial';
import { Tag } from '@/components/ui/tag';
import { formatDueDate, relativeText } from '@/lib/due-date';
import { ACTION_LABEL, CHANNEL_LABEL } from '@/lib/labels';
import type {
  ContentBriefResponse,
  ContentBriefStatus,
} from '@/types/content-brief';
import { StatusSelect } from './status-select';

/** `list`: linha de grupo por prazo; `card`: cartão do quadro por status. */
export type ContentBriefItemVariant = 'list' | 'card';

interface ContentBriefItemProps {
  brief: ContentBriefResponse;
  variant: ContentBriefItemVariant;
  /** Data de referência da API (`ContentBriefSummary.today`), para o ano do prazo. */
  today?: string;
  canWrite: boolean;
  onOpen: (id: string) => void;
  onChangeStatus: (
    brief: ContentBriefResponse,
    status: ContentBriefStatus,
  ) => void;
}

const BASE = 'relative grid items-start gap-x-3 gap-y-2';

/**
 * Classes por variante. Na lista, a partir de 720 px o item vira a grade
 * "prazo | corpo | status"; abaixo disso (e sempre no cartão) empilha:
 * prazo e status na primeira linha, corpo na segunda.
 */
const VARIANT_CLASSES: Record<ContentBriefItemVariant, string> = {
  list: 'grid-cols-[minmax(0,1fr)_auto] p-4 hover:bg-hover min-[720px]:grid-cols-[9rem_minmax(0,1fr)_auto] min-[720px]:gap-x-4 min-[720px]:px-5 min-[720px]:py-4',
  card: 'grid-cols-[minmax(0,1fr)_auto] rounded-card border border-line bg-surface p-4 [box-shadow:var(--elev-card)] hover:border-line-strong hover:bg-hover',
};

const DUE_DATE_LIST =
  'min-[720px]:col-start-1 min-[720px]:row-start-1 min-[720px]:flex-col min-[720px]:items-start min-[720px]:gap-1';
const BODY_LIST =
  'min-[720px]:col-span-1 min-[720px]:col-start-2 min-[720px]:row-start-1';
const STATUS_LIST =
  'min-[720px]:col-start-3 min-[720px]:row-start-1 min-[720px]:self-center';

/**
 * Uma pauta, na lista por prazo ou no quadro por status.
 *
 * O título é o botão que abre o editor (`?brief=<id>`) e seu `::after` cobre o
 * item inteiro, então o cartão todo é clicável; o seletor de status fica acima
 * (`z-[1]`) para continuar clicável. Situação e prazo relativo vêm da API: o
 * item só formata. Pauta concluída fica em `muted` e some o prazo relativo.
 *
 * @param props.brief Dados da pauta.
 * @param props.variant Layout (`list` ou `card`).
 * @param props.today Data de referência para decidir se o prazo mostra o ano.
 * @param props.canWrite Habilita a troca de status.
 * @param props.onOpen Abre o editor da pauta.
 * @param props.onChangeStatus Troca o status da pauta.
 * @returns O item.
 */
export function ContentBriefItem({
  brief,
  variant,
  today,
  canWrite,
  onOpen,
  onChangeStatus,
}: ContentBriefItemProps) {
  const isList = variant === 'list';
  const completed = brief.status === 'DONE';
  const overdue = brief.dueStatus === 'overdue' && !completed;
  const days = brief.daysUntilDue;

  return (
    <article className={`${BASE} ${VARIANT_CLASSES[variant]}`}>
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium font-mono text-[13px] leading-[1.3] ${overdue ? 'text-late' : 'text-muted'} ${isList ? DUE_DATE_LIST : ''}`}
      >
        {brief.dueDate === null ? (
          <span>Sem prazo</span>
        ) : (
          <>
            <span>{formatDueDate(brief.dueDate, today)}</span>
            {!completed && days !== null && (
              <span
                className={
                  brief.dueStatus === 'today'
                    ? 'rounded-sm bg-hl px-1.5 py-px font-semibold text-hl-ink'
                    : overdue
                      ? 'font-semibold'
                      : ''
                }
              >
                {relativeText(days)}
              </span>
            )}
          </>
        )}
      </div>

      <div className={`justify-self-end ${isList ? STATUS_LIST : ''}`}>
        <StatusSelect
          briefId={brief.id}
          title={brief.title}
          status={brief.status}
          disabled={!canWrite}
          onChange={(status) => onChangeStatus(brief, status)}
        />
      </div>

      <div className={`col-span-2 min-w-0 ${isList ? BODY_LIST : ''}`}>
        {brief.estateDevelopment && (
          <p
            className={`m-0 mb-[3px] break-words font-medium font-mono text-[11px] uppercase leading-[1.3] tracking-[0.08em] ${completed ? 'text-muted' : 'text-accent'}`}
          >
            {brief.estateDevelopment.name}
            {!brief.estateDevelopment.active && ' (arquivado)'}
          </p>
        )}
        <h3 className="m-0 font-[inherit]">
          <button
            type="button"
            onClick={() => onOpen(brief.id)}
            className={`m-0 cursor-pointer break-words border-0 bg-transparent p-0 text-left font-bold font-display text-base leading-[1.3] tracking-[-0.01em] after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent focus-visible:after:-outline-offset-2 ${completed ? 'text-muted' : 'text-ink'}`}
          >
            {brief.title}
          </button>
        </h3>
        {brief.description && (
          <p className="m-0 mt-1 line-clamp-2 break-words text-muted">
            {brief.description}
          </p>
        )}
        <Meta brief={brief} />
      </div>
    </article>
  );
}

function Meta({ brief }: { brief: ContentBriefResponse }) {
  const { owner, action, channel } = brief;
  if (!owner && !action && !channel) return null;

  return (
    <div className="mt-[9px] flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {owner && (
        <span className="inline-flex min-w-0 items-center gap-1.5 break-words font-medium text-[13px]">
          <AvatarInitial name={owner.name} />
          {owner.name}
          {!owner.active && ' (arquivado)'}
        </span>
      )}
      {action && <Tag variant="action">{ACTION_LABEL[action]}</Tag>}
      {channel && <Tag>{CHANNEL_LABEL[channel]}</Tag>}
    </div>
  );
}

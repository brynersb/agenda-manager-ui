import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useAuthContext } from '@/auth/use-auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Toast } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { USERS_PAGE_SIZE, useUsers } from '@/hooks/use-users';
import { USER_STATUS_FILTERS } from '@/lib/labels';
import { QueryError } from '@/pages/content-briefs/query-error';
import type { User, UserStatusFilter } from '@/types/user';
import { TemporaryPasswordDialog } from './temporary-password-dialog';
import {
  type ConfirmableUserAction,
  UserActionModal,
  type UserActionResult,
} from './user-action-modal';
import { UserFormDialog, type UserFormResult } from './user-form-dialog';
import type { UserAction } from './user-row-actions';
import { UserTable } from './user-table';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_LENGTH = 100;

/** Janela aberta sobre a lista; no máximo uma por vez. */
type OpenDialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: User }
  | { kind: 'confirm'; action: ConfirmableUserAction; user: User }
  | {
      kind: 'password';
      user: User;
      password: string;
      reason: 'created' | 'reset';
    };

/**
 * Devolve o foco ao botão "Ações" da linha depois de fechar uma janela aberta
 * pelo menu: o item do menu já saiu da tela e o foco cairia no `body`.
 */
function focusRowActions(userId: string | undefined) {
  if (!userId) return;
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`[data-user-actions="${userId}"]`)
      ?.focus();
  });
}

/**
 * Administração de usuários (`/users`).
 *
 * Com `user:read` lista os usuários (busca por nome ou e-mail, filtro de
 * situação, paginação) com papel, situação, último acesso e bloqueio. Com
 * `user:write` oferece também Novo usuário, Editar, Desativar/Reativar e
 * Redefinir senha; sem ela a página é só leitura. A senha provisória de um
 * cadastro ou redefinição aparece uma única vez, num diálogo. A linha da
 * pessoa logada não oferece desativar nem trocar o próprio papel.
 *
 * @returns A página de usuários.
 */
export function UsersPage() {
  const { hasPermission, userId } = useAuthContext();
  const canWrite = hasPermission('user:write');
  const canReadContentBriefs = hasPermission('content-brief:read');

  const [text, setText] = useState('');
  const [q, setQ] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<UserStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const { toast, show, dismiss } = useToast();

  useEffect(() => {
    const term = text.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
    if (term === q) return;
    const timeout = setTimeout(() => {
      setQ(term);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [text, q]);

  const query = useUsers({ q, status, page });
  const data = query.data;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / USERS_PAGE_SIZE))
    : 1;

  // Desativar o último item de uma página (com o filtro "Ativos") a deixa
  // vazia; volta para a última que ainda tem usuários.
  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const filtered = q !== undefined || status !== 'ALL';

  function clearFilters() {
    setText('');
    setQ(undefined);
    setStatus('ALL');
    setPage(1);
  }

  function handleRowAction(action: UserAction, user: User) {
    setDialog(
      action === 'edit'
        ? { kind: 'edit', user }
        : { kind: 'confirm', action, user },
    );
  }

  function closeDialog() {
    const user = dialog && 'user' in dialog ? dialog.user : undefined;
    setDialog(null);
    focusRowActions(user?.id);
  }

  function handleFormSaved(saved: UserFormResult) {
    if (saved.kind === 'created') {
      const { user, temporaryPassword } = saved.result;
      if (temporaryPassword) {
        setDialog({
          kind: 'password',
          user,
          password: temporaryPassword,
          reason: 'created',
        });
      } else {
        setDialog(null);
        show('success', 'Usuário criado');
      }
      return;
    }
    setDialog(null);
    show('success', 'Usuário atualizado');
    focusRowActions(saved.user.id);
  }

  function handleActionDone(done: UserActionResult) {
    if (done.action === 'reset') {
      const { user, temporaryPassword } = done.result;
      setDialog(
        temporaryPassword
          ? {
              kind: 'password',
              user,
              password: temporaryPassword,
              reason: 'reset',
            }
          : null,
      );
      return;
    }
    setDialog(null);
    show(
      'success',
      done.action === 'deactivate' ? 'Usuário desativado' : 'Usuário reativado',
    );
    focusRowActions(done.user.id);
  }

  function renderContent() {
    if (query.isError && !data) {
      return (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      );
    }
    if (!data) {
      return (
        <p role="status" className="text-muted">
          Carregando usuários…
        </p>
      );
    }
    if (data.total === 0 && filtered) {
      return (
        <EmptyState
          title="Nenhum usuário encontrado"
          description="Nada corresponde à busca ou ao filtro atual."
          actions={
            <Button variant="secondary" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      );
    }
    if (data.total === 0) {
      return (
        <EmptyState
          title="Nenhum usuário cadastrado"
          description="Cadastre a primeira pessoa com nome, e-mail e papel."
          actions={
            canWrite && (
              <Button onClick={() => setDialog({ kind: 'create' })}>
                Novo usuário
              </Button>
            )
          }
        />
      );
    }

    return (
      <div
        aria-busy={query.isPlaceholderData || undefined}
        className={query.isPlaceholderData ? 'opacity-60' : undefined}
      >
        {query.isError && (
          <div className="mb-3">
            <QueryError
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          </div>
        )}
        <UserTable
          users={data.data}
          currentUserId={userId}
          canWrite={canWrite}
          onAction={handleRowAction}
        />
        <nav
          aria-label="Paginação"
          className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="text-muted">
            {data.total === 1 ? '1 usuário' : `${data.total} usuários`}
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {canReadContentBriefs && (
            <Link
              to="/content-briefs"
              className="mb-2 inline-block text-muted text-sm underline underline-offset-2 hover:text-ink"
            >
              ← Voltar para as pautas
            </Link>
          )}
          <h1 className="m-0 font-display font-extrabold text-[clamp(28px,5vw,40px)] leading-[1.05] tracking-[-0.03em]">
            Usuários
          </h1>
          <p className="m-0 mt-1.5 text-muted">
            {canWrite
              ? 'Quem acessa a pauta, com qual papel e em que situação.'
              : 'Quem acessa a pauta. Só administradores com permissão de escrita alteram usuários.'}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setDialog({ kind: 'create' })}>
            + Novo usuário
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          aria-label="Buscar usuário"
          placeholder="Buscar por nome ou e-mail"
          autoComplete="off"
          maxLength={SEARCH_MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-[38px] w-[260px] min-w-0 max-w-full rounded-lg border border-line-strong bg-surface px-3 text-ink text-sm placeholder:text-muted focus:outline-2 focus:outline-accent focus:outline-offset-2"
        />
        <SegmentedControl
          label="Situação"
          options={USER_STATUS_FILTERS}
          value={status}
          onChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
        />
      </div>

      {renderContent()}

      {canWrite && dialog?.kind === 'create' && (
        <UserFormDialog
          user={null}
          currentUserId={userId}
          onClose={closeDialog}
          onSaved={handleFormSaved}
        />
      )}
      {canWrite && dialog?.kind === 'edit' && (
        <UserFormDialog
          key={dialog.user.id}
          user={dialog.user}
          currentUserId={userId}
          onClose={closeDialog}
          onSaved={handleFormSaved}
        />
      )}
      {canWrite && dialog?.kind === 'confirm' && (
        <UserActionModal
          action={dialog.action}
          user={dialog.user}
          onClose={closeDialog}
          onDone={handleActionDone}
        />
      )}
      {dialog?.kind === 'password' && (
        <TemporaryPasswordDialog
          user={dialog.user}
          password={dialog.password}
          reason={dialog.reason}
          onClose={closeDialog}
        />
      )}
      {toast && <Toast {...toast} onClose={dismiss} />}
    </>
  );
}

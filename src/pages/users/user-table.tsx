import { formatDateTime, formatTime } from '@/lib/date';
import { ROLE_LABEL } from '@/lib/labels';
import type { User } from '@/types/user';
import { type UserAction, UserRowActions } from './user-row-actions';
import { UserStatusPill } from './user-status-pill';

const HEADER_CLASS =
  'px-4 py-2.5 font-medium font-mono text-muted text-xs uppercase tracking-[0.08em]';

const CELL_CLASS = 'px-4 py-3 align-middle max-md:p-0';

/**
 * Diz se a conta está bloqueada por tentativas: só enquanto `lockedUntil` é
 * futuro (passada, a conta já destravou sozinha).
 *
 * @param user Usuário a conferir.
 * @param now Instante de referência em ms; padrão agora.
 * @returns `true` se ainda há bloqueio.
 */
export function isLocked(user: User, now: number = Date.now()): boolean {
  return (
    user.lockedUntil !== null && new Date(user.lockedUntil).getTime() > now
  );
}

interface UserTableProps {
  users: User[];
  /** Id da pessoa logada, para marcar e proteger a própria linha. */
  currentUserId: string;
  /** `user:write`: mostra o menu de ações. Sem ele a tabela é só leitura. */
  canWrite: boolean;
  onAction: (action: UserAction, user: User) => void;
}

/** Rótulo visível só no cartão empilhado (a coluna tem cabeçalho em `md+`). */
function MobileLabel({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="mr-1 text-muted text-xs md:hidden">
      {children}
    </span>
  );
}

/**
 * Lista de usuários: tabela em telas largas, cartões empilhados em telas
 * estreitas (375 px sem rolagem horizontal), com a mesma marcação.
 *
 * Abaixo de `md` os elementos da tabela passam a `display: block`/`flex` e o
 * cabeçalho fica só para leitores de tela; os rótulos "Papel:" e "Último
 * acesso:" aparecem dentro de cada cartão.
 *
 * @param props.users Usuários da página.
 * @param props.currentUserId Id de quem está logado.
 * @param props.canWrite Mostra as ações.
 * @param props.onAction Recebe a ação escolhida numa linha.
 * @returns A tabela.
 */
export function UserTable({
  users,
  currentUserId,
  canWrite,
  onAction,
}: UserTableProps) {
  const now = Date.now();

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-left max-md:block">
        <caption className="sr-only">Usuários</caption>
        <thead className="max-md:sr-only">
          <tr className="border-line border-b bg-hover">
            <th scope="col" className={HEADER_CLASS}>
              Nome
            </th>
            <th scope="col" className={HEADER_CLASS}>
              E-mail
            </th>
            <th scope="col" className={HEADER_CLASS}>
              Papel
            </th>
            <th scope="col" className={HEADER_CLASS}>
              Situação
            </th>
            <th scope="col" className={HEADER_CLASS}>
              Último acesso
            </th>
            <th scope="col" className={HEADER_CLASS}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr
                key={user.id}
                className="border-line border-b last:border-b-0 max-md:flex max-md:flex-col max-md:gap-1.5 max-md:px-4 max-md:py-3"
              >
                <td className={`${CELL_CLASS} min-w-0`}>
                  <span className="break-words font-semibold">{user.name}</span>
                  {isSelf && (
                    <span className="ml-2 rounded-full border border-line-strong px-2 py-0.5 text-muted text-xs">
                      Você
                    </span>
                  )}
                </td>
                <td
                  className={`${CELL_CLASS} min-w-0 break-all text-muted text-sm`}
                >
                  {user.email}
                </td>
                <td className={`${CELL_CLASS} text-sm`}>
                  <MobileLabel>Papel:</MobileLabel>
                  {ROLE_LABEL[user.role]}
                </td>
                <td className={CELL_CLASS}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <UserStatusPill status={user.status} />
                    {isLocked(user, now) && user.lockedUntil && (
                      <span className="inline-flex min-h-[26px] items-center rounded-full border border-late bg-late-bg px-2.5 font-semibold text-late text-xs leading-none">
                        Bloqueado até {formatTime(user.lockedUntil)}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`${CELL_CLASS} text-muted text-sm`}>
                  <MobileLabel>Último acesso:</MobileLabel>
                  {user.lastLoginAt
                    ? formatDateTime(user.lastLoginAt)
                    : 'Nunca acessou'}
                </td>
                <td className={`${CELL_CLASS} md:text-right`}>
                  {canWrite && (
                    <UserRowActions
                      user={user}
                      isSelf={isSelf}
                      onAction={onAction}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

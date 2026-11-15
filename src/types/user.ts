import type { Role } from '@/types/auth';

/** Situação do cadastro do usuário; ninguém é apagado, só desativado. */
export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

/** Quem criou ou alterou o usuário (o nome é um retrato do momento). */
export interface UserAuditor {
  id: string;
  name: string;
}

/** Usuário como devolvido por `GET /users` (`docs/auth.md`, §5.1). */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  /** `true` enquanto o usuário usa senha provisória. */
  mustChangePassword: boolean;
  /** Fim do bloqueio por tentativas; só bloqueia se a data é futura. */
  lockedUntil: string | null;
  lastLoginAt: string | null;
  /** Controle de concorrência: vai de volta no `PATCH`. */
  version: number;
  createdAt: string;
  createdBy: UserAuditor | null;
  updatedAt: string;
  updatedBy: UserAuditor | null;
}

/** Filtro de situação da lista; `ALL` não manda `status` à API. */
export type UserStatusFilter = 'ALL' | UserStatus;

/** Resposta de `POST /users` e `POST /users/:id/reset-password`. */
export interface UserWithTemporaryPassword {
  user: User;
  /** Só existe nesta resposta; `null` quando a senha foi digitada. */
  temporaryPassword: string | null;
}

/** Corpo de `POST /users`. */
export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  /** Opcional (10 a 128 caracteres); sem ela a API gera uma provisória. */
  password?: string;
}

/** Corpo de `PATCH /users/:id`. */
export interface UpdateUserInput {
  name?: string;
  role?: Role;
  version: number;
}

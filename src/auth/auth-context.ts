import { createContext } from 'react';

import type { Permission, Role } from '@/types/auth';

/** Valor do contexto de autenticação (ver `useAuthContext`). */
export interface AuthContextValue {
  userId: string;
  email: string;
  name: string;
  /** Papel da pessoa; serve só de rótulo, o acesso vem de `permissions`. */
  role: Role | null;
  permissions: Permission[];
  /** `true` enquanto a senha é provisória: só a troca de senha é liberada. */
  mustChangePassword: boolean;
  isAuthenticated: boolean;
  /** Restaurando a sessão (renovando o token vencido ao abrir a página). */
  isLoading: boolean;
  /** Reconferindo identidade e permissões em `/auth/user-info`. */
  isLoadingPermissions: boolean;
  permissionsError: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

/** Contexto preenchido pelo `AuthProvider`. */
export const AuthContext = createContext<AuthContextValue | null>(null);

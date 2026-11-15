import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/auth/auth-context';

/**
 * Contexto de autenticação e autorização da aplicação.
 *
 * Telas e guardas decidem acesso só por `hasPermission` (as permissões vêm da
 * API); nunca por papel.
 *
 * @returns Identidade, permissões, estados de carregamento e ações de
 * entrar, sair e trocar a senha.
 * @throws Error se usado fora do `AuthProvider`.
 */
export function useAuthContext(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuthContext precisa estar dentro do AuthProvider.');
  }
  return value;
}

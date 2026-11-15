import type { KyInstance } from 'ky';
import { useMemo } from 'react';

import {
  endSession,
  getFreshAccessToken,
  markPasswordChangeRequired,
  renewAfterUnauthorized,
} from '@/auth/session-store';
import { createApi } from '@/lib/http';

export { createApi, ForbiddenApiError, UnauthorizedApiError } from '@/lib/http';

/**
 * Cria o cliente HTTP ligado à sessão do app.
 *
 * Lê o access token da sessão (renovando-o antes se estiver para vencer),
 * resolve o 401 com uma renovação em voo único (`refreshSession`) e repete a
 * chamada uma vez. Se a sessão não tem mais como continuar, encerra a sessão:
 * limpa o storage e o cache, e as rotas protegidas levam a `/login` (sem limpar
 * o storage haveria laço entre `/login` e a rota protegida). O `403
 * PASSWORD_CHANGE_REQUIRED` marca a senha provisória como pendente, e as rotas
 * levam à troca de senha.
 *
 * @returns A instância do `ky` com o token da sessão atual.
 */
export function createSessionApi(): KyInstance {
  return createApi(getFreshAccessToken, {
    renewToken: renewAfterUnauthorized,
    onSessionExpired: () => endSession('expired'),
    onPasswordChangeRequired: markPasswordChangeRequired,
  });
}

/**
 * Cliente HTTP autenticado para componentes e hooks.
 *
 * A instância é estável entre renders; o token e a renovação vêm da sessão, não
 * do React, então várias instâncias compartilham o mesmo voo de refresh.
 *
 * @returns A instância do `ky` com o token da sessão atual.
 */
export function useApi(): KyInstance {
  return useMemo(createSessionApi, []);
}

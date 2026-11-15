import { afterEach, describe, expect, it, vi } from 'vitest';

import { toSession } from '@/auth/session-store';
import { authResponse } from '@/test/auth-fixtures';
import {
  readSessionNotice,
  readStoredSession,
  SESSION_KEY,
  writeSessionNotice,
  writeStoredSession,
} from './session-storage';

describe('session-storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it('grava e lê a sessão sem perder nenhum campo', () => {
    const sessao = toSession(authResponse(), 5_000);

    writeStoredSession(sessao);

    expect(readStoredSession()).toEqual(sessao);
  });

  it('apagar com null remove a chave', () => {
    writeStoredSession(toSession(authResponse()));

    writeStoredSession(null);

    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it.each([
    ['JSON inválido', '{nao-e-json'],
    ['valor que não é objeto', '42'],
    ['sem refresh token', JSON.stringify({ accessToken: 'a' })],
    [
      'papel desconhecido',
      JSON.stringify({
        ...toSession(authResponse()),
        user: { ...authResponse().user, role: 'superuser' },
      }),
    ],
  ])('trata %s como "sem sessão", sem quebrar', (_caso, bruto) => {
    window.sessionStorage.setItem(SESSION_KEY, bruto);

    expect(readStoredSession()).toBeNull();
  });

  it('com o storage bloqueado, ler devolve null e gravar não lança', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError');
    });

    expect(readStoredSession()).toBeNull();
    expect(() => writeStoredSession(toSession(authResponse()))).not.toThrow();
    expect(readSessionNotice()).toBeNull();
    expect(() => writeSessionNotice('expired')).not.toThrow();
  });

  it('o aviso de sessão expirada vai e volta pelo storage', () => {
    expect(readSessionNotice()).toBeNull();

    writeSessionNotice('expired');
    expect(readSessionNotice()).toBe('expired');

    writeSessionNotice(null);
    expect(readSessionNotice()).toBeNull();
  });
});

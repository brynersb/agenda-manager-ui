import { render } from '@testing-library/react';
import { useAuth } from 'react-oidc-context';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-oidc-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
}));

vi.mock('@/lib/query-client', () => ({
  clearSession: vi.fn(),
}));

import { clearSession } from '@/lib/query-client';
import { AuthProvider } from './auth-provider';

const mockUseAuth = useAuth as Mock;
const mockClearSession = clearSession as Mock;

function setupAuthEvents() {
  const listeners: Record<string, () => void> = {};

  mockUseAuth.mockReturnValue({
    events: {
      addUserUnloaded: (cb: () => void) => {
        listeners.userUnloaded = cb;
        return () => {
          delete listeners.userUnloaded;
        };
      },
      addUserSignedOut: (cb: () => void) => {
        listeners.userSignedOut = cb;
        return () => {
          delete listeners.userSignedOut;
        };
      },
    },
  });

  return listeners;
}

describe('<AuthProvider /> — SessionCacheSync', () => {
  beforeEach(() => {
    mockClearSession.mockClear();
  });

  it('limpa o cache do TanStack Query quando o usuário OIDC é descarregado', () => {
    const listeners = setupAuthEvents();

    render(
      <AuthProvider>
        <div>App</div>
      </AuthProvider>,
    );

    expect(mockClearSession).not.toHaveBeenCalled();

    listeners.userUnloaded();

    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('limpa o cache quando o provedor avisa que a sessão foi encerrada', () => {
    const listeners = setupAuthEvents();

    render(
      <AuthProvider>
        <div>App</div>
      </AuthProvider>,
    );

    listeners.userSignedOut();

    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });
});

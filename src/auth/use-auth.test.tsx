import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuthContext } from './use-auth';

describe('useAuthContext', () => {
  it('avisa quando usado fora do AuthProvider, em vez de fingir que não há sessão', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuthContext())).toThrow(
      'useAuthContext precisa estar dentro do AuthProvider.',
    );
  });
});

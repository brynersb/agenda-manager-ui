import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from './use-toast';

describe('useToast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('começa sem toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('exibe o toast e o fecha sozinho depois de 4 s', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.show('success', 'Pauta salva'));
    expect(result.current.toast?.title).toBe('Pauta salva');

    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it('mantém o toast com ação por 10 s para dar tempo de decidir', () => {
    const { result } = renderHook(() => useToast());

    act(() =>
      result.current.show('error', 'Falhou', undefined, {
        label: 'Tentar de novo',
        onClick: vi.fn(),
      }),
    );

    act(() => vi.advanceTimersByTime(9999));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it('fecha antes do tempo com dismiss', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.show('success', 'Oi'));
    act(() => result.current.dismiss());

    expect(result.current.toast).toBeNull();
  });
});

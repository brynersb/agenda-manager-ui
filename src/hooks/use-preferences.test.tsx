import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APPEARANCE_KEY,
  DEFAULT_PREFERENCES,
  defaultAppearance,
  PREFERENCES_KEY,
  readAppearance,
  readPreferences,
  useAppearance,
  usePreferences,
} from './use-preferences';

describe('preferências de tela', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('usa o padrão quando nada foi salvo', () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('lê visão e filtro salvos', () => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ view: 'status', dueStatus: 'overdue' }),
    );
    expect(readPreferences()).toEqual({
      view: 'status',
      dueStatus: 'overdue',
    });
  });

  it('ignora JSON inválido e valores desconhecidos, campo a campo', () => {
    window.localStorage.setItem(PREFERENCES_KEY, '{quebrado');
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);

    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ view: 'kanban', dueStatus: 'next-7-days' }),
    );
    expect(readPreferences()).toEqual({
      view: 'dueDate',
      dueStatus: 'next-7-days',
    });
  });

  it('salva só preferências de tela, sem dado de pauta', () => {
    const { result } = renderHook(() => usePreferences());

    act(() => result.current.save({ view: 'status' }));
    act(() => result.current.save({ dueStatus: 'completed' }));

    expect(result.current.preferences).toEqual({
      view: 'status',
      dueStatus: 'completed',
    });
    expect(
      JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? '{}'),
    ).toEqual({ view: 'status', dueStatus: 'completed' });
  });

  it('funciona com o localStorage lançando exceção', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    const { result } = renderHook(() => usePreferences());
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);

    act(() => result.current.save({ view: 'status' }));
    expect(result.current.preferences.view).toBe('status');
  });
});

describe('aparência (tema e forma dos formulários)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-ui-theme');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('usa tema suave e modal quando nada foi salvo nem configurado', () => {
    expect(readAppearance()).toEqual({
      uiTheme: 'soft',
      formPresentation: 'modal',
    });
  });

  it('o ambiente define o padrão (VITE_UI_THEME e VITE_FORM_PRESENTATION)', () => {
    vi.stubEnv('VITE_UI_THEME', 'classic');
    vi.stubEnv('VITE_FORM_PRESENTATION', 'drawer');

    expect(defaultAppearance()).toEqual({
      uiTheme: 'classic',
      formPresentation: 'drawer',
    });
  });

  it('valor de ambiente desconhecido cai no padrão', () => {
    vi.stubEnv('VITE_UI_THEME', 'neon');
    vi.stubEnv('VITE_FORM_PRESENTATION', 'tela-cheia');

    expect(defaultAppearance()).toEqual({
      uiTheme: 'soft',
      formPresentation: 'modal',
    });
  });

  it('a escolha salva vence o ambiente, campo a campo', () => {
    vi.stubEnv('VITE_UI_THEME', 'classic');
    window.localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify({ uiTheme: 'soft', formPresentation: 'inexistente' }),
    );

    expect(readAppearance()).toEqual({
      uiTheme: 'soft',
      formPresentation: 'modal',
    });
  });

  it('ignora JSON inválido no storage', () => {
    window.localStorage.setItem(APPEARANCE_KEY, '{quebrado');

    expect(readAppearance()).toEqual(defaultAppearance());
  });

  it('trocar o tema aplica data-ui-theme no <html> e persiste', () => {
    const { result } = renderHook(() => useAppearance());
    expect(document.documentElement.dataset.uiTheme).toBe('soft');

    act(() => result.current.setAppearance({ uiTheme: 'classic' }));

    expect(result.current.appearance.uiTheme).toBe('classic');
    expect(document.documentElement.dataset.uiTheme).toBe('classic');
    expect(
      JSON.parse(window.localStorage.getItem(APPEARANCE_KEY) ?? '{}'),
    ).toEqual({ uiTheme: 'classic', formPresentation: 'modal' });
  });

  it('trocar a forma dos formulários persiste sem mexer no tema', () => {
    const { result } = renderHook(() => useAppearance());

    act(() => result.current.setAppearance({ formPresentation: 'drawer' }));

    expect(result.current.appearance).toEqual({
      uiTheme: 'soft',
      formPresentation: 'drawer',
    });
    expect(readAppearance().formPresentation).toBe('drawer');
  });

  it('uma troca avisa os outros usos do hook ao mesmo tempo', () => {
    const menu = renderHook(() => useAppearance());
    const formulario = renderHook(() => useAppearance());

    act(() =>
      menu.result.current.setAppearance({ formPresentation: 'drawer' }),
    );

    expect(formulario.result.current.appearance.formPresentation).toBe(
      'drawer',
    );
  });

  it('não persiste a aparência junto das preferências de tela', () => {
    const { result } = renderHook(() => useAppearance());

    act(() => result.current.setAppearance({ uiTheme: 'classic' }));

    expect(window.localStorage.getItem(PREFERENCES_KEY)).toBeNull();
  });

  it('funciona com o localStorage lançando exceção', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    const { result } = renderHook(() => useAppearance());
    expect(result.current.appearance).toEqual(defaultAppearance());

    act(() => result.current.setAppearance({ uiTheme: 'classic' }));
    expect(result.current.appearance.uiTheme).toBe('classic');
    expect(document.documentElement.dataset.uiTheme).toBe('classic');
    vi.restoreAllMocks();
  });
});

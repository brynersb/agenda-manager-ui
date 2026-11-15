import { useCallback, useEffect, useRef, useState } from 'react';

import type { QuickFilter, ViewMode } from '@/types/content-brief';

/** Preferências de tela lembradas entre sessões (nunca dado de pauta). */
export interface Preferences {
  view: ViewMode;
  dueStatus: QuickFilter;
}

/** Chave do `localStorage`; o sufixo de versão permite mudar o formato. */
export const PREFERENCES_KEY = 'pauta-mkt:preferences:v1';

/** Padrão quando não há preferência salva nem parâmetro na URL. */
export const DEFAULT_PREFERENCES: Preferences = {
  view: 'dueDate',
  dueStatus: 'all',
};

const VIEWS: ViewMode[] = ['dueDate', 'status'];
const QUICK_FILTER_VALUES: QuickFilter[] = [
  'all',
  'overdue',
  'next-7-days',
  'completed',
];

/**
 * Lê as preferências salvas, tolerando storage indisponível, JSON inválido e
 * valores desconhecidos (cada campo cai no padrão sozinho).
 *
 * @returns As preferências válidas, completando com o padrão o que faltar.
 */
export function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) {
      return DEFAULT_PREFERENCES;
    }
    const { view, dueStatus } = data as Record<string, unknown>;
    return {
      view: VIEWS.includes(view as ViewMode)
        ? (view as ViewMode)
        : DEFAULT_PREFERENCES.view,
      dueStatus: QUICK_FILTER_VALUES.includes(dueStatus as QuickFilter)
        ? (dueStatus as QuickFilter)
        : DEFAULT_PREFERENCES.dueStatus,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Storage bloqueado ou cheio: a preferência só não persiste.
  }
}

/**
 * Preferências de visão e filtro rápido, guardadas em `localStorage`.
 *
 * Servem de padrão quando a URL não traz `view`/`dueStatus`. A leitura acontece
 * uma vez, na montagem: a URL é a fonte da verdade durante a sessão.
 *
 * @returns `preferences` lidas e `save` para atualizar parte delas.
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const current = useRef(preferences);

  const save = useCallback((partial: Partial<Preferences>) => {
    current.current = { ...current.current, ...partial };
    writePreferences(current.current);
    setPreferences(current.current);
  }, []);

  return { preferences, save };
}

/** Tema visual: `classic` é o visual original; `soft` é o mais leve. */
export type UiTheme = 'classic' | 'soft';

/** Como os formulários abrem: janela central ou painel lateral direito. */
export type FormPresentation = 'modal' | 'drawer';

/** Aparência escolhida pela pessoa no menu do usuário. */
export interface Appearance {
  uiTheme: UiTheme;
  formPresentation: FormPresentation;
}

/** Chave do `localStorage` da aparência (separada das preferências de tela). */
export const APPEARANCE_KEY = 'pauta-mkt:appearance:v1';

/** Evento que mantém todos os `useAppearance` montados em sincronia. */
const APPEARANCE_EVENT = 'pauta-mkt:appearance-change';

/** Temas aceitos, usados na validação de storage e de variável de ambiente. */
export const UI_THEMES: readonly UiTheme[] = ['classic', 'soft'];

/** Formas de abrir formulário aceitas (validação de storage e de ambiente). */
export const FORM_PRESENTATIONS: readonly FormPresentation[] = [
  'modal',
  'drawer',
];

/**
 * Aparência padrão, vinda das variáveis `VITE_UI_THEME` e
 * `VITE_FORM_PRESENTATION`. Valor ausente ou desconhecido cai em `soft` e
 * `modal`. Lida a cada chamada (e não na carga do módulo) para que os testes
 * possam trocar o ambiente.
 *
 * @returns A aparência usada quando a pessoa ainda não escolheu.
 */
export function defaultAppearance(): Appearance {
  const theme = import.meta.env.VITE_UI_THEME;
  const presentation = import.meta.env.VITE_FORM_PRESENTATION;
  return {
    uiTheme: UI_THEMES.includes(theme as UiTheme) ? (theme as UiTheme) : 'soft',
    formPresentation: FORM_PRESENTATIONS.includes(
      presentation as FormPresentation,
    )
      ? (presentation as FormPresentation)
      : 'modal',
  };
}

/**
 * Lê a aparência salva, tolerando storage indisponível, JSON inválido e
 * valores desconhecidos (cada campo cai no padrão do ambiente sozinho).
 *
 * @returns A aparência válida, completando com o padrão o que faltar.
 */
export function readAppearance(): Appearance {
  const fallback = defaultAppearance();
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (typeof data !== 'object' || data === null) return fallback;
    const { uiTheme, formPresentation } = data as Record<string, unknown>;
    return {
      uiTheme: UI_THEMES.includes(uiTheme as UiTheme)
        ? (uiTheme as UiTheme)
        : fallback.uiTheme,
      formPresentation: FORM_PRESENTATIONS.includes(
        formPresentation as FormPresentation,
      )
        ? (formPresentation as FormPresentation)
        : fallback.formPresentation,
    };
  } catch {
    return fallback;
  }
}

/**
 * Aplica o tema no `<html>` (`data-ui-theme`), que é o que faz os tokens de
 * `index.css` valerem. Chamada na inicialização (antes do primeiro render, para
 * não piscar o tema errado) e a cada troca.
 *
 * @param theme Tema a aplicar.
 */
export function applyUiTheme(theme: UiTheme) {
  document.documentElement.setAttribute('data-ui-theme', theme);
}

function writeAppearance(appearance: Appearance) {
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    // Storage bloqueado ou cheio: a escolha vale só nesta sessão.
  }
}

/**
 * Aparência do app (tema e forma dos formulários), guardada em `localStorage`.
 *
 * Várias partes da tela usam o hook ao mesmo tempo (menu do usuário, painéis
 * de formulário): uma troca avisa as demais por um evento na `window`, sem
 * cache de módulo. O tema é aplicado no `<html>` sempre que muda.
 *
 * @returns `appearance` atual e `setAppearance` para trocar parte dela.
 */
export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);
  const current = useRef(appearance);

  useEffect(() => {
    const sync = (event: Event) => {
      current.current = (event as CustomEvent<Appearance>).detail;
      setAppearanceState(current.current);
    };
    window.addEventListener(APPEARANCE_EVENT, sync);
    return () => window.removeEventListener(APPEARANCE_EVENT, sync);
  }, []);

  useEffect(() => {
    applyUiTheme(appearance.uiTheme);
  }, [appearance.uiTheme]);

  const setAppearance = useCallback((partial: Partial<Appearance>) => {
    const next = { ...current.current, ...partial };
    writeAppearance(next);
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: next }));
  }, []);

  return { appearance, setAppearance };
}

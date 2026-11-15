/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API, com barra final (`.../api/v1/`): o `ky` exige. */
  readonly VITE_API_BASE_URL: string;
  /**
   * Tema visual padrão: `soft` (padrão) ou `classic` (visual original). A
   * escolha da pessoa no menu do usuário tem prioridade.
   */
  readonly VITE_UI_THEME?: 'classic' | 'soft';
  /**
   * Como os formulários abrem por padrão: `modal` (padrão) ou `drawer` (painel
   * lateral). A escolha da pessoa no menu do usuário tem prioridade.
   */
  readonly VITE_FORM_PRESENTATION?: 'modal' | 'drawer';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

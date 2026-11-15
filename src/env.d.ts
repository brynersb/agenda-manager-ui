/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do realm Keycloak (ex.: `http://localhost:8080/realms/bora`). */
  readonly VITE_OIDC_AUTHORITY: string;
  /** Client público do Authorization Code + PKCE. */
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_OIDC_POST_LOGOUT_REDIRECT_URI: string;
  readonly VITE_OIDC_SCOPE: string;
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

# Pauta de marketing Bora (UI)

Front da "Pauta de marketing Bora", uma POC local. Já tem design system,
autenticação (Keycloak), cliente HTTP, rotas, layout, painel de cadastros e a
tela `/content-briefs` (lista por prazo, quadro por status, filtros e troca de status)
com o editor de pauta e o painel de cadastros em modal (ou painel lateral, à
escolha; ver "Aparência e formulários").
Filtros e visão ficam na URL; só visão e filtro rápido são lembrados em
`localStorage`.

O editor abre por `?new=1` (só com `content-brief:write`) e `?brief=<id>` (link
compartilhável; sem `content-brief:write` fica somente leitura). Salvar é por `PUT`
com todos os campos e a `version` carregada: se outra pessoa salvou antes
(`409 CONTENT_BRIEF_VERSION_OUTDATED`), o painel mantém o texto digitado e oferece
"Ver versão atual". Excluir (`content-brief:delete`) pede dois cliques em 4 s, e fechar
com alterações pede confirmação.

## Stack

- **React 19** + **TypeScript 6**, empacotados com **Vite 7**
- **Tailwind CSS 4** (`@tailwindcss/vite`, tokens no `@theme` de `src/index.css`)
- **react-router 8**, **TanStack Query 5**, **ky**, **react-oidc-context** +
  **oidc-client-ts**
- **Radix UI** (dialog, dropdown-menu, popover, select, tooltip) e **lucide-react**
- Fontes self-hosted via `@fontsource` (Schibsted Grotesk, Public Sans, IBM Plex Mono)
- **Biome 2.5** para lint e formatação
- **Vitest 4** + **Testing Library** + jsdom

## Pré-requisitos

- **Node.js 26.13.1** (fixado em `.nvmrc`) e **npm**

```bash
nvm use
```

## Como rodar

```bash
npm ci
cp .env.example .env
npm run dev   # http://localhost:5173
```

O login precisa do Keycloak local (porta 8080, realm `bora`) e da API (porta
3000). Sem eles a tela de login abre, mas "Entrar" não conclui.

## Variáveis de ambiente

Copie `.env.example` para `.env` (o `.env` não é versionado). Sem segredos: o
client do Keycloak é público.

| Variável | Valor local |
| --- | --- |
| `VITE_OIDC_AUTHORITY` | `http://localhost:8080/realms/bora` |
| `VITE_OIDC_CLIENT_ID` | `pauta-mkt-ui` |
| `VITE_OIDC_REDIRECT_URI` | `http://localhost:5173/auth/callback` |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | `http://localhost:5173/login` |
| `VITE_OIDC_SCOPE` | `openid profile email` |
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1/` |

Variáveis opcionais de aparência (valores aceitos e efeito em "Aparência e
formulários"):

| Variável | Padrão | Valores |
| --- | --- | --- |
| `VITE_UI_THEME` | `soft` | `soft` ou `classic` |
| `VITE_FORM_PRESENTATION` | `modal` | `modal` ou `drawer` |

A `VITE_API_BASE_URL` precisa da barra final: o `ky` a usa como `prefix` e os
caminhos são escritos sem barra inicial (`api.get('content-briefs')`).

## Aparência e formulários

Dois temas visuais e duas formas de abrir formulário, todos reversíveis:

- **Tema:** `soft` (padrão: superfícies e bordas mais leves, sombras suaves,
  cantos maiores, fonte menos pesada, mesma matiz da marca) e `classic` (o
  visual original, sem nenhuma diferença). O tema vive no atributo
  `data-ui-theme` do `<html>`, que só troca variáveis CSS em `src/index.css`.
- **Formulários:** `modal` (padrão: janela centralizada; até 640 px vira uma
  folha colada na base) e `drawer` (o painel lateral original). Valem para o
  editor de pauta e para o painel de empreendimentos e responsáveis; a
  confirmação de saída, o aviso de conflito (409), Esc, clique fora e foco
  preso são os mesmos nos dois.

Como alternar:

1. **Pelo menu do usuário** (barra superior): "Aparência: Suave / Clássica" e
   "Formulários: Modal / Painel lateral". Vale na hora e fica salvo neste
   navegador (`localStorage`, chave `pauta-mkt:appearance:v1`).
2. **Pelo ambiente**, para definir o padrão de quem ainda não escolheu:
   `VITE_UI_THEME` e `VITE_FORM_PRESENTATION` (ver `.env.example`; são lidas no
   build, e o `Dockerfile` ainda não as repassa como `ARG`, então a imagem do
   Docker e a demonstração usam os padrões e a troca é pelo menu).
3. **Voltar ao original:** `VITE_UI_THEME=classic` e
   `VITE_FORM_PRESENTATION=drawer` (ou escolher "Clássica" e "Painel lateral"
   no menu). Detalhes e como a equivalência foi verificada em
   [`docs/appearance.md`](docs/appearance.md).

## Autenticação e autorização

- **Login:** Authorization Code + PKCE (`react-oidc-context`). O front envia o
  **access token**, nunca o id token. A sessão fica em `sessionStorage` (morre
  ao fechar a aba); nenhum token vai para `localStorage` nem para log.
- **Permissões:** vêm só de `GET /auth/user-info` (`permissions`). O front nunca
  mapeia papel para permissão; telas e guardas usam
  `useAuthContext().hasPermission(...)`. O papel do token (`realm_access.roles`)
  só aparece como rótulo no menu antes de a API responder.
- **Rotas:** `/login`, `/auth/callback`, `/no-permission` (públicas ou só com
  sessão), `/` redireciona para `/content-briefs`, que exige `content-brief:read`. Quem não tem
  nenhuma permissão vai para `/no-permission`; falha ao carregar
  `/auth/user-info` mostra uma tela de recarregar, nunca "sem permissão".
- **Erros 401 e 403:** no 401 o cliente renova o token (`signinSilent`) uma vez e
  repete a chamada. Se o 401 persistir, a sessão é encerrada: `removeUser`,
  cache limpo e `/login` (sem o `removeUser` haveria laço entre `/login` e a
  rota protegida). O 403 vira `ForbiddenApiError` e não encerra a sessão.
- **Mensagens de erro:** `getApiErrorMessage(error)` em `src/lib/api-error.ts`
  decide pelo `code` do corpo `{ statusCode, code, message, fields? }`, nunca
  por regex no texto. Sem conexão: "Sem conexão com o servidor. Suas alterações
  não foram salvas."
- **Testes:** `renderWithProviders` e `renderRoutes` (`src/test/`) montam
  TanStack Query e roteador em memória. Para simular a pessoa logada, o teste
  declara `vi.mock('@/auth/use-auth')` e passa `auth: { ... }` (valores padrão
  de editor em `createAuthMock`).

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Type-check (`tsc -b`) + build de produção |
| `npm run preview` | Serve localmente o build de produção |
| `npm run check` | Lint + formatação + organização de imports (Biome) |
| `npm run lint` | Apenas lint |
| `npm run format` | Formata os arquivos |
| `npm test` | Testes em modo watch |
| `npm run test:run` | Testes em execução única |
| `npm run coverage` | Testes com cobertura (v8) |
| `npm run demo:up` | Sobe a demonstração (Docker): build + serviços saudáveis |
| `npm run demo:down` | Para a demonstração sem apagar os dados |
| `npm run demo:seed` | Carrega as 6 pautas de exemplo (idempotente) |
| `npm run demo:backup` | Backup do banco da demonstração em `demo/backups/` |
| `npm run demo:restore -- <arquivo>` | Restaura um backup (pede confirmação) |
| `npm run demo:reset` | Apaga os dados e sobe do zero (pede confirmação) |
| `npm run demo:logs` | Segue os logs da API da demonstração |

## Modo demonstração

`npm run demo:up` sobe Postgres, Keycloak, API e UI já buildados no Docker (UI em
`http://localhost:5173`, Keycloak em `8081`, API em `3001`), com dados em volumes
que sobrevivem a reinícios; `demo:backup`, `demo:restore` e `demo:reset` cuidam de
backup e recomeço. Pare o `npm run dev` antes (a porta 5173 é a mesma). Passo a
passo, portas, usuários e o que apaga dados: [`docs/demo.md`](docs/demo.md).
Roteiro para a usuária validar o sistema:
[`docs/validation-script.md`](docs/validation-script.md). Roteiro de apresentação
do case (15 a 20 minutos): [`docs/presentation-script.md`](docs/presentation-script.md).

## Convenções

- Biome manda: aspas simples, ponto e vírgula, indentação de 2, largura 80 e
  `useSortedClasses` como erro. Rode `npm run check` antes de entregar.
- Componentes em `kebab-case.tsx`, export nomeado, sem `export default`; teste
  `.test.tsx` ao lado quando há estado ou regra.
- Texto de interface em pt-BR.
- Cores só por token (`bg-surface`, `text-muted`, `text-late`...). Hex só em
  `src/index.css`. Detalhes e tabela de tokens em `CLAUDE.md`.
- Tema escuro automático pela preferência do sistema; `data-theme="light"` ou
  `data-theme="dark"` na tag `<html>` força um dos dois. Não há toggle de
  claro/escuro no produto. O tema visual (`soft`/`classic`) é outro eixo, que
  combina com os dois (ver "Aparência e formulários").
- Layout deve funcionar em 375 px sem rolagem horizontal.

## Padrão de nomes (ADR-015)

Código em inglês; texto de tela em português. Pastas, arquivos, componentes, hooks,
tipos, props, rotas, campos de JSON da API, chaves de `localStorage`, papéis,
permissões e `code` de erro são em inglês. Continuam em pt-BR: rótulos, mensagens,
placeholders, títulos, comentários, JSDoc e descrições de teste. Em
`lib/labels.ts`, as chaves são em inglês e os valores exibidos em português.
Spec: `.docs/pauta-mkt/15-padrao-de-nomes.md` (§1 e §7).

## Logo

`src/assets/logo-bora.png` foi extraído do protótipo e é provisório. Trocar pelo
SVG oficial quando chegar (pendência P3 de `13-pendencias-externas.md`).

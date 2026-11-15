# Pauta de marketing Bora (UI)

Front da "Pauta de marketing Bora", uma POC local. Já tem design system,
autenticação própria da API (login por e-mail e senha), cliente HTTP, rotas,
layout, painel de cadastros, a tela `/content-briefs` (lista por prazo, quadro
por status, filtros e troca de status) com o editor de pauta e o painel de
cadastros em modal (ou painel lateral, à escolha; ver "Aparência e
formulários"), e a administração de usuários em `/users`.
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
- **react-router 8**, **TanStack Query 5**, **ky** (a autenticação é própria,
  sem biblioteca de login externa)
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

O login precisa da API local (porta 3000, ADR-016). Em desenvolvimento, rode o
`npm run seed:dev` da API para ter `dev.admin@pauta.local`,
`dev.editor@pauta.local` e `dev.leitor@pauta.local` (a senha só de
desenvolvimento está no README da API). Sem a API a tela de login abre, mas
"Entrar" mostra o erro de conexão.

## Variáveis de ambiente

Copie `.env.example` para `.env` (o `.env` não é versionado). Sem segredos.

| Variável | Valor local |
| --- | --- |
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

Contrato completo: `docs/auth.md` do repositório da API (ADR-016).

- **Login:** e-mail e senha em `/login` (`POST /auth/login`). A sessão
  `{ accessToken, refreshToken, expiresAt, user }` fica no `sessionStorage` (morre
  ao fechar a aba); nenhum token vai para `localStorage` nem para log. Ao
  recarregar, a sessão é restaurada e reconferida em `GET /auth/user-info`.
- **Renovação:** o access token (15 min) é renovado cerca de 60 s antes de vencer
  (com validade curta, 1/4 dela) e, num 401, uma única vez com repetição da
  chamada. A renovação é em **voo único** (`src/auth/session-store.ts`): todas as
  chamadas que precisam renovar ao mesmo tempo compartilham UMA ida a
  `POST /auth/refresh`, porque o refresh token é de uso único e reapresentar um
  já usado derruba a família de sessões. O refresh token novo é gravado antes de
  liberar quem esperava. Se a API recusa o refresh (401/403), a sessão é
  encerrada: storage e cache limpos e `/login` com o aviso "Sua sessão expirou".
  Falha de rede ou 5xx na renovação **não** derruba a sessão (a chamada falha
  com o erro de conexão e a renovação é tentada de novo).
- **Sair:** `POST /auth/logout` com o refresh token (a falha é ignorada) e limpeza
  total da sessão local, depois da confirmação do menu do usuário.
- **Senha provisória:** com `mustChangePassword` (login, refresh ou sessão
  guardada) ou um `403 PASSWORD_CHANGE_REQUIRED` em qualquer chamada, toda rota
  protegida leva a `/change-password`, que mostra só o formulário (mínimo de 10
  caracteres, igual à API) e sai pelo logout. A troca devolve uma **sessão nova**
  que substitui a atual. "Alterar senha" no menu do usuário abre a mesma tela
  para uso voluntário.
- **Permissões:** vêm só de `user.permissions` da sessão (resposta da API); o
  front nunca mapeia papel para permissão, só rotula o papel (Administrador,
  Editor, Leitor). Telas e guardas usam `useAuthContext().hasPermission(...)`.
- **Rotas:** `/login`, `/change-password` e `/no-permission` (públicas ou só com
  sessão), `/` redireciona para `/content-briefs` (`content-brief:read`) e
  `/users` exige `user:read`. Quem não tem nenhuma permissão vai para
  `/no-permission`; falha ao reconferir a sessão ao carregar mostra uma tela de
  recarregar, nunca "sem permissão".
- **Erros 401 e 403:** o 403 comum vira `ForbiddenApiError` e não encerra a
  sessão; `ACCOUNT_LOCKED`, `USER_DEACTIVATED` e `PASSWORD_CHANGE_REQUIRED` chegam
  com o `code` (não são "sem permissão"). `401 INVALID_CREDENTIALS` do login não
  dispara renovação.
- **Mensagens de erro:** `getApiErrorMessage(error)` em `src/lib/api-error.ts`
  decide pelo `code` do corpo `{ statusCode, code, message, fields? }`, nunca
  por regex no texto (só `ACCOUNT_LOCKED` e `WEAK_PASSWORD` mostram o texto da
  API, que traz os minutos restantes e o motivo). Sem conexão: "Sem conexão com o
  servidor. Suas alterações não foram salvas."
- **Limite conhecido:** o `sessionStorage` é por aba, mas duplicar a aba copia a
  sessão; as duas passam a compartilhar o mesmo refresh token e a primeira que
  renovar derruba a outra (a API trata o reuso como roubo). Entre de novo na aba
  derrubada.
- **Testes:** `renderWithProviders` e `renderRoutes` (`src/test/`) montam
  TanStack Query e roteador em memória. Para simular a pessoa logada, o teste
  declara `vi.mock('@/auth/use-auth')` e passa `auth: { ... }` (valores padrão
  de editor em `createAuthMock`). `src/auth/auth-flow.test.tsx` exercita os
  fluxos reais (provedor, store, cliente HTTP e telas) só com o `fetch`
  simulado; `src/test/users-fake.ts` é a API de usuários em memória.

## Administração de usuários (`/users`)

Acessível pelo menu do usuário, só com `user:read`.

- **Lista:** busca por nome ou e-mail (`q`, com espera de 300 ms), filtro Todos /
  Ativos / Desativados, tabela (nome, e-mail, papel, situação em pílula, último
  acesso e "Bloqueado até" quando `lockedUntil` é futuro) paginada de 20 em 20,
  com estados de carregando, vazio e erro. Em telas estreitas cada linha vira
  um cartão. Sem `user:write` a página é só leitura.
- **Com `user:write`:** **Novo usuário** (nome, e-mail, papel e senha opcional,
  em modal ou painel lateral conforme a preferência), **Editar** (nome e papel,
  com o `409 USER_VERSION_OUTDATED` tratado como nos outros editores: mantém o
  texto e oferece "Ver versão atual"), **Desativar/Reativar** e **Redefinir
  senha**, todos com confirmação.
- **Senha provisória:** ao criar sem senha ou redefinir, a API devolve uma senha
  provisória **uma única vez**. A tela a mostra num diálogo com botão de copiar e
  o aviso de que não será mostrada de novo; clicar fora não fecha (Esc e
  "Concluir" fecham) e ela some da memória ao fechar.
- **Regras da API na tela:** a linha da própria pessoa só oferece "Editar" (nome;
  o papel fica travado). `LAST_ADMIN` e `CANNOT_MODIFY_SELF` aparecem no modal de
  confirmação ou no campo do papel; `EMAIL_ALREADY_REGISTERED` no campo de e-mail.

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

`npm run demo:up` sobe a stack da demonstração já buildada no Docker (Postgres,
API em `http://localhost:3001` e UI em `http://localhost:5173`), com dados em um
volume que sobrevive a reinícios. A autenticação é a própria da API (ADR-016):
na primeira execução o `demo:up` gera o `demo/.env` (fora do git) com um
`JWT_SECRET` aleatório e a senha provisória do administrador inicial
`admin@pauta.local`; a senha **não é impressa**, leia com
`grep BOOTSTRAP_ADMIN_PASSWORD demo/.env`. O primeiro login exige trocar a senha.
`npm run demo:seed` cria os usuários de exemplo (`dev.admin`, `dev.editor` e
`dev.leitor`, `@pauta.local`, com a senha pública de desenvolvimento da API) e as
6 pautas de exemplo. Novos usuários nascem pela tela `/users`. `demo:backup`,
`demo:restore` e `demo:reset` cuidam de backup e recomeço (os dois últimos pedem
confirmação). Pare o `npm run dev` antes (a porta 5173 é a mesma). Passo a passo,
portas, usuários e o que apaga dados: [`docs/demo.md`](docs/demo.md).
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

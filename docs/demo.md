# Modo demonstração

Um comando sobe Postgres, API e UI já buildados no Docker, com dados que
sobrevivem a reinícios. É o ambiente `STAGE=demo` da POC: uso de verdade e
apresentação do case, só na sua máquina. **Somente uso local**: a senha do
Postgres é um valor fixo de demonstração (o banco não publica porta) e os
usuários de exemplo têm uma senha pública de desenvolvimento.

A autenticação é a própria da API (login por e-mail e senha, papéis
`admin`, `content-brief-editor` e `content-brief-viewer`). Não há provedor de
identidade externo. Contrato: `docs/auth.md` do repositório da API.

Roteiros relacionados:

- [`validation-script.md`](validation-script.md): passo a passo para a usuária do
  protótipo validar o sistema na máquina do dono.
- [`presentation-script.md`](presentation-script.md): roteiro de 15 a 20 minutos
  para apresentar o case.

## Pré-requisitos

- Docker Desktop em execução (Docker Compose v2) e com pelo menos 2 GB de memória
  para o Docker (ver [Problemas comuns](#problemas-comuns)).
- Node.js 26.13.1 (os scripts `npm run demo:*` são Node puro, sem dependência).
- O repositório `pauta-mkt-api` ao lado deste (`../pauta-mkt-api`): a demonstração
  builda a API a partir dele. Se a pasta estiver em outro lugar, defina
  `PAUTA_API_DIR` com o caminho antes do comando.
- **Pare o `npm run dev`** (e a API de desenvolvimento, se estiver rodando): a UI
  da demonstração usa a porta 5173, a única origem que a API da demonstração
  libera no CORS.

## Comandos

Todos na raiz de `pauta-mkt-ui`.

| Comando | O que faz |
| --- | --- |
| `npm run demo:up` | Na primeira vez gera o `demo/.env` (segredos). Builda as imagens, sobe tudo e espera ficar saudável. Mostra as URLs e onde está a senha do administrador |
| `npm run demo:down` | Para a demonstração **sem apagar os dados** |
| `npm run demo:seed` | Cria os usuários de exemplo (`dev.*@pauta.local`) e as 6 pautas de exemplo (pode rodar mais de uma vez: não duplica) |
| `npm run demo:backup` | Gera `demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz` (o banco inteiro, com os usuários) |
| `npm run demo:restore -- <arquivo>` | Substitui o banco pelo backup (**pede confirmação digitada: `RESTAURAR`**) |
| `npm run demo:reset` | Apaga o volume do banco e sobe do zero (**pede confirmação digitada: `APAGAR`**) |
| `npm run demo:logs` | Segue os logs da API (`npm run demo:logs -- postgres` para outro serviço) |

Primeira vez:

```bash
npm run demo:up
npm run demo:seed
```

O primeiro `demo:up` inclui o build das imagens e demora mais que os seguintes
(cache do Docker). Ao final ele mostra os endereços e onde ler a senha do
administrador inicial. Se a lista de pautas estiver vazia, rode `demo:seed`.

Uso do dia a dia, para parar e voltar sem perder nada:

```bash
npm run demo:down
npm run demo:up
```

## Portas

| Serviço | URL no host | Observação |
| --- | --- | --- |
| UI | http://localhost:5173 | Precisa ser a 5173 (origem liberada no CORS da API) |
| API | http://localhost:3001 | Swagger em `/docs`, saúde em `/health` |
| Postgres | não publicado | Acesso só por `docker compose exec` (os scripts já fazem) |

A demonstração convive com a stack de desenvolvimento (Postgres 5433, API 3000):
o projeto Docker é `pauta-demo` e nada dela é tocado.

## Segredos e o primeiro acesso

O `demo:up` cria, só se ainda não existir, o arquivo **`demo/.env`**
(permissão 0600, ignorado pelo git e fora das imagens Docker) com:

| Variável | O que é |
| --- | --- |
| `JWT_SECRET` | Segredo aleatório de 48 bytes que assina os tokens da API |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@pauta.local` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Senha provisória aleatória do administrador inicial |

**Onde ler a credencial do administrador:** abra `demo/.env` ou rode

```bash
grep BOOTSTRAP_ADMIN_PASSWORD demo/.env
```

O `demo:up` nunca imprime a senha no terminal; ele só aponta o arquivo. Não
compartilhe nem versione esse arquivo.

Como funciona o primeiro login:

1. A API cria o administrador inicial na subida, **só se a tabela de usuários
   estiver vazia**, com troca de senha obrigatória.
2. Entre em http://localhost:5173 com `admin@pauta.local` e a senha provisória.
3. A UI leva direto para **Defina uma nova senha** (mínimo de 10 caracteres,
   diferente da atual). Depois da troca você entra no sistema.
4. A partir daí a senha do `demo/.env` **deixa de valer**: a senha nova existe só
   no banco, em hash. Guarde a nova num gerenciador de senhas.

Esqueceu a senha do administrador? Outro administrador a redefine em
`/users` (menu **Redefinir senha**). Se não houver outro e os dados não
importarem, `npm run demo:reset` recria o administrador inicial com a senha
provisória do `demo/.env` (o reset **mantém** o `demo/.env`). Apagar o
`demo/.env` à mão **não** muda a senha do administrador que já está no banco:
só gera um `JWT_SECRET` novo (derruba as sessões abertas) e uma senha
provisória que não vale para ninguém.

## Usuários

| Usuário | Papel | Como existe |
| --- | --- | --- |
| `admin@pauta.local` | `admin` | Criado pela API na primeira subida (senha provisória do `demo/.env`) |
| `dev.admin@pauta.local` | `admin` | `demo:seed` |
| `dev.editor@pauta.local` | `content-brief-editor`: cria, edita, exclui, gerencia cadastros | `demo:seed` |
| `dev.leitor@pauta.local` | `content-brief-viewer`: somente leitura | `demo:seed` |

A senha dos três `dev.*` é a **senha só de desenvolvimento**
`dev-only-pauta-2026` (a mesma do `.env.example` da API). É pública: serve só
para testar nesta máquina, sem troca obrigatória. Se a demonstração for exposta
a outras pessoas, não rode o `demo:seed` ou apague esses usuários em `/users`.

### Criar usuários de verdade pela tela de usuários

Para a usuária do protótipo entrar com o próprio nome, crie um usuário pela
própria aplicação (não há console externo). Entre como administrador e:

1. Menu do usuário (canto superior direito) → **Usuários** (`/users`).
2. **+ Novo usuário**: nome, e-mail e papel (**Administrador**, **Editor** ou
   **Leitor**). Deixe a senha em branco para a API gerar uma provisória, ou
   preencha uma (10 a 128 caracteres).
3. A janela **Usuário criado** mostra a senha provisória **uma única vez**, com
   botão **Copiar senha**. Ela não será mostrada de novo. Repasse à pessoa por
   um canal seguro e clique em **Concluir**.
4. A pessoa entra com o e-mail e a senha provisória e é obrigada a definir uma
   senha própria no primeiro acesso.

Na mesma tela, com permissão de escrita, dá para **Editar** (nome e papel),
**Desativar/Reativar** e **Redefinir senha** (gera outra provisória, exibida uma
vez). Regras da API que aparecem na tela: o último administrador não pode ser
desativado nem rebaixado, e ninguém altera o próprio papel. Um **Leitor** ou
**Editor** não vê o menu **Usuários**.

Usuários criados assim ficam no banco: **sobrevivem a `demo:down`/`demo:up`** e
**entram no backup** (`demo:backup`).

## Onde ficam os dados

Em um volume nomeado do Docker, que sobrevive a `demo:down`, a reinício do
Docker e a rebuild das imagens:

| Volume | Guarda |
| --- | --- |
| `pauta-demo-pgdata` | O banco inteiro: pautas, empreendimentos, responsáveis, usuários (senhas em hash) e sessões |

O backup (`demo:backup`) cobre o banco inteiro, inclusive os usuários. Ele **não**
inclui o `demo/.env`: se o `JWT_SECRET` mudar, as sessões abertas caem e a
pessoa entra de novo, mas os usuários continuam válidos.

Os arquivos de backup ficam em `demo/backups/` (fora do git e fora das imagens).
`demo:restore` guarda antes um backup do estado atual (`pauta-antes-restore-...`)
e, se a restauração falhar, nada muda no banco. `demo:reset` também guarda um
backup (`pauta-antes-reset-...`) quando o banco está no ar.

### Rotina de backup sugerida

Não há agendamento automático. Uma rotina simples:

1. **Antes de mexer em algo** que possa afetar os dados (um `demo:restore`, um
   teste mais agressivo), rode `npm run demo:backup`.
2. **Uma vez por semana**, rode `npm run demo:backup` com a demonstração no ar.
3. **Copie o arquivo mais recente** de `demo/backups/` para fora da máquina:
   uma pasta de nuvem com acesso restrito, um pendrive guardado em local seguro
   ou outro disco. O arquivo contém os dados reais da POC e os hashes de senha
   dos usuários: se for para nuvem, prefira uma pasta criptografada ou compacte
   com senha antes de enviar.
4. Mantenha as últimas cópias e apague as antigas à mão quando não precisar mais.

Para conferir os backups existentes: `ls demo/backups/`. Para voltar a um deles:

```bash
npm run demo:restore -- demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz
```

Depois de um restore, os usuários e senhas voltam ao estado do backup (quem
mudou a senha depois do backup volta a ter a senha anterior).

## O que apaga dados

Só estes caminhos perdem dados; os dois primeiros pedem confirmação digitada:

- `npm run demo:reset`: apaga o volume (pautas, cadastros e todos os usuários,
  inclusive os criados pela tela de usuários). O administrador inicial é
  recriado com a senha provisória do `demo/.env`.
- `npm run demo:restore -- <arquivo>`: substitui o banco pelo conteúdo do backup.
- `docker volume rm pauta-demo-pgdata` ou `docker compose down -v` feitos à mão.
- "Clean / Purge data" do Docker Desktop.

`demo:down`, `demo:up` e `demo:seed` nunca apagam dados.

Para automação e testes, `demo:reset` e `demo:restore` aceitam `--yes` (pula a
confirmação). Não use no dia a dia.

## Nota de segurança: CSP da UI

A UI é servida pelo nginx com um cabeçalho `Content-Security-Policy` definido em
`nginx.conf`. Pontos que valem saber:

- `script-src 'self'`: a página só executa JavaScript da própria origem.
- `style-src 'self' 'unsafe-inline'`: o `'unsafe-inline'` é necessário por causa
  do Radix UI (diálogos, selects, menus). Ao abrir um painel, o Radix trava a
  rolagem da página e injeta um `<style>` em tempo de execução. Sem essa
  permissão, o navegador bloqueia o estilo e o painel lateral deixa a página
  rolar por trás. Não é possível usar hash (o texto varia com a largura da barra
  de rolagem) nem nonce (o Vite entrega HTML estático).
- `connect-src` lista a origem da API (`CSP_CONNECT_SRC` no compose).
- Como o `'unsafe-inline'` vale só para estilo, ele não libera scripts inline.

Para produção, a política de CSP precisa ser revista junto com a hospedagem
(ver `.docs/pauta-mkt/01-plan-tecnico.md` §12).

## Como o navegador fala com a API

O navegador chama a API **direto**, em `http://localhost:3001/api/v1/` (o nginx da
UI só serve os arquivos, sem proxy). Em `demo/compose.demo.yaml`:

- A UI é buildada com `VITE_API_BASE_URL=http://localhost:3001/api/v1/` (a
  variável é gravada no bundle em tempo de build) e libera essa origem em
  `connect-src` da CSP.
- A API libera a origem da UI em `CORS_ORIGINS=http://localhost:5173`.
- `TRUST_PROXY` fica no padrão (`false`): não há proxy na frente da API, e confiar
  em `X-Forwarded-For` sem proxy deixaria o cliente forjar o IP do limite de
  tentativas de login.
- A API aplica as migrations ao subir (`RUN_MIGRATIONS=true`); se falharem, ela
  não sobe.

Outras variáveis de build da UI, opcionais no `demo/.env` (valem no próximo
`demo:up`, que rebuilda): `VITE_UI_THEME` (`soft` ou `classic`) e
`VITE_FORM_PRESENTATION` (`modal` ou `drawer`). Veja [`appearance.md`](appearance.md).

## Problemas comuns

- **"Porta já em uso"** (5173 ou 3001): o `demo:up` lista quais portas
  estão ocupadas. Normalmente é o `npm run dev` (ocupa a 5173). Pare o processo
  e rode de novo. Para descobrir quem usa uma porta:
  ```bash
  lsof -nP -iTCP:5173 -sTCP:LISTEN
  ```
- **`npm run dev` rodando junto**: a UI da demonstração não sobe na 5173 enquanto
  o dev server estiver nela. Pare o `npm run dev` antes do `demo:up`.
- **Volta para o login / "Sua sessão expirou"**: confira os logs
  (`npm run demo:logs`). Trocar o `JWT_SECRET` (ou apagar o `demo/.env`) derruba
  as sessões abertas; entre de novo.
- **Erro de CORS no console do navegador**: a UI precisa abrir em
  `http://localhost:5173` exatamente (não `127.0.0.1`).
- **"Conta bloqueada"**: 5 senhas erradas seguidas travam a conta por 15 minutos.
  Um administrador libera em `/users` com **Redefinir senha**.
- **Não lembro a senha do administrador**: ver
  [Segredos e o primeiro acesso](#segredos-e-o-primeiro-acesso).
- **Lista de pautas vazia logo depois do `demo:up`**: esqueceu do `demo:seed`.
  Rode `npm run demo:seed`. Ele é idempotente: rodar de novo não duplica.
- **Memória**: se o Docker Desktop estiver com menos de 2 GB, os serviços podem
  demorar ou reiniciar. Aumente em *Settings → Resources* do Docker Desktop e
  reinicie.
- **"Perdi as pautas"**: confira se foi `demo:reset` ou `demo:restore` (são os
  únicos que apagam). Os backups guardados antes deles estão em `demo/backups/`
  (`pauta-antes-reset-...` e `pauta-antes-restore-...`).

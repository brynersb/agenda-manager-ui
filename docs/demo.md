# Modo demonstração

Um comando sobe Postgres, Keycloak, API e UI já buildados no Docker, com dados
que sobrevivem a reinícios. É o ambiente `STAGE=demo` da POC: uso de verdade e
apresentação do case, só na sua máquina. **Somente uso local**: as senhas são
fixas e o Keycloak roda em modo de desenvolvimento.

Roteiros relacionados:

- [`validation-script.md`](validation-script.md): passo a passo para a usuária do
  protótipo validar o sistema na máquina do dono.
- [`presentation-script.md`](presentation-script.md): roteiro de 15 a 20 minutos
  para apresentar o case.

## Pré-requisitos

- Docker Desktop em execução (Docker Compose v2) e com pelo menos 4 GB de memória
  para o Docker (ver [Problemas comuns](#problemas-comuns)).
- Node.js 26.13.1 (os scripts `npm run demo:*` são Node puro, sem dependência).
- O repositório `pauta-mkt-api` ao lado deste (`../pauta-mkt-api`): a demonstração
  builda a API a partir dele e importa o realm `bora` de
  `../pauta-mkt-api/docker/keycloak/realm-bora.json`. Se a pasta estiver em
  outro lugar, defina `PAUTA_API_DIR` com o caminho antes do comando.
- **Pare o `npm run dev`** (e a API de desenvolvimento, se estiver rodando): a UI
  da demonstração usa a porta 5173, a única que o realm libera como redirect.

## Comandos

Todos na raiz de `pauta-mkt-ui`.

| Comando | O que faz |
| --- | --- |
| `npm run demo:up` | Builda as imagens, sobe tudo e espera ficar saudável. Mostra as URLs e os usuários |
| `npm run demo:down` | Para a demonstração **sem apagar os dados** |
| `npm run demo:seed` | Carrega as 6 pautas de exemplo (pode rodar mais de uma vez: não duplica) |
| `npm run demo:backup` | Gera `demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz` (só o banco) |
| `npm run demo:restore -- <arquivo>` | Substitui o banco pelo backup (**pede confirmação digitada: `RESTAURAR`**) |
| `npm run demo:reset` | Apaga os dois volumes (dados e usuários do Keycloak) e sobe do zero (**pede confirmação digitada: `APAGAR`**) |
| `npm run demo:logs` | Segue os logs da API (`npm run demo:logs -- keycloak` para outro serviço) |

Primeira vez:

```bash
npm run demo:up
npm run demo:seed
```

O primeiro `demo:up` inclui o build das imagens e demora mais que os seguintes
(cache do Docker). O `demo:up` ao final mostra os endereços e os usuários de
teste. Se a lista de pautas estiver vazia, rode `demo:seed`.

Uso do dia a dia, para parar e voltar sem perder nada:

```bash
npm run demo:down
npm run demo:up
```

## Portas

| Serviço | URL no host | Observação |
| --- | --- | --- |
| UI | http://localhost:5173 | Precisa ser a 5173 (redirect do realm) |
| Keycloak | http://localhost:8081 | Console admin em `/admin` (`admin` / `admin`) |
| API | http://localhost:3001 | Swagger em `/docs`, saúde em `/health` |
| Postgres | não publicado | Acesso só por `docker compose exec` (os scripts já fazem) |

A demonstração convive com a stack de desenvolvimento (Postgres 5433, Keycloak
8080, API 3000): o projeto Docker é `pauta-demo` e nada dela é tocado.

## Usuários

Senha de todos os usuários de teste: `dev`.

| Usuário | Papel |
| --- | --- |
| `dev.editor` (Ana Editora) | `content-brief-editor`: cria, edita, exclui, gerencia cadastros |
| `dev.leitor` (Lucas Leitor) | `content-brief-viewer`: somente leitura |

### Criar um usuário de verdade pelo console do Keycloak

Os usuários `dev.*` são só de teste. Para a usuária do protótipo entrar com o
próprio nome, crie um usuário no console. Com a demonstração no ar:

1. Abra `http://localhost:8081/admin`.
2. Entre com `admin` / `admin`.
3. No canto superior esquerdo, troque o realm de `master` para **`bora`**.
4. Menu **Users** → **Add user**. Preencha usuário, e-mail, nome e sobrenome
   (o nome aparece no cabeçalho da tela) → **Create**.
5. Aba **Credentials** → **Set password**. Digite a senha, **desmarque
   "Temporary"** e confirme. Sem essa etapa o Keycloak pede troca de senha no
   primeiro login.
6. Aba **Role mapping** → **Assign role** → filtre por *realm roles* e marque
   `content-brief-editor` (para editar) ou `content-brief-viewer` (somente
   leitura) → **Assign**.
7. Teste em uma janela anônima: `http://localhost:5173`, entrando com o usuário
   novo.

**Trocar a senha:** no console, em **Users**, abra o usuário, aba
**Credentials**, e defina uma nova senha (a mesma etapa 5; desmarque "Temporary"
de novo). Para mudar o papel, use a aba **Role mapping**.

Usuário criado pelo console **não some** com `demo:down` nem `demo:up`. Ele é
apagado por `demo:reset` e não entra no backup (ver próxima seção): anote o
nome de usuário e o papel de cada um.

## Onde ficam os dados

Em dois volumes nomeados do Docker, que sobrevivem a `demo:down`, a reinício do
Docker e a rebuild das imagens:

| Volume | Guarda |
| --- | --- |
| `pauta-demo-pgdata` | O banco (pautas, empreendimentos, responsáveis) |
| `pauta-demo-kcdata` | O Keycloak (usuários criados pelo console, sessões) |

O backup (`demo:backup`) cobre **só o banco**. Usuários criados no console do
Keycloak vivem no volume `pauta-demo-kcdata` e não entram no backup.

Os arquivos de backup ficam em `demo/backups/` (fora do git e fora das imagens).
`demo:restore` guarda antes um backup do estado atual (`pauta-antes-restore-...`)
e, se a restauração falhar, nada muda no banco. `demo:reset` também guarda um
backup (`pauta-antes-reset-...`) quando o banco está no ar.

### Rotina de backup sugerida

Não há agendamento automático. Uma rotina simples:

1. **Antes de mexer em algo** que possa afetar os dados (um `demo:restore`, uma
   mudança no realm, um teste mais agressivo), rode `npm run demo:backup`.
2. **Uma vez por semana**, rode `npm run demo:backup` com a demonstração no ar.
3. **Copie o arquivo mais recente** de `demo/backups/` para fora da máquina:
   uma pasta de nuvem com acesso restrito, um pendrive guardado em local seguro
   ou outro disco. O arquivo contém os dados reais da POC: se for para nuvem,
   prefira uma pasta criptografada ou compacte com senha antes de enviar.
4. Mantenha as últimas cópias e apague as antigas à mão quando não precisar mais.

Para conferir os backups existentes: `ls demo/backups/`. Para voltar a um deles:

```bash
npm run demo:restore -- demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz
```

Lembre que o backup não traz os usuários do Keycloak: depois de um restore, eles
continuam como estavam no volume `pauta-demo-kcdata`.

## O que apaga dados

Só estes caminhos perdem dados; os dois primeiros pedem confirmação digitada:

- `npm run demo:reset`: apaga os dois volumes (pautas, cadastros e usuários do
  Keycloak criados pelo console).
- `npm run demo:restore -- <arquivo>`: substitui o banco pelo conteúdo do backup.
- `docker volume rm pauta-demo-pgdata pauta-demo-kcdata` ou `docker compose down -v`
  feitos à mão.
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
- `connect-src` lista a API e o Keycloak (`CSP_CONNECT_SRC` no compose).
- Como o `'unsafe-inline'` vale só para estilo, ele não libera scripts inline.

Para produção, a política de CSP precisa ser revista junto com a hospedagem
(ver `.docs/pauta-mkt/01-plan-tecnico.md` §12).

## Como o login funciona em contêineres

O navegador acessa o Keycloak em `http://localhost:8081`, mas a API, dentro da
rede do Docker, só o alcança em `http://keycloak:8080`. O `iss` do token precisa
ser o mesmo nos dois casos, senão a API responde 401 em tudo. A solução fica em
`demo/compose.demo.yaml`:

- Keycloak com `KC_HOSTNAME=http://localhost:8081` e
  `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`: o `iss` é sempre o externo.
- API com `OIDC_ISSUER_URL=http://localhost:8081/realms/bora` (valida o `iss`) e
  `OIDC_JWKS_URI=http://keycloak:8080/realms/bora/protocol/openid-connect/certs`
  (baixa as chaves pelo endereço interno).

## Problemas comuns

- **"Porta já em uso"** (5173, 8081 ou 3001): o `demo:up` lista quais portas
  estão ocupadas. Normalmente é o `npm run dev` (ocupa a 5173). Pare o processo
  e rode de novo. Para descobrir quem usa uma porta:
  ```bash
  lsof -nP -iTCP:5173 -sTCP:LISTEN
  ```
- **`npm run dev` rodando junto**: a UI da demonstração não sobe na 5173 enquanto
  o dev server estiver nela. Pare o `npm run dev` antes do `demo:up`.
- **401 em tudo / volta para o login**: confira os logs (`npm run demo:logs`) e se o
  `iss` do token é `http://localhost:8081/realms/bora`.
- **Lista de pautas vazia logo depois do `demo:up`**: esqueceu do `demo:seed`.
  Rode `npm run demo:seed`. Ele é idempotente: rodar de novo não duplica.
- **Mudei o `realm-bora.json` e nada mudou**: o Keycloak só importa o realm quando
  ele ainda não existe no volume. Rode `npm run demo:reset` (apaga os dados).
- **Console do Keycloak recusa o login com "HTTPS required"**: o Docker Desktop
  pode fazer o Keycloak enxergar o acesso como externo. O `demo:up` já corrige o
  realm `master` uma vez. Se ainda assim acontecer, rode:
  ```bash
  docker compose -p pauta-demo -f demo/compose.demo.yaml exec keycloak sh -c "/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin && /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE"
  ```
- **Memória**: Keycloak e Postgres pedem folga; se o Docker Desktop estiver com
  menos de 4 GB, os serviços podem demorar ou reiniciar. Aumente em
  *Settings → Resources* do Docker Desktop e reinicie.
- **"Perdi as pautas"**: confira se foi `demo:reset` ou `demo:restore` (são os
  únicos que apagam). Os backups guardados antes deles estão em `demo/backups/`
  (`pauta-antes-reset-...` e `pauta-antes-restore-...`).
- **O backup não tem um usuário novo**: esperado. Usuários do Keycloak não entram
  no backup do banco (ver acima).

# Roteiro de apresentação do case

Roteiro para apresentar a POC "Pauta de marketing Bora" à empresa em **15 a 20
minutos**, mais perguntas. A demonstração ao vivo usa o modo demonstração
(`docs/demo.md`).

## Tempo sugerido

| Bloco | Tempo | O que é |
| --- | --- | --- |
| 1. O problema | 2 min | Por que o protótipo não bastava |
| 2. Demonstração ao vivo | 7 min | Sistema funcionando, dois perfis |
| 3. Como foi construído | 3 min | Arquitetura, domínio e decisões |
| 4. Qualidade e números | 3 min | Testes, cobertura e desempenho |
| 5. O que falta para produção | 2 min | Tabela de pendências |
| Perguntas | até 3 min | Ver perguntas prováveis no fim |

Total das falas: 17 minutos, com folga para as perguntas.

## Antes de apresentar

Faça isto antes da reunião, não durante:

1. Docker Desktop aberto; `npm run dev` parado.
2. Na pasta `pauta-mkt-ui`:
   ```bash
   npm run demo:up
   npm run demo:seed
   ```
   O `demo:seed` cria os usuários de exemplo e as 6 pautas; só é necessário se
   a lista estiver vazia, e pode rodar sem problema mais de uma vez.
3. Faça **antes da reunião** o primeiro acesso do administrador: entre com
   `admin@pauta.local` e a senha provisória (leia com
   `grep BOOTSTRAP_ADMIN_PASSWORD demo/.env`), defina a senha definitiva e
   guarde-a. Faça o mesmo ensaio com um usuário novo criado em **Usuários**,
   para não descobrir o fluxo ao vivo.
4. Duas janelas lado a lado, uma com `dev.editor@pauta.local` e outra com
   `dev.leitor@pauta.local` (senha de desenvolvimento `dev-only-pauta-2026`),
   ambas em **http://localhost:5173**. Use uma janela anônima para o segundo
   perfil. Se for mostrar a administração, uma terceira com o administrador.
5. Abra a pasta `.docs/pauta-mkt/diagramas/` (ou os arquivos `.mmd`) e este
   roteiro, para não depender de internet.
6. Faça um backup antes da apresentação: `npm run demo:backup`. Assim, se algo
   der errado no passo 2, dá para voltar ao estado anterior.

## 1. O problema (2 min)

**O que dizer:** o protótipo em HTML funcionou. Serviu para desenhar a tela, as
regras e o fluxo com quem usa a pauta. Mas os dados viviam no navegador. Quando
a usuária abriu uma cópia local do arquivo, a pauta sumiu. Além disso, não havia
controle de quem edita, nem como duas pessoas trabalhar na mesma pauta sem
sobrescrever uma à outra.

**O que mostrar:** nada ainda. Se houver tempo, o protótipo HTML aberto ao lado,
só para lembrar a tela de origem.

**Frase de fechamento:** a regra de negócio já estava validada pelo uso. O
trabalho foi transformar o protótipo em um sistema com dados no servidor,
permissões e concorrência controlada.

## 2. Demonstração ao vivo (7 min)

Mostre as duas janelas lado a lado.

| Momento | O que fazer | O que destacar |
| --- | --- | --- |
| Editor | Na janela da editora, mostre a lista por prazo e a visão **Por status**. | Os dados vêm do servidor. O nome e a data aparecem no topo. |
| Criar pauta | Clique em **+ Nova pauta**. No campo Empreendimento escolha **+ Adicionar novo…** e digite um nome novo. Escolha um responsável e o prazo **Amanhã**. Salve. | A pauta cai em **Próximos 7 dias** sem recarregar nada. |
| Status | Troque o status do cartão para **Concluída** e mostre a pauta indo para a coluna certa em **Por status**. | O chip de contagem atualiza. |
| Filtros e busca | Digite `plantao` na busca (sem acento) e encontre "plantão". Filtre por empreendimento. Digite uma busca que não existe e clique em **Limpar filtros**. | A busca ignora o acento. |
| Leitor | Na janela do leitor, mostre que não há **+ Nova pauta** nem o botão de cadastros, que o menu do usuário não tem **Usuários** e que o status não muda. | A permissão vem do papel do usuário e a API bloqueia a escrita, mesmo para quem tentar pela URL. |
| Usuários | Na janela do administrador, abra **Usuários** pelo menu. Clique em **+ Novo usuário**, preencha nome e e-mail, escolha o papel **Editor** e crie. | A senha provisória aparece **uma única vez**, com botão de copiar. A pessoa será obrigada a trocar a senha no primeiro login. Mostre também **Desativar** e **Redefinir senha**. |
| Aparência | No menu do usuário, troque **Aparência** entre **Suave** e **Clássica** e **Formulários** entre **Modal** e **Painel lateral**; abra uma pauta em cada formato. | A escolha vale só para quem fez e fica guardada no navegador; o conteúdo e as regras são os mesmos. |
| Conflito | Abra a mesma pauta nas duas janelas. Salve na primeira. Salve na segunda, sem recarregar. | Aparece **"Esta pauta foi alterada por outra pessoa"** e o texto digitado é mantido. Ninguém sobrescreve sem ver a versão atual. |
| Reinício | No terminal: `npm run demo:down`, depois `npm run demo:up`. Recarregue a tela. | Tudo continua lá: a pauta criada, o status, os cadastros e os usuários criados. |

**Se algo der errado:** diga o que aconteceu, não tente consertar na frente da
plateia. Os passos do conflito e do reinício são os mais sensíveis. Se o reinício
demorar, espere o `demo:up` terminar antes de falar.

## 3. Como foi construído (3 min)

**O que mostrar:** os diagramas em `.docs/pauta-mkt/diagramas/`:

- `01-arquitetura.mmd`: navegador, API e Postgres.
- `03-camadas-do-modulo.mmd`: camadas de cada módulo.
- `04-fluxo-autenticacao.mmd`: fluxo de login (os diagramas do desenho
  original ainda mostram o provedor externo; hoje a API autentica sozinha, ver
  ADR-016).

**O que dizer:**

- Dois projetos separados: `pauta-mkt-api` (NestJS, Postgres) e `pauta-mkt-ui`
  (React, Vite). O contrato HTTP foi congelado antes do código, e cada lado
  pode ser testado e entregue sozinho.
- Domínio explícito em camadas (DDD): a regra de negócio fica no domínio e os
  casos de uso orquestram. A lint impede que a camada de aplicação importe
  infraestrutura.
- Decisões que mais pesam:
  - **ADR-001:** o que veio de cada repositório de referência. O backend de
    referência tinha outro banco e outro padrão de testes, então a decisão foi
    misturar: parte de cada um, com justificativa.
  - **ADR-002:** DDD com camada de domínio explícita e linguagem do negócio.
  - **ADR-006:** concorrência otimista. Cada pauta tem uma `version`; salvar com
    versão antiga gera o conflito que a plateia viu.
  - **ADR-015:** nomes de código em inglês e textos de tela em português.
- Autenticação e permissões: a própria API autentica (e-mail e senha, senha
  em argon2id, token de acesso de 15 minutos e renovação por token de uso
  único); a API decide as permissões a partir do papel do usuário; a UI
  pergunta as permissões à API e não reimplementa o mapa. A senha provisória de
  um usuário novo (ou redefinido) obriga a troca no primeiro acesso, e a API
  bloqueia o resto do sistema até a troca. Foi a decisão ADR-016, que
  substituiu o provedor externo do desenho original.

## 4. Qualidade e números (3 min)

Os números de testes foram medidos em **15/11/2026** (os de cobertura e desempenho, em 14/11/2026, antes da autenticação própria, e devem ser remedidos). Podem ser reproduzidos rodando os
testes de cada projeto na mesma máquina.

| Item | Resultado |
| --- | --- |
| Testes unitários da API | 635 |
| Testes e2e da API, contra Postgres real | 470 |
| Testes da UI | 506 |
| Cobertura de linhas da API, total | 71,6% |
| Cobertura de linhas da API, domínio compartilhado | 93,9% |
| Consulta de lista com 5.000 pautas (p95) | 35,6 ms |
| Consulta de resumo com 5.000 pautas (p95) | 4,9 ms |
| Busca com acento com 5.000 pautas (p95) | 54,8 ms |
| Meta de tempo de resposta | 300 ms |

- Para ver a cobertura por pasta na API, rode `npm run test:cov` na pasta
  `pauta-mkt-api`.
- Para reproduzir as medições de tempo (5.000 pautas): na pasta `pauta-mkt-api`,
  siga a seção de carga do `README.md` (`npm run load:seed`, `npm run
  load:measure` e `npm run load:clean`). Rode isso no banco de **desenvolvimento**
  (porta 5433), não no da demonstração; o script recusa qualquer banco que não
  seja local.
- Os testes e2e da API rodam contra Postgres real, não contra simulação.
- **Renovação do login verificada ao vivo:** a sessão ficou aberta por mais de
  7 minutos sem interação e o token foi renovado sozinho, sem voltar à tela de
  login.

**Como dizer:** os números são bons para uma POC, mas não substituem uma
operação real. O que eles mostram é que a base é testada e que a busca e a lista
ficam bem abaixo da meta com 5.000 pautas.

## 5. O que falta para produção (2 min)

Resumo da tabela do `.docs/pauta-mkt/01-plan-tecnico.md`, seção 12. Mostre a
tabela ou fale por tema:

| Tema | O que falta | O que já está preparado |
| --- | --- | --- |
| Hospedagem | Escolher nuvem, domínio e TLS | Imagens Docker da API e da UI (nginx com CSP) |
| Identidade | Login próprio já existe (ADR-016). Falta, se a empresa quiser: SSO corporativo, MFA e recuperação de senha por e-mail | Papéis e permissões no servidor; administração de usuários pela tela |
| Banco | Postgres gerenciado com backup diário e restauração testada | Migrations por comando |
| Entrega | Pipeline de CI (validação, testes, build, auditoria de dependências), branches protegidas, deploy com migration e rollback | Scripts que já são os passos do pipeline |
| Testes | Testes e2e de navegador, meta de cobertura | e2e da API por papel |
| Observabilidade | Coletor de logs, alertas de erro e de saúde | Logs em JSON com identificador de requisição |
| Dados | Cadastro real de empreendimentos e responsáveis; importação do protótipo | Seed idempotente |
| Processo | Épico e tarefas no Jira, revisão de Tech Lead, fluxo SDD completo | Os documentos desta pasta |

**Frase de fechamento:** o desenho aguenta o salto. Muda a configuração e a
hospedagem; a aplicação e as regras ficam.

## Perguntas prováveis

**Por que a API tem login próprio, e não um provedor de identidade?**
O desenho original usava um provedor de identidade externo, mas para uma POC isso
trazia mais uma peça para subir e operar. A decisão ADR-016 trouxe o login para
a API: e-mail e senha, papéis e administração de usuários pela tela, tudo em um
só lugar. O custo é não ter SSO, MFA nem recuperação de senha por e-mail ainda;
quem esquece a senha pede a um administrador. Se a empresa tiver um provedor de
identidade, a autenticação é a parte que se troca.

**Por que dois projetos separados?**
A decisão D1 do `00-viabilidade-tecnica.md` diz: é o mesmo desenho dos repositórios
de referência; dois projetos podem ser desenvolvidos em paralelo sem disputar
arquivos, e, se virar produto, cada um ganha o próprio pipeline. Um monorepo foi
descartado por trazer uma ferramenta nova sem ganho para dois projetos pequenos.

**Por que DDD numa POC?**
Porque a POC é o começo de um sistema que pode crescer, e a regra de negócio
precisa estar explícita para ser testada e para o código gerado por agentes
respeitar as regras. Reconheça o custo: para uma regra tão pequena, é mais
estrutura do que o problema pede. Essa escolha foi feita de propósito (ADR-002).

**O que muda para ir a produção?**
A tabela do bloco 5. Resumo: hospedagem, identidade corporativa, banco gerenciado
com backup, pipeline de entrega, testes de navegador, observabilidade e cadastro
real de dados.

**Quanto tempo levou?**
O plano estimou cerca de 14 dias úteis de trabalho (`.docs/pauta-mkt/04-estimativa.md`).
A implementação foi feita por agentes de IA com revisão, em um único dia de
relógio (14/11/2026, incluindo uma pausa por limite de uso). Isso cobre só a
construção e a validação automática; a revisão de código do dono e a validação
com a usuária vêm depois. **Preencher antes da apresentação:** quantas horas o
dono dedicou à revisão.

**Os dados estão seguros?**
Na POC, ainda não como produção. O login é de verdade (senhas em hash, bloqueio
após tentativas erradas, troca obrigatória da senha provisória), mas a
demonstração roda só na máquina, com um banco sem backup automático e uma senha
pública de desenvolvimento nos usuários de exemplo. Para produção, isso muda
(ver bloco 5).

**Por que o login é obrigatório agora?**
Porque o protótipo não tinha controle de quem edita. Com o login, cada alteração
fica registrada com o nome de quem fez, o leitor não consegue alterar nada e o
administrador cria e desativa usuários pela tela.

**E se duas pessoas editarem a mesma pauta?**
O sistema avisa a segunda pessoa e não perde o texto dela. Ela pode ver a versão
atual e decidir o que manter. Não há sobrescrita silenciosa.

---

Notas do dono (preencher antes): ____________________________________________

# Roteiro de validação (modo demonstração)

Este roteiro é para a pessoa que usava o protótipo validar o sistema novo. Não
precisa saber programar. Siga os passos na ordem, marque cada um e anote
qualquer coisa estranha no fim.

Você vai usar o sistema no endereço **http://localhost:5173**, na máquina do
dono. Os dados são de teste: pode criar, mudar e apagar à vontade.

## Antes de começar

Quem está com a máquina faz isto uma vez:

1. Abra o **Docker Desktop** e espere ele ficar pronto.
2. Feche o que estiver usando as portas 5173 e 3001 (se houver um
   `npm run dev` rodando, pare-o).
3. Abra o terminal na pasta `pauta-mkt-ui` e rode:
   ```bash
   npm run demo:up
   ```
   Espere a mensagem **"Demonstração no ar"**. A primeira vez demora mais.
4. Carregue os usuários e as pautas de exemplo (pode rodar mais de uma vez sem
   duplicar):
   ```bash
   npm run demo:seed
   ```
5. Abra **http://localhost:5173** no navegador.

Usuários para o roteiro (e-mail e senha):

| Usuário | Senha | Use em |
| --- | --- | --- |
| `dev.editor@pauta.local` (Dev Editor) | `dev-only-pauta-2026` | passos 1, 3 a 9 |
| `dev.leitor@pauta.local` (Dev Leitor) | `dev-only-pauta-2026` | passo 2 |
| `dev.admin@pauta.local` (Dev Admin) | `dev-only-pauta-2026` | passos 12 e 13 |

Essa senha é pública e só vale nesta máquina de teste. Se a usuária já tiver um
usuário próprio, criado por um administrador em **Usuários** (ver `docs/demo.md`),
ela pode usar esse no lugar do `dev.editor`; o passo 12 mostra como criar. Nesse
caso, no passo 1, o nome que aparece no topo é o nome que foi cadastrado.

**Primeiro acesso do administrador** (quem está com a máquina, uma vez): entre com
`admin@pauta.local` e a senha provisória que está no arquivo `demo/.env`
(`grep BOOTSTRAP_ADMIN_PASSWORD demo/.env`). O sistema pede uma nova senha antes
de qualquer coisa; defina e guarde-a. A senha do arquivo deixa de valer.

Para os passos 7 e 11, é preciso uma segunda janela: outro navegador ou uma
janela anônima.

Use a coluna **OK / Problema** para marcar: escreva **OK** se aconteceu como
descrito, ou **Problema** e uma frase do que foi diferente.

## Passos

### Entrar e sair

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 1 | Entre com `dev.editor@pauta.local` e a senha de desenvolvimento. Veja o topo da tela. | Aparecem a data de hoje e o nome "Dev Editor" (ou o nome do usuário próprio). A lista de pautas carrega. | |
| 1b | Abra o menu do usuário (no canto) e clique em **Sair**, depois confirme. | Volta para a tela de login. Entrar de novo com o mesmo usuário funciona. | |

### Permissões: o leitor

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 2 | Saia e entre com `dev.leitor@pauta.local`. Olhe a tela inteira e abra o menu do usuário. | Não aparece o botão **+ Nova pauta**. Não aparece o botão **Editar empreendimentos e responsáveis**. O menu não tem **Usuários**. Abrindo uma pauta, ela aparece só para ler: não há botão **Salvar**, e o campo de status fica desabilitado (não dá para trocar). |  |

### Criar pauta

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 3 | Entre como editora. Clique em **+ Nova pauta**. Preencha o título "Teste de validação 1". Abra o campo **Empreendimento**, escolha a última opção, **+ Adicionar novo…**, digite um nome que ainda não existe, por exemplo "Residencial Teste", e aperte **Enter** (ou clique em **Adicionar**). Em **Responsável**, escolha alguém da lista. Em **Prazo**, clique em **Amanhã**. Clique em **Salvar**. | Aparece o aviso "Pauta salva". A pauta entra no grupo **Próximos 7 dias**. O novo empreendimento "Residencial Teste" passa a aparecer nos seletores. Ao abrir a pauta de novo, os dados estão lá. |  |
| 3b | Crie outra pauta com prazo **Hoje** e outra com **Sem prazo**. | Cada uma cai no grupo certo: **Hoje** e **Sem prazo definido**. |  |

### Status

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 4 | Anote o número do chip **Concluídas** (no topo da lista). Em uma pauta, mude o status do cartão para **Concluída**. Depois clique em **Por status** (troca de visão no topo). | A pauta sai do grupo de prazo e aparece na coluna **Concluída** da visão **Por status**. O número do chip **Concluídas** aumenta em 1. |  |
| 4b | Volte para **Por prazo**. Mude o status dessa pauta para **Em andamento**. | A pauta volta para o grupo de prazo original. O chip **Concluídas** diminui em 1. |  |

### Busca e filtros

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 5 | No campo **Buscar pauta**, digite `plantao` (sem acento). Se não houver nenhuma pauta com "plantão", crie uma antes com essa palavra no título. | A pauta com "plantão" aparece, mesmo sendo digitada sem acento. Os números dos chips acompanham a busca. |  |
| 5b | Limpe a busca. Abra o filtro de **empreendimento** e escolha "Residencial Teste". | Só aparecem pautas desse empreendimento. |  |
| 5c | Digite na busca algo que não existe, por exemplo `zzzz`. | Aparece "Nenhuma pauta encontrada" com o botão **Limpar filtros**. Clique nele: a busca e os filtros são limpos e a lista volta completa. |  |
| 5d | Clique no chip **Atrasadas** e depois em **Todas**. | A lista mostra só as atrasadas e depois volta a mostrar tudo. |  |

### Excluir

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 6 | Abra a pauta "Teste de validação 1" e clique em **Excluir**. Em seguida, clique em **Confirmar exclusão** dentro de 4 segundos. | A pauta some da lista. Se a pessoa esperar mais de 4 segundos, o botão volta a dizer **Excluir** e nada é apagado. |  |

### Conflito de edição

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 7 | Na janela 1, entre como editora e abra uma pauta. Na janela 2 (outro navegador ou janela anônima), entre como a mesma pessoa e abra **a mesma pauta**. Na janela 1, mude o título e clique em **Salvar**. Na janela 2, sem recarregar, escreva uma frase nova no campo "Sobre o que se trata" e clique em **Salvar**. | Na janela 2 aparece o aviso **"Esta pauta foi alterada por outra pessoa"**. O texto que você digitou continua no campo; nada se perde. |  |
| 7b | Na janela 2, clique em **Ver versão atual** e confirme. | A janela 2 mostra a versão salva pela janela 1 (com o título novo). |  |

### Arquivar empreendimento

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 8 | Clique em **Editar empreendimentos e responsáveis** (abre o painel "Empreendimentos e responsáveis"). Na seção **Empreendimentos**, escolha um nome que já esteja em pautas (por exemplo, um dos exemplos) e clique em **Arquivar**. | Aparece uma janela com a quantidade de pautas que usam o nome, por exemplo "2 pautas abertas usam este nome. Elas continuam mostrando o nome depois de arquivar." Confirme. |  |
| 8b | Abra uma dessas pautas. Abra o seletor de empreendimento de uma **pauta nova** (**+ Nova pauta**). | Na pauta antiga, o nome continua aparecendo, marcado como "(arquivado)". No seletor da pauta nova, o nome arquivado **não aparece**. |  |
| 8c | Em **Editar empreendimentos e responsáveis**, marque **Mostrar arquivados** e clique em **Reativar** no nome arquivado. | O nome volta a ficar ativo e aparece de novo no seletor de pauta nova. |  |

### Sessão longa

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 9 | Deixe a aba aberta por pelo menos **7 minutos** sem mexer em nada. Depois, clique em um filtro e salve uma alteração em uma pauta. | Você continua na tela, sem voltar para o login, e a lista carrega normalmente. |  |

### Parar e voltar

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 10 | No terminal, na pasta `pauta-mkt-ui`, rode `npm run demo:down`. Espere terminar. Depois rode `npm run demo:up`. Abra **http://localhost:5173**. | Todas as pautas, empreendimentos e responsáveis continuam lá. Os usuários (inclusive os criados no passo 12) continuam existindo e com as mesmas senhas. |  |

### Celular

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 11 | Na segunda janela (ou no navegador com as ferramentas de desenvolvedor), deixe a largura da tela em cerca de **375 pixels** (tamanho de celular). Role a lista e abra uma pauta. | Não aparece barra de rolagem para os lados. Os textos e botões cabem na tela. O painel da pauta pode ser usado normalmente. |  |

### Aparência

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 11b | Como editora, abra o menu do usuário e troque **Aparência** entre **Suave** e **Clássica**. Depois troque **Formulários** entre **Modal** e **Painel lateral** e abra uma pauta em cada um. | A tela muda de visual na hora e a pauta abre no formato escolhido (janela central ou painel lateral). Ao recarregar a página a escolha continua. |  |

### Administração de usuários

Use a janela do administrador (`dev.admin@pauta.local`).

| Passo | O que fazer | O que deve acontecer | OK / Problema |
| --- | --- | --- | --- |
| 12 | No menu do usuário, abra **Usuários**. Clique em **+ Novo usuário**, preencha nome e e-mail (por exemplo `maria.teste@pauta.local`), escolha o papel **Editor** e deixe a senha em branco. Clique em **Criar usuário**. | Aparece **Usuário criado** com uma senha provisória e o aviso de que ela não será mostrada de novo. Copie-a (botão **Copiar senha**) e clique em **Concluir**. O usuário entra na lista. |  |
| 12b | Em outra janela (anônima), entre com o usuário novo e a senha provisória. | O sistema pede para definir uma senha nova antes de mostrar as pautas. Depois da troca, a pessoa entra normalmente (como Editor). |  |
| 13 | Volte à janela do administrador. No menu **Ações** do usuário novo, escolha **Redefinir senha** e confirme. Depois **Desativar** o mesmo usuário e confirme. | Redefinir mostra outra senha provisória, uma única vez. Desativado, o usuário aparece como **Desativado** e não consegue mais entrar (mensagem de conta desativada). **Reativar** devolve o acesso. |  |
| 13b | Tente desativar ou mudar o papel do próprio administrador, ou do único administrador. | A tela não oferece a ação para a própria pessoa, ou mostra o aviso da regra (sempre precisa existir um administrador ativo). |  |

## Diferenças em relação ao protótipo

Estas mudanças são intencionais. Confira se fazem sentido para o uso:

- **Login:** é preciso entrar com e-mail e senha. Quem recebe uma senha
  provisória precisa trocá-la no primeiro acesso. Quem não tem permissão vê uma
  tela de "sem permissão". Quem esquece a senha pede a um administrador a
  redefinição (não há recuperação por e-mail).
- **Usuários:** os administradores criam, editam, desativam e redefinem usuários
  pela tela **Usuários**.
- **Aparência:** há duas aparências (Suave e Clássica) e dois formatos de
  formulário (janela central ou painel lateral), à escolha de cada pessoa.
- **Dados no servidor:** as pautas ficam guardadas no banco de dados, não no
  navegador. Fechar o navegador ou abrir outra janela não apaga nada.
- **Arquivar em vez de remover:** um empreendimento ou responsável arquivado some
  das listas de pauta nova, mas as pautas antigas continuam mostrando o nome
  com "(arquivado)". Dá para reativar.
- **Sem botão de "pautas de exemplo":** os exemplos só entram pelo comando
  `npm run demo:seed`, não pela tela.
- **Aviso de conflito:** se duas pessoas editam a mesma pauta, quem salvar por
  último vê o aviso e não perde o texto digitado.
- **Leitor:** quem tem só permissão de leitura não cria, não edita, não exclui e
  não muda status.

## Problemas e observações

Anote aqui o que não funcionou, o que pareceu estranho ou o que faltou. Cite o
número do passo.

| Passo | O que aconteceu | Como apareceu na tela |
| --- | --- | --- |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

Sugestões e outras coisas que sentiu falta:

_____________________________________________________________________________

_____________________________________________________________________________

_____________________________________________________________________________

Quem validou: ______________________________   Data: ____ / ____ / ________

# CLAUDE.md

Instruções para Claude Code ao trabalhar neste repositório (`pauta-mkt-ui`).

**Commits só quando o dono pedir.** O repositório não é para segredos: nunca versione `.env`, credenciais, caminho pessoal nem nome de sistema interno. Mensagens em Conventional Commits.

## Regras do front

- Biome manda (aspas simples, ponto e vírgula, indent 2, largura 80,
  `useSortedClasses` como erro). `npm run check` antes de terminar.
- Imports: NODE, linha vazia, PACKAGE, linha vazia, ALIAS/PATH. `@/` aponta para
  `src/`.
- Componentes em `kebab-case.tsx`, export nomeado, sem `export default`.
- Texto de interface em **pt-BR**. Rótulos de enum só em `lib/labels.ts`.
- Cores só por token. **Nunca hex solto em componente**: o modo escuro depende
  disso. Hex só em `src/index.css`.
- Permissões só de `useAuthContext().hasPermission(...)`. Nunca mapa
  papel-permissão no front.
- Erros de API: `getApiErrorMessage(error)` de `lib/api-error.ts`, decidido por
  `code`.
- Estado de servidor só no TanStack Query; sem lib de estado nova. Formulário
  com `useState` + `validate()`.
- Testes `.test.tsx` ao lado de hooks, `lib/`, guards de rota e componentes com
  estado ou regra. API mockada com `vi.mock('@/lib/api')` e auth com
  `vi.mock('@/auth/use-auth')`. `renderHook` com
  `QueryClient({ defaultOptions: { queries: { retry: false } } })`.
- Acessibilidade mínima: todo controle com rótulo, foco visível, formulário em
  modal ou painel lateral com `aria-labelledby`, contraste AA nos dois temas
  (claro/escuro) e nos dois temas visuais (`soft`/`classic`).
- Formulários que abrem sobre a tela usam `FormSurface`
  (`components/ui/form-surface.tsx`), nunca `Drawer` ou `FormModal` direto: ela
  escolhe modal ou painel lateral pela preferência (`formPresentation`, padrão
  `VITE_FORM_PRESENTATION`) e devolve o foco a quem abriu. Confirmações curtas
  continuam em `Modal`.
- Layout funciona em 375 px de largura sem rolagem horizontal.

## Tokens de cor (`src/index.css`)

Definidos em variáveis CSS e expostos no `@theme inline` do Tailwind (`bg-bg`,
`text-ink`, `border-line`...). O escuro vem de `prefers-color-scheme` (exceto
com `data-theme="light"`) ou de `data-theme="dark"`.

| Token | Claro | Escuro |
|---|---|---|
| `bg` | `#EFF5F4` | `#0A1413` |
| `surface` | `#FFFFFF` | `#12201F` |
| `ink` | `#0F1F1E` | `#E6F0EE` |
| `muted` | `#52706D` | `#94ADAA` |
| `line` / `line-strong` | `#D3E2E0` / `#A9BFBC` | `#223533` / `#3A5350` |
| `hover` | `#F6FAF9` | `#172928` |
| `accent` / `accent-ink` / `accent-tint` | `#0B7479` / `#FFFFFF` / `#D9EEEC` | `#4DC4C0` / `#06201F` / `#123B3B` |
| `hl` / `hl-ink` / `hl-soft` | `#F9A363` / `#1A1209` / `#F9A363` | `#F9A363` / `#1A1209` / `#7A4A1F` |
| `warm` | `#A94A1B` | `#F9A363` |
| `late` / `late-bg` | `#B3261E` / `#FBE7E4` | `#FF8F86` / `#3A1E1C` |

### Temas visuais (`data-ui-theme`)

Há dois: `classic` (o visual original; vale sem o atributo) e `soft` (padrão).
Escolha em `hooks/use-preferences.ts` (`useAppearance`; padrão em
`VITE_UI_THEME`), aplicada no `<html>`. Regras:

- O `classic` **nunca muda**. Token novo nasce no `:root` com o valor
  equivalente ao estilo original e o `soft` só o sobrescreve em
  `:root[data-ui-theme="soft"]` (e nos dois blocos escuros dele).
- Componente não escolhe tema: usa só token (`bg-pill-done-bg`,
  `rounded-card`, `shadow-float`, `bg-chip-on`...). Pesos, raios e tamanhos vêm
  das variáveis do Tailwind (`--font-weight-*`, `--radius-*`, `--text-*`), que o
  `soft` sobrescreve; por isso não se fixa peso, raio ou sombra em valor
  arbitrário (`font-[650]`, `rounded-[14px]`).
- Estados derivados em tokens: `pill-*` (status), `chip-on*`, `seg-on*`,
  `toast-ok*`, `accent-line`; elevações `elev-drawer`/`elev-float`/`elev-card`
  (use `shadow-drawer`, `shadow-float` ou `[box-shadow:var(--elev-card)]`).
- Par texto/fundo novo no `soft` precisa de contraste AA (4,5:1) no claro e no
  escuro.

Texto `muted` sobre `line` (fundo da pílula de status concluída) não passa AA no
claro (4,0:1); nesse fundo use `text-ink`.

## Padrão de Documentação e Comentários

Padrão oficial da empresa, definido pela liderança técnica. Vale como régua
para qualquer novo desenvolvimento e para as revisões de PR.

O motivo é o fluxo de desenvolvimento agêntico: o código diz **o que** está
sendo feito, mas os agentes precisam entender os contratos e o **porquê** de
cada implementação. Documentar a intenção de forma estruturada economiza janela
de contexto, evita refatorações que quebrem regras implícitas e aumenta a
precisão do código gerado.

### 1. JSDoc/TSDoc estruturado

- **Onde aplicar:** todas as funções exportadas, constantes estratégicas, hooks
  customizados, utilitários e APIs públicas.
- **O que incluir:** propósito do bloco, descrição dos parâmetros (`@param`),
  retorno (`@returns`) e exceções possíveis (`@throws`).

Comentário que documenta uma declaração — função, constante, propriedade de
interface, entrada de um mapa de configuração — usa bloco `/** */`, não `//`.
A forma `//` fica para explicar um trecho de lógica dentro de um corpo de
função.

### 2. Contexto de negócio (foco no porquê)

- **Onde aplicar:** regras de negócio complexas, contornos de bibliotecas de
  terceiros e decisões técnicas não triviais.
- **Objetivo:** explicar a motivação. Se a razão de um trecho existir não é
  evidente pela leitura das variáveis e funções, ela precisa estar comentada.

### 3. Mapeamento de casos de uso em testes

- **Onde aplicar:** suítes de testes automatizados.
- **Objetivo:** nome e comentários do teste devem descrever o comportamento ou
  a regra de negócio validada, servindo como especificação funcional.

### O que deve ser evitado

- **Referência a card ou ticket** (Jira, Trello etc.), como
  `// PROJ-123: ajusta cálculo de frete`. Isso pertence à mensagem de commit e
  ao PR. O comentário no código precisa ser atemporal e autoexplicativo, sem
  depender de um card externo.
- **Poluição e redundância:** não comentar o óbvio (`// busca o usuário` sobre
  `getUser()`). Código autoexplicativo dispensa comentário.
- **Código morto:** trecho desativado se apaga, não se comenta.

### Exemplo prático

Como **não** fazer:

```ts
// PROJ-456: Valida se a receita pode ser assinada
export const checkRx = (rx: any) => {
  // Pega a data atual
  const now = new Date();

  // se for receita controlada
  if (rx.type === 'CONTROLLED') {
    // verifica se passou de 30 dias
    if (now.getTime() - rx.createdAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
      return false; // expirada
    }
  }
  return true;
};
```

Problemas: referência ao ticket, comentários que repetem o que o código faz,
tipagem fraca e nenhum contexto regulatório explicado.

Como **deve** ser feito:

```ts
/**
 * Valida se uma prescrição digital está dentro do prazo legal de validade para
 * assinatura.
 *
 * Medicamentos de controle especial (Portaria SVS/MS 344/98) têm validade
 * máxima de 30 dias a partir da emissão. Depois desse prazo, o envio para
 * assinatura ICP-Brasil deve ser bloqueado.
 *
 * @param prescription Dados e metadados da prescrição digital.
 * @param referenceDate Data de referência para a checagem; padrão é agora.
 * @returns `true` se a prescrição estiver válida para assinatura.
 */
export const isPrescriptionEligibleForSignature = (
  prescription: DigitalPrescription,
  referenceDate: Date = new Date(),
): boolean => {
  const CONTROLLED_MEDICATION_MAX_VALIDITY_DAYS = 30;

  if (prescription.category === 'CONTROLLED') {
    const daysSinceCreation = getDifferenceInDays(
      referenceDate,
      prescription.createdAt,
    );
    return daysSinceCreation <= CONTROLLED_MEDICATION_MAX_VALIDITY_DAYS;
  }

  return true;
};
```

Ganhos: contrato legível por IA, a norma técnica que justifica os 30 dias está
explícita, tipos bem definidos e nenhuma referência temporária a tarefa.

## Padrão de nomes (ADR-015)

Código em inglês; texto de tela em pt-BR. Pastas, arquivos, componentes, hooks,
tipos, props, rotas, campos de JSON, chaves de `localStorage`, papéis, permissões
e `code` de erro são em inglês. Continuam em português: rótulos, mensagens,
placeholders, títulos, comentários, JSDoc e descrições de teste. Os enums ficam
com chaves em inglês e valores exibidos em português em `lib/labels.ts`. Spec:
`.docs/pauta-mkt/15-padrao-de-nomes.md` (§1 e §7).

# Aparência: temas visuais e formulários

Duas escolhas independentes, ambas reversíveis, que valem no tema claro e no
escuro do sistema.

| Escolha | Valores | Padrão | Variável de ambiente | Menu do usuário |
| --- | --- | --- | --- | --- |
| Tema visual | `soft`, `classic` | `soft` | `VITE_UI_THEME` | Aparência: Suave / Clássica |
| Formulários | `modal`, `drawer` | `modal` | `VITE_FORM_PRESENTATION` | Formulários: Modal / Painel lateral |

A escolha da pessoa (salva no `localStorage`, chave
`pauta-mkt:appearance:v1`) vence a variável de ambiente; a variável só define o
padrão de quem ainda não escolheu. Valor desconhecido (na variável ou no
storage) cai no padrão. Storage bloqueado não quebra: a escolha vale só na
sessão.

## Como funciona

- **Tema.** `applyUiTheme` grava `data-ui-theme="soft|classic"` no `<html>` (em
  `main.tsx`, antes do primeiro render, e a cada troca em `useAppearance`). O
  `src/index.css` define o `classic` no `:root` (o visual original) e o `soft`
  em `:root[data-ui-theme="soft"]`, só sobrescrevendo variáveis: cores
  (mesma matiz da marca, superfícies e bordas mais leves, tints mais claros nas
  pílulas), sombras (`--elev-*`), raios (`--radius-*`, `--r-card`), pesos
  (`--font-weight-*`), entrelinha e a base de 16 px (o `classic` usa 15 px).
- **Formulários.** `FormSurface` renderiza `FormModal` (Radix Dialog centrado,
  corpo rolável com altura máxima de 90% da tela, rodapé fixo; até 640 px vira
  folha na base com até 92% da altura) ou `Drawer` (o painel lateral original),
  com o mesmo contrato. Editor de pauta e painel de cadastros usam só
  `FormSurface`; confirmação de saída com alterações, conflito 409, Esc, clique
  fora e foco preso não dependem do formato. `?new=1` e `?brief=<id>` seguem
  iguais.

## Como a reversão foi verificada

Com `classic` + `drawer` o app é o original. Prova feita em navegador (Chrome
no painel do Claude Code), com uma página de teste que monta a tela de pautas
com API e auth falsas, uma vez com o código de antes da mudança e outra com o
atual (`classic` + `drawer` gravados no storage):

1. Para cada cena (lista por prazo, quadro por status, editor aberto, painel de
   cadastros) e para claro e escuro, comparou-se o `getComputedStyle` de todos
   os elementos, propriedade a propriedade (cerca de 100 mil por cena).
   Resultado: 0 diferenças nas 8 combinações e mesma quantidade de elementos.
2. Testes (`npm run test:run`): trocar o tema aplica `data-ui-theme` e persiste;
   trocar a forma persiste; o editor e os cadastros abrem, fecham, confirmam
   saída suja e mostram conflito nos dois formatos; `Drawer` mantém os testes
   originais.

Para refazer a prova, basta guardar uma cópia de `src/` antes de mexer, montar
as duas páginas e comparar os estilos computados.

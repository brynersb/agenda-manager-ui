// demo:seed — carrega as 6 pautas de exemplo. Idempotente: rodar de novo não
// duplica nada.
//
// Roda o seed JÁ COMPILADO dentro do contêiner da API. O script `seed:dev` da
// API faz `npm run build` antes e a imagem de produção não tem o Nest CLI; o
// que ele executa depois do build é exatamente este comando.
import { compose, ensureDocker, fail } from './lib.mjs';

await ensureDocker();
const code = await compose([
  'exec',
  '-T',
  'api',
  'node',
  'dist/database/seeds/run-seed.js',
]);
if (code !== 0) {
  fail('O seed falhou. A demonstração está no ar? Suba com `npm run demo:up`.');
}

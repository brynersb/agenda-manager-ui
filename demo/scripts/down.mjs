// demo:down — para e remove os contêineres, SEM apagar os volumes (os dados
// do banco continuam guardados para o próximo demo:up).
import { compose, ensureDocker, fail } from './lib.mjs';

await ensureDocker();
const code = await compose(['down', '--remove-orphans']);
if (code !== 0) {
  fail('Não foi possível parar a demonstração.');
}
console.log(
  '\nDemonstração parada. Os dados foram mantidos (volume pauta-demo-pgdata).',
);

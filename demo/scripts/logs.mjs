// demo:logs — segue os logs da API. Aceita outro serviço como argumento:
//   npm run demo:logs -- postgres
import { compose, ensureDocker, parseArgs } from './lib.mjs';

const { rest } = parseArgs();
const service = rest[0] ?? 'api';

await ensureDocker();
const code = await compose(['logs', '-f', '--tail', '100', service]);
process.exit(code);

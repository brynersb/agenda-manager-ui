// demo:restore -- <arquivo> — restaura um backup no banco da demonstração.
// SUBSTITUI os dados atuais do banco pelos do arquivo; por isso pede
// confirmação digitada. Antes de restaurar, guarda um backup do estado atual
// (`pauta-antes-restore-...`) para dar para voltar atrás.
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

import { createBackup } from './backup.mjs';
import {
  compose,
  composeSpawn,
  confirm,
  ensureDocker,
  fail,
  isPostgresRunning,
  parseArgs,
  waitForExit,
} from './lib.mjs';

const { yes, rest } = parseArgs();
const fileArg = rest[0];

if (!fileArg) {
  fail(
    'Informe o arquivo de backup: npm run demo:restore -- demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz',
  );
}
// `npm run` executa na raiz do pacote, então caminho relativo vale a partir dela.
const file = path.resolve(fileArg);
try {
  await access(file);
} catch {
  fail(`Arquivo não encontrado: ${file}`);
}

await ensureDocker();
if (!(await isPostgresRunning())) {
  fail(
    'O Postgres da demonstração não está rodando. Suba com `npm run demo:up` e tente de novo.',
  );
}

await confirm({
  question: `ATENÇÃO: isto SUBSTITUI todos os dados atuais da demonstração pelos de:\n  ${file}\nUm backup do estado atual será guardado antes.`,
  word: 'RESTAURAR',
  yes,
});

let safetyBackup;
try {
  safetyBackup = await createBackup('pauta-antes-restore');
  console.log(`Backup do estado atual: ${safetyBackup}`);
} catch (error) {
  fail(
    `Não foi possível guardar o backup do estado atual (${error.message}). Nada foi restaurado.`,
  );
}

// A API fica parada durante o restore para não escrever no meio dele.
await compose(['stop', 'api']);

let exitCode = 1;
try {
  const child = composeSpawn(
    [
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'pauta',
      '-d',
      'pauta',
      '-v',
      'ON_ERROR_STOP=1',
      '--single-transaction',
      '--quiet',
      '-o',
      '/dev/null',
    ],
    ['pipe', 'inherit', 'inherit'],
  );
  const exit = waitForExit(child);
  const source = createReadStream(file);
  const input = file.endsWith('.gz') ? [source, createGunzip()] : [source];
  try {
    await pipeline(...input, child.stdin);
  } catch (error) {
    child.kill();
    console.error(`Falha ao enviar o arquivo ao Postgres: ${error.message}`);
  }
  exitCode = await exit;
} finally {
  await compose(['start', 'api']);
}

if (exitCode !== 0) {
  fail(
    `A restauração falhou e foi desfeita (transação única): os dados continuam como estavam. Backup de segurança: ${safetyBackup}`,
  );
}
console.log(
  '\nRestauração concluída. Aguarde alguns segundos até a API voltar (npm run demo:logs).',
);

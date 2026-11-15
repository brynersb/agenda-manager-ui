// demo:backup — gera `demo/backups/pauta-AAAA-MM-DD-HHmm.sql.gz` com um
// `pg_dump` compactado. O pg_dump e o gzip rodam DENTRO do contêiner do
// Postgres (versão 18), nunca com o cliente da máquina.
//
// O backup cobre o banco inteiro da aplicação: pautas, cadastros e usuários
// (com os hashes de senha). Não inclui o `demo/.env` (segredo de assinatura dos
// tokens): sem ele as sessões abertas caem, mas os usuários continuam válidos.
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  BACKUPS_DIR,
  composeSpawn,
  ensureDocker,
  fail,
  isMain,
  isPostgresRunning,
  timestamp,
  waitForExit,
} from './lib.mjs';

/**
 * Faz o backup e devolve o caminho do arquivo. `prefix` permite distinguir
 * backups automáticos (`pauta-antes-restore-...`) dos manuais (`pauta-...`).
 * Lança erro se o dump falhar; nunca deixa um arquivo parcial para trás.
 */
export async function createBackup(prefix = 'pauta') {
  await mkdir(BACKUPS_DIR, { recursive: true });
  const target = path.join(BACKUPS_DIR, `${prefix}-${timestamp()}.sql.gz`);
  const partial = `${target}.parcial`;

  // --clean --if-exists: o dump recria o banco por cima do atual no restore.
  // --no-owner/--no-privileges: não depende do papel que o gerou.
  const child = composeSpawn(
    [
      'exec',
      '-T',
      'postgres',
      'sh',
      '-c',
      'pg_dump -U pauta -d pauta --clean --if-exists --no-owner --no-privileges | gzip',
    ],
    ['ignore', 'pipe', 'inherit'],
  );
  const exit = waitForExit(child);
  try {
    await pipeline(child.stdout, createWriteStream(partial));
    if ((await exit) !== 0) {
      throw new Error('o pg_dump terminou com erro');
    }
    await rename(partial, target);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
  return target;
}

if (isMain(import.meta.url)) {
  await ensureDocker();
  if (!(await isPostgresRunning())) {
    fail(
      'O Postgres da demonstração não está rodando. Suba com `npm run demo:up`.',
    );
  }
  try {
    const file = await createBackup();
    const { size } = await stat(file);
    console.log(`Backup gerado: ${file} (${(size / 1024).toFixed(1)} KB)`);
    console.log(
      'Para restaurar: npm run demo:restore -- <arquivo>  (pede confirmação)',
    );
  } catch (error) {
    fail(`Não foi possível gerar o backup: ${error.message}`);
  }
}

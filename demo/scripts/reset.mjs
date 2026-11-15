// demo:reset — APAGA o volume da demonstração (banco, com pautas e usuários) e sobe
// tudo do zero. É, com o demo:restore, a única forma de perder dado: por isso
// pede confirmação digitada. Se o Postgres estiver no ar, guarda um backup
// antes.
import { createBackup } from './backup.mjs';
import {
  compose,
  confirm,
  ensureDocker,
  fail,
  isPostgresRunning,
  parseArgs,
} from './lib.mjs';
import { bringUp } from './up.mjs';

const { yes } = parseArgs();

await ensureDocker();
await confirm({
  question:
    'ATENÇÃO: isto APAGA todos os dados da demonstração (pautas, cadastros e usuários, inclusive os criados pela tela de usuários) e recria tudo do zero.',
  word: 'APAGAR',
  yes,
});

if (await isPostgresRunning()) {
  try {
    const file = await createBackup('pauta-antes-reset');
    console.log(`Backup de segurança: ${file}`);
  } catch (error) {
    console.warn(
      `Aviso: não foi possível guardar o backup de segurança (${error.message}). Seguindo com o reset confirmado.`,
    );
  }
}

// Único uso de `-v` nos scripts: remove só o volume do projeto pauta-demo.
// O demo/.env é mantido: o administrador inicial volta com a mesma senha provisória.
const code = await compose(['down', '-v', '--remove-orphans']);
if (code !== 0) {
  fail('Não foi possível apagar a demonstração.');
}
console.log('\nDados apagados. Subindo do zero...\n');
await bringUp();

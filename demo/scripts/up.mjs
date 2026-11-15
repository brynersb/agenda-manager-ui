// demo:up — builda as imagens e sobe a stack inteira, esperando todos os
// serviços ficarem saudáveis. Os dados (volumes) são preservados. Na primeira
// execução gera o `demo/.env` com os segredos da demonstração.
import {
  busyPorts,
  compose,
  ENV_FILE,
  ensureDocker,
  ensureEnvFile,
  fail,
  isMain,
  isStackRunning,
  printAccessInfo,
} from './lib.mjs';

/** Sobe a stack (com build) e imprime o endereço. Reaproveitado pelo reset. */
export async function bringUp() {
  await ensureDocker();

  if (await ensureEnvFile()) {
    console.log(
      `Segredos da demonstração gerados em ${ENV_FILE} (fora do git).\n`,
    );
  }

  if (!(await isStackRunning())) {
    const busy = await busyPorts();
    if (busy.length > 0) {
      const list = busy.map((p) => `${p.port} (${p.name})`).join(', ');
      fail(
        `Porta(s) já em uso: ${list}. Pare o que estiver usando (por exemplo \`npm run dev\`, que ocupa a 5173) e tente de novo.`,
      );
    }
  }

  const started = Date.now();
  console.log('Construindo as imagens e subindo a demonstração...\n');
  const code = await compose(['up', '-d', '--build', '--wait']);
  if (code !== 0) {
    fail(
      'Não foi possível subir a demonstração. Veja o erro acima; `npm run demo:logs` mostra os logs da API.',
    );
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\nTempo total: ${seconds} s.`);
  printAccessInfo();
}

if (isMain(import.meta.url)) {
  await bringUp();
}

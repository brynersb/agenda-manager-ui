// demo:up — builda as imagens e sobe a stack inteira, esperando todos os
// serviços ficarem saudáveis. Os dados (volumes) são preservados.
import {
  busyPorts,
  compose,
  ensureDocker,
  fail,
  isMain,
  isStackRunning,
  printAccessInfo,
} from './lib.mjs';

/**
 * O realm `master` (console admin do Keycloak) não vem com `sslRequired: none`
 * e, no Docker Desktop, o Keycloak vê o acesso como externo e recusa o login
 * com "HTTPS required". Ajusta uma vez (fica gravado no volume do Keycloak).
 * Só desenvolvimento local; se falhar, só avisa: a UI não depende disso.
 */
async function allowAdminConsoleOverHttp() {
  const code = await compose(
    [
      'exec',
      '-T',
      'keycloak',
      'sh',
      '-c',
      '/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin >/dev/null && /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE',
    ],
    { stdio: 'ignore' },
  );
  if (code !== 0) {
    console.warn(
      'Aviso: não foi possível liberar o console admin do Keycloak por HTTP (veja docs/demo.md).',
    );
  }
}

/** Sobe a stack (com build) e imprime o endereço. Reaproveitado pelo reset. */
export async function bringUp() {
  await ensureDocker();

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
  await allowAdminConsoleOverHttp();
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\nTempo total: ${seconds} s.`);
  printAccessInfo();
}

if (isMain(import.meta.url)) {
  await bringUp();
}

// Funções comuns dos scripts `demo:*`. Node puro, sem dependências: a única
// ferramenta externa é o Docker.
//
// Segurança: todo comando do Docker passa por `compose()`, que fixa o projeto
// `pauta-demo` e o arquivo da demonstração. Os contêineres e volumes da stack
// de desenvolvimento (`pauta-mkt-postgres`) nunca são alcançados por aqui.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEMO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const BACKUPS_DIR = path.join(DEMO_DIR, 'backups');
export const COMPOSE_FILE = path.join(DEMO_DIR, 'compose.demo.yaml');
export const PROJECT_NAME = 'pauta-demo';
/**
 * Segredos da demonstração (JWT e senha do administrador inicial). Gerado pelo
 * `demo:up` na primeira execução; fica fora do git e fora das imagens.
 */
export const ENV_FILE = path.join(DEMO_DIR, '.env');
export const ADMIN_EMAIL = 'admin@pauta.local';
/**
 * Senha PÚBLICA de desenvolvimento dos usuários `dev.*@pauta.local` criados
 * pelo seed da API (`seed:dev`). Não é segredo: está no `.env.example` da API.
 */
export const SEED_PASSWORD = 'dev-only-pauta-2026';

export const URLS = {
  ui: 'http://localhost:5173',
  api: 'http://localhost:3001',
};
export const PORTS = [
  { port: 5173, name: 'UI' },
  { port: 3001, name: 'API' },
];

/** Argumentos base do `docker compose` da demonstração. */
function composeArgs(args) {
  const envFile = existsSync(ENV_FILE) ? ['--env-file', ENV_FILE] : [];
  return [
    'compose',
    '-p',
    PROJECT_NAME,
    '-f',
    COMPOSE_FILE,
    ...envFile,
    ...args,
  ];
}

/**
 * Ambiente dos processos do Docker. Sem `demo/.env` (nada foi gerado ainda),
 * o compose recusaria até `down` e `logs`, que pedem os segredos só para
 * interpolar o arquivo; estes valores vazios de enchimento nunca chegam a uma
 * API de verdade, pois o `demo:up` gera o `.env` antes de subir qualquer coisa.
 */
function composeEnvironment() {
  if (existsSync(ENV_FILE)) {
    return process.env;
  }
  return {
    ...process.env,
    JWT_SECRET: 'sem-uso-ainda-nao-gerado',
    BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: 'sem-uso-ainda-nao-gerado',
  };
}

/**
 * Cria o `demo/.env` se ainda não existir, com `JWT_SECRET` aleatório (48
 * bytes) e uma senha aleatória para o administrador inicial. O arquivo é
 * gravado com permissão 0600 e nunca sobrescrito (apagá-lo não muda a senha do
 * admin já criado no banco: use `demo:reset`).
 * @returns `true` se o arquivo foi criado agora.
 */
export async function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    return false;
  }
  // base64url (A-Z a-z 0-9 - _): sem `$` nem aspas, que o compose
  // interpretaria no `.env`.
  const jwtSecret = randomBytes(48).toString('base64url');
  const adminPassword = randomBytes(18).toString('base64url');
  const content = `# Gerado por \`npm run demo:up\` em ${new Date().toISOString()}.
# SOMENTE para a demonstração local. Fora do git; não compartilhe este arquivo.
#
# Segredo de assinatura dos tokens da API (trocar derruba as sessões abertas).
JWT_SECRET=${jwtSecret}

# Administrador inicial: criado só se o banco ainda não tem usuários. A senha
# abaixo é PROVISÓRIA: o primeiro login exige trocá-la, e depois disso ela
# deixa de valer (a senha nova fica só no banco, em hash).
BOOTSTRAP_ADMIN_EMAIL=${ADMIN_EMAIL}
BOOTSTRAP_ADMIN_PASSWORD=${adminPassword}
`;
  await writeFile(ENV_FILE, content, { mode: 0o600, flag: 'wx' });
  return true;
}

/**
 * Roda `docker compose ...` herdando o terminal (saída ao vivo) e devolve o
 * código de saída. Não lança erro por código diferente de 0.
 */
export function compose(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', composeArgs(args), {
      stdio: options.stdio ?? 'inherit',
      env: composeEnvironment(),
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Roda `docker compose ...` capturando a saída padrão como texto. */
export function composeOutput(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', composeArgs(args), {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: composeEnvironment(),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/** Cria o processo `docker compose ...` com streams, para canalizar dados. */
export function composeSpawn(args, stdio) {
  return spawn('docker', composeArgs(args), {
    stdio,
    env: composeEnvironment(),
  });
}

/** Resolve com o código de saída de um processo já criado. */
export function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Confere se o Docker responde; encerra o script com mensagem clara se não. */
export async function ensureDocker() {
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('docker', ['info'], { stdio: 'ignore' });
      child.on('error', reject);
      child.on('close', resolve);
    });
    if (result === 0) {
      return;
    }
  } catch {
    // cai na mensagem abaixo
  }
  fail('O Docker não está respondendo. Abra o Docker Desktop e tente de novo.');
}

/** True se algum contêiner do projeto `pauta-demo` está rodando. */
export async function isStackRunning() {
  const { code, stdout } = await composeOutput([
    'ps',
    '--status',
    'running',
    '-q',
  ]);
  return code === 0 && stdout.trim() !== '';
}

/** True se o serviço `postgres` do projeto está rodando. */
export async function isPostgresRunning() {
  const { code, stdout } = await composeOutput([
    'ps',
    '--status',
    'running',
    '-q',
    'postgres',
  ]);
  return code === 0 && stdout.trim() !== '';
}

/** True se algo já escuta em `127.0.0.1` ou `::1` nesta porta. */
function isPortInUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = createConnection({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then(
    ([v4, v6]) => v4 || v6,
  );
}

/** Lista as portas da demonstração que já estão ocupadas por outro processo. */
export async function busyPorts() {
  const busy = [];
  for (const entry of PORTS) {
    if (await isPortInUse(entry.port)) {
      busy.push(entry);
    }
  }
  return busy;
}

/** Imprime a mensagem de erro em pt-BR e encerra com código 1. */
export function fail(message) {
  console.error(`\nERRO: ${message}`);
  process.exit(1);
}

/** Argumentos da linha de comando sem o `--yes`, mais a flag. */
export function parseArgs(argv = process.argv.slice(2)) {
  const yes = argv.includes('--yes');
  const rest = argv.filter((arg) => arg !== '--yes');
  return { yes, rest };
}

/**
 * Pede que a pessoa digite a palavra de confirmação. Sem terminal interativo
 * e sem `--yes`, recusa: scripts nunca apagam dados por omissão.
 * `--yes` existe só para testes automatizados.
 */
export async function confirm({ question, word, yes }) {
  if (yes) {
    console.log('(confirmação automática por --yes)');
    return;
  }
  if (!process.stdin.isTTY) {
    fail(
      'Este comando pede confirmação digitada e não há terminal interativo. Nada foi alterado.',
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `${question}\nDigite ${word} para continuar: `,
  );
  rl.close();
  if (answer.trim() !== word) {
    console.log('Confirmação não confere. Nada foi alterado.');
    process.exit(1);
  }
}

/** Data/hora local no formato AAAA-MM-DD-HHmm usado nos nomes de backup. */
export function timestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * Imprime onde acessar a demonstração e onde está a credencial do
 * administrador. A senha NÃO é impressa: fica só no `demo/.env` (0600), para
 * não parar no histórico do terminal nem em logs.
 */
export function printAccessInfo() {
  console.log(`
Demonstração no ar.

  UI (aplicação):  ${URLS.ui}
  API (Swagger):   ${URLS.api}/docs

Administrador inicial:
  e-mail:  ${ADMIN_EMAIL}
  senha provisória: variável BOOTSTRAP_ADMIN_PASSWORD no arquivo
    ${ENV_FILE}
  (leia com: grep BOOTSTRAP_ADMIN_PASSWORD demo/.env)
  O primeiro login exige trocar a senha; depois disso a provisória deixa de valer.

Usuários de exemplo (depois de \`npm run demo:seed\`), senha ${SEED_PASSWORD}
(senha pública de desenvolvimento, só para esta demonstração local):
  dev.admin@pauta.local   dev.editor@pauta.local   dev.leitor@pauta.local

Se o banco estiver sem pautas, carregue as 6 de exemplo:
  npm run demo:seed
`);
}

/**
 * True quando o módulo foi executado direto (`node arquivo.mjs`) e não
 * importado por outro script. Compara como URL: o caminho do projeto tem
 * espaço, que `import.meta.url` codifica como `%20`.
 */
export function isMain(metaUrl) {
  return (
    process.argv[1] !== undefined &&
    metaUrl === pathToFileURL(process.argv[1]).href
  );
}

#!/usr/bin/env bash
# Atalho para o modo demonstração em Linux/WSL (Ubuntu).
#
# Uso (a partir de qualquer pasta):
#   ./demo/demo.sh            sobe a demonstração (igual a `up`)
#   ./demo/demo.sh up         builda e sobe; na primeira vez já cria os dados de exemplo
#   ./demo/demo.sh down       para a demonstração (os dados são preservados)
#   ./demo/demo.sh status     mostra os containers da demonstração
#   ./demo/demo.sh logs       acompanha os logs da API
#   ./demo/demo.sh seed       recria/atualiza usuários e pautas de exemplo (idempotente)
#   ./demo/demo.sh backup     gera um backup do banco em demo/backups
#
# Requisitos: Docker (com o plugin `docker compose`) e Node 18 ou superior. Os
# scripts da demonstração usam só a biblioteca padrão do Node: não precisa de
# `npm install`. Este script também espera o repositório da API ao lado do da
# UI (`../pauta-mkt-api`); se estiver em outro lugar, exporte PAUTA_API_DIR.
set -euo pipefail

UI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PAUTA_API_DIR="${PAUTA_API_DIR:-$UI_DIR/../pauta-mkt-api}"
VOLUME_NAME="pauta-demo-pgdata"

erro() { echo "Erro: $*" >&2; exit 1; }

checar_requisitos() {
  command -v docker >/dev/null 2>&1 \
    || erro "Docker não encontrado. No WSL, ative a integração com o WSL no Docker Desktop (Settings > Resources > WSL integration) ou instale o Docker Engine no Ubuntu."
  docker compose version >/dev/null 2>&1 \
    || erro "O plugin 'docker compose' não está disponível (instale docker-compose-plugin)."
  docker info >/dev/null 2>&1 \
    || erro "O Docker não está respondendo. Inicie o Docker Desktop (ou 'sudo service docker start' no Docker Engine do WSL) e tente de novo."

  command -v node >/dev/null 2>&1 \
    || erro "Node não encontrado. Instale o Node 18+ (por exemplo com nvm: https://github.com/nvm-sh/nvm)."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 18 ] || erro "Node $major é antigo demais; use 18 ou superior."

  [ -d "$PAUTA_API_DIR" ] \
    || erro "Repositório da API não encontrado em '$PAUTA_API_DIR'. Clone 'pauta-mkt-api' ao lado do da UI ou exporte PAUTA_API_DIR=/caminho/da/api."

  case "$UI_DIR" in
    /mnt/*) echo "Aviso: o projeto está em $UI_DIR (disco do Windows). O build fica bem mais lento; prefira clonar dentro do home do Ubuntu (~/)." >&2 ;;
  esac
}

demo_node() { (cd "$UI_DIR" && node "demo/scripts/$1.mjs"); }

comando="${1:-up}"

case "$comando" in
  up)
    checar_requisitos
    volume_existia=1
    docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1 || volume_existia=0
    demo_node up
    if [ "$volume_existia" -eq 0 ]; then
      echo
      echo "Primeira execução: criando usuários e pautas de exemplo..."
      demo_node seed
    fi
    ;;
  down)    checar_requisitos; demo_node down ;;
  logs)    checar_requisitos; demo_node logs ;;
  seed)    checar_requisitos; demo_node seed ;;
  backup)  checar_requisitos; demo_node backup ;;
  status)
    checar_requisitos
    docker ps -a --filter "label=com.docker.compose.project=pauta-demo" \
      --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    ;;
  -h|--help|help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
  *) erro "Comando desconhecido: '$comando'. Use: up, down, status, logs, seed, backup." ;;
esac

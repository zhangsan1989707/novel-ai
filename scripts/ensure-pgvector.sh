#!/bin/bash

set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"
SERVICE_NAME="${PGVECTOR_SERVICE_NAME:-db}"
DB_USER="${POSTGRES_USER:-novelai}"
DB_NAME="${POSTGRES_DB:-novel_ai}"
RETRIES="${PGVECTOR_RETRIES:-30}"
SLEEP_SECONDS="${PGVECTOR_SLEEP_SECONDS:-2}"

info() {
  echo "ℹ️  $1"
}

warn() {
  echo "⚠️  $1" >&2
}

fail() {
  echo "❌ $1" >&2
  exit 1
}

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  fail "未找到 docker compose 或 docker-compose，无法检查 pgvector"
fi

info "检查数据库服务并启用 pgvector（compose: ${COMPOSE_FILE}）..."

attempt=1
while [ "$attempt" -le "$RETRIES" ]; do
  if "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    if "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -Atqc "SELECT 1 FROM pg_available_extensions WHERE name = 'vector';" | grep -q 1; then
      "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null
      info "pgvector 已启用"
      exit 0
    fi

    warn "当前数据库镜像未提供 pgvector 扩展，请确认 db 服务已切到 pgvector/pgvector 镜像。"
    exit 0
  fi

  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

fail "数据库未在限定时间内就绪，无法启用 pgvector"

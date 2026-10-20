#!/bin/bash
# Sesja chmurowa agenta: zależności npm i lokalny klaster Postgres (Docker tu nie działa).
# Tworzy rolę `byw` oraz bazy `byw_dev` i `byw_test` zgodne z `.env.example` i `.env.test`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund

read -r pg_version pg_cluster pg_port pg_status _ < <(pg_lsclusters --no-header | head -n 1)
if [ -z "${pg_version:-}" ]; then
  echo "Brak klastra Postgres w kontenerze." >&2
  exit 1
fi
if [ "$pg_port" != "5432" ]; then
  echo "Klaster Postgres $pg_version/$pg_cluster nasłuchuje na porcie $pg_port, oczekiwano 5432." >&2
  exit 1
fi
if [ "$pg_status" != "online" ]; then
  pg_ctlcluster "$pg_version" "$pg_cluster" start
fi
for _ in $(seq 1 30); do
  pg_isready -q -h localhost -p 5432 && break
  sleep 1
done
pg_isready -h localhost -p 5432

as_postgres() {
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -tAq "$@"
}

if [ -z "$(as_postgres -c "select 1 from pg_roles where rolname = 'byw'")" ]; then
  as_postgres -c "create role byw login password 'byw'"
fi
for db in byw_dev byw_test; do
  if [ -z "$(as_postgres -c "select 1 from pg_database where datname = '$db'")" ]; then
    as_postgres -c "create database $db owner byw"
  fi
done

if [ ! -f .env ]; then
  cp .env.example .env
fi

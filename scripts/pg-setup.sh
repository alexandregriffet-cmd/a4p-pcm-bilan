#!/usr/bin/env bash
# Initialise un cluster PostgreSQL temporaire et applique la simulation Supabase puis le schema (deux fois).
# Usage : scripts/pg-setup.sh /chemin/dossier-temporaire [port]
set -euo pipefail
DIR="${1:?dossier temporaire requis}"
PORT="${2:-54329}"
BIN=/usr/lib/postgresql/16/bin
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -d "$DIR/data" ]; then
  mkdir -p "$DIR"
  chown postgres "$DIR" 2>/dev/null || true
  su postgres -c "$BIN/initdb -D $DIR/data -A trust -U postgres >/dev/null"
fi
if ! su postgres -c "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
  su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/pg.log -w start" >/dev/null
fi
export PGHOST="$DIR" PGPORT="$PORT" PGUSER=postgres
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists bilan" -c "create database bilan"
psql -v ON_ERROR_STOP=1 -q -d bilan -f "$ROOT/supabase/tests/00-simulation-supabase.sql"
echo "== schema.sql, premiere execution"
psql -v ON_ERROR_STOP=1 -q -d bilan -f "$ROOT/supabase/schema.sql"
echo "== schema.sql, deuxieme execution (idempotence)"
psql -v ON_ERROR_STOP=1 -q -d bilan -f "$ROOT/supabase/schema.sql"
echo "OK : schema applique deux fois sans erreur"

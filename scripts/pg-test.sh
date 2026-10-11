#!/usr/bin/env bash
# Rejoue le schema deux fois puis les tests de securite. Usage : scripts/pg-test.sh /var/tmp/a4p-pgbilan
set -euo pipefail
DIR="${1:?dossier temporaire requis}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/pg-setup.sh" "$DIR" 2>&1 | grep -v NOTICE
export PGHOST="$DIR" PGPORT="${2:-54329}" PGUSER=postgres
psql -d bilan -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/01-security.sql" 2>&1 | grep -v NOTICE

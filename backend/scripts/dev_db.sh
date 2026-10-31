#!/usr/bin/env bash
# Manage the project-local PostgreSQL 18 cluster used for development.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/18/bin}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/.pgdata"
PORT="${PGPORT:-5432}"
SOCKET_DIR="${PGSOCKET:-/tmp}"

start() {
  if "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    echo "PostgreSQL already running on port $PORT."
    return
  fi
  "$PGBIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" \
    -o "-p $PORT -k $SOCKET_DIR -c listen_addresses=127.0.0.1" start
}

stop() {
  "$PGBIN/pg_ctl" -D "$DATA" stop || true
}

status() {
  "$PGBIN/pg_ctl" -D "$DATA" status || true
}

init() {
  if [ -d "$DATA" ]; then
    echo "$DATA already initialised."
    return
  fi
  printf 'aegis' > /tmp/aegis-pgpw
  "$PGBIN/initdb" -D "$DATA" -U aegis \
    --auth-local=trust --auth-host=scram-sha-256 \
    --pwfile=/tmp/aegis-pgpw --encoding=UTF8
  start
  "$PGBIN/createdb" -h "$SOCKET_DIR" -p "$PORT" -U aegis aegis
}

case "${1:-start}" in
  init) init ;;
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *) echo "usage: $0 {init|start|stop|restart|status}"; exit 1 ;;
esac

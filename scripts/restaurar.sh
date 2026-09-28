#!/usr/bin/env bash
# Restaura un backup hecho con scripts/backup.sh. REEMPLAZA los datos actuales.
#
#   bash scripts/restaurar.sh backups/2026-09-25_0300
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=${1:?"Indicá la carpeta del backup, por ejemplo: bash scripts/restaurar.sh backups/2026-09-25_0300"}
[ -f "$DIR/base.dump" ] || { echo "No encuentro $DIR/base.dump" >&2; exit 1; }

if [ "${CONFIRMAR:-}" != "SI" ]; then
  read -rp "Esto reemplaza TODOS los pedidos, usuarios y archivos actuales por los del backup. Escribí SI para seguir: " ok
  [ "$ok" = "SI" ] || { echo "Cancelado."; exit 1; }
fi

echo "==> Deteniendo la aplicación"
docker compose stop app

echo "==> Restaurando la base de datos"
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$DIR/base.dump"

if [ -f "$DIR/archivos.tar.gz" ]; then
  echo "==> Restaurando archivos subidos"
  docker compose run --rm --no-deps -T app sh -c 'rm -rf /app/uploads/* && tar -xzf - -C /app' < "$DIR/archivos.tar.gz"
fi

echo "==> Levantando la aplicación"
docker compose start app
echo "Restauración terminada."

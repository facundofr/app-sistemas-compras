#!/usr/bin/env bash
# Copia de seguridad de la base de datos y de los archivos subidos.
#
#   bash scripts/backup.sh
#
# Deja todo en backups/AAAA-MM-DD_HHMM/ y conserva los últimos 14.
# Para hacerlo todas las noches a las 3 (crontab -e):
#   0 3 * * * cd /ruta/al/proyecto && bash scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

DESTINO="backups/$(date +%F_%H%M)"
mkdir -p "$DESTINO"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$DESTINO/base.dump"
docker compose exec -T app tar -czf - -C /app uploads > "$DESTINO/archivos.tar.gz"

# Rotación: solo los 14 más recientes.
ls -1dt backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "Backup guardado en $DESTINO ($(du -sh "$DESTINO" | cut -f1))"

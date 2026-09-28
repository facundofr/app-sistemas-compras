#!/usr/bin/env bash
# Instalación en un VPS Linux (Ubuntu/Debian). Desde la carpeta del proyecto:
#
#   sudo bash scripts/instalar.sh
#
# Instala Docker si falta, genera el .env con contraseñas aleatorias y levanta todo.
# Se puede volver a correr sin problema: no pisa un .env existente.
set -euo pipefail
cd "$(dirname "$0")/.."

aleatorio() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker (script oficial de get.docker.com)..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Falta el plugin 'docker compose'. Instalalo y volvé a correr este script." >&2
  exit 1
fi

ADMIN_PASS_GENERADA=""
if [ ! -f .env ]; then
  echo
  echo "==> Configuración inicial"
  read -rp "Dominio (ej: miplancober.com). Dejalo vacío para entrar por la IP con HTTP: " DOMINIO
  read -rp "Email del administrador: " ADMIN_EMAIL
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@pedidos.local}
  ADMIN_PASS_GENERADA=$(aleatorio 8)
  cat > .env <<EOF
DOMAIN=${DOMINIO:-:80}
POSTGRES_USER=pedidos
POSTGRES_PASSWORD=$(aleatorio 24)
POSTGRES_DB=pedidos
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASS_GENERADA
ADMIN_NOMBRE=Administrador
EOF
  chmod 600 .env
  echo "    .env creado."
else
  echo "==> Ya existe un .env: se usa tal cual."
fi

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "==> Abriendo puertos 80 y 443 en el firewall (ufw)"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
fi

echo "==> Construyendo y levantando los contenedores (la primera vez tarda unos minutos)..."
docker compose up -d --build

echo "==> Esperando a que la aplicación responda..."
for _ in $(seq 1 60); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/asistente-sistemas/api/health >/dev/null 2>&1; then
    LISTO=1
    break
  fi
  sleep 2
done

DOMINIO_ACTUAL=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)
if [ "$DOMINIO_ACTUAL" = ":80" ] || [ -z "$DOMINIO_ACTUAL" ]; then
  URL="http://$(hostname -I 2>/dev/null | awk '{print $1}')/asistente-sistemas"
else
  URL="https://$DOMINIO_ACTUAL/asistente-sistemas"
fi

echo
if [ "${LISTO:-0}" = "1" ]; then
  echo "Listo. Entrá a: $URL"
else
  echo "La app todavía no responde. Revisá los logs con:  docker compose logs -f app"
fi
if [ -n "$ADMIN_PASS_GENERADA" ]; then
  echo
  echo "  Usuario administrador:  $(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2-)"
  echo "  Contraseña inicial:     $ADMIN_PASS_GENERADA"
  echo "  (Cambiala desde «Cambiar contraseña» después de entrar.)"
fi

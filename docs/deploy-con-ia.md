# Deploy en un VPS — guía para un agente de IA

Esta guía está escrita para que la ejecute un agente de IA con acceso a una terminal (por ejemplo Claude Code), paso a paso y verificando cada resultado. También sirve para una persona.

## Para la persona: cómo pedírselo a la IA

1. Dejá lista la conexión SSH al VPS **con clave** (no con contraseña): que `ssh usuario@IP` entre sin preguntar nada.
2. Si vas a usar dominio, creá un registro **A** del dominio apuntando a la IP del VPS.
3. Abrí el agente en la carpeta del proyecto y pegale esto, completando los datos:

```text
Desplegá esta app en mi VPS siguiendo docs/deploy-con-ia.md al pie de la letra.
- SSH: usuario@IP-DEL-VPS
- Dominio: miplancober.com   (o "sin dominio"; la app queda en /asistente-sistemas)
- Email del administrador: admin@miempresa.com
- Carpeta en el VPS: /opt/pedidos-sistemas
- Código: subilo desde esta carpeta   (o: git clone <url del repo>)
Antes de cada paso que modifique el servidor, decime qué vas a hacer.
```

---

## Para el agente: reglas

**Prohibido** (aunque parezca que arregla algo):
- `docker compose down -v`, `docker volume rm`, `docker system prune --volumes` o borrar `/var/lib/docker`: **borran la base de datos y los archivos**.
- Cambiar `POSTGRES_PASSWORD` en un `.env` que ya se usó: Postgres guarda la contraseña en el volumen la primera vez, y cambiarla después rompe la conexión (ver [Problemas frecuentes](#problemas-frecuentes)).
- Publicar los puertos 5432 (base) o 3000 (app) a internet. Al público se sale solo por Caddy (80/443).
- Pisar un `.env` existente, o subir o commitear `.env`.
- Escribir contraseñas en comandos que queden en logs compartidos, o pedir contraseñas en el chat.

**Pedir confirmación antes de:**
- Instalar paquetes.
- Activar el firewall.
- Detener servicios que ya ocupen los puertos 80/443.
- Restaurar un backup.
- Cualquier acción que no esté en esta guía.

**Cómo trabajar:**
- Todo comando remoto va por `ssh -o BatchMode=yes usuario@IP '...'`, para que falle en vez de quedarse esperando una respuesta.
- En cada paso, compará la salida con lo **Esperado**. Si no coincide, andá a **Si falla** y no sigas hasta resolverlo.
- Las variables `IP`, `USUARIO`, `DOMINIO`, `ADMIN_EMAIL` y `DIR` salen de lo que pasó la persona. Sin dominio, `DOMINIO=:80`.
- Los comandos usan `sudo`. Si el usuario es `root` y `sudo` no está instalado (pasa en algunos Debian mínimos), quitalo de los comandos.

---

## Paso 1 — Verificar el acceso y el servidor

```bash
ssh -o BatchMode=yes USUARIO@IP 'cat /etc/os-release | head -3; uname -m; nproc; free -m; df -h /; sudo -n true && echo SUDO_OK'
```

**Esperado:**
- Ubuntu 22.04/24.04 o Debian 12, arquitectura `x86_64` o `aarch64`.
- 5 GB libres o más en `/`.
- `SUDO_OK` (o que el usuario sea `root`).

**Si falla:**
- *Permission denied*: la clave SSH no está configurada. Pedile a la persona que la configure y detenete.
- Otro sistema operativo: avisá antes de seguir; los pasos asumen `apt`.

Anotá la RAM (`free -m`, columna *total*): la vas a necesitar en el paso 3.

## Paso 2 — Verificar puertos y DNS

```bash
ssh -o BatchMode=yes USUARIO@IP 'sudo ss -tlnp | grep -E ":(80|443) " || echo PUERTOS_LIBRES; curl -4 -s https://ifconfig.me; echo'
```

Si hay dominio, verificalo **desde el VPS**:

```bash
ssh -o BatchMode=yes USUARIO@IP 'getent hosts DOMINIO'
```

**Esperado:**
- `PUERTOS_LIBRES`.
- La IP que devuelve `getent` es la misma que devolvió `ifconfig.me`.

**Si falla:**
- *Los puertos 80/443 están ocupados* (nginx, apache, otro Caddy): **detenete y consultá**. No los apagues por tu cuenta, puede haber otros sitios en ese servidor.
- *El dominio ya muestra otro sitio* (probá `curl -sI https://DOMINIO/`): el Caddyfile manda todo el dominio a esta app y redirige la raíz a `/asistente-sistemas`. Si la raíz tiene que seguir mostrando ese otro sitio, **detenete y consultá**: hay que integrar la ruta `/asistente-sistemas` en el servidor que ya lo publica, o usar un subdominio.
- *El dominio no resuelve o apunta a otra IP*: seguí con `DOMINIO=:80`, avisale a la persona que falta el DNS, y cambiá el dominio en el paso 9 cuando esté listo. Si Caddy intenta sacar el certificado sin DNS, Let's Encrypt lo bloquea por un rato.

## Paso 3 — Swap (solo si la RAM es menor a 2 GB)

Compilar la imagen necesita memoria. Con 1 GB, la compilación puede morir sin mensaje claro.

```bash
ssh -o BatchMode=yes USUARIO@IP 'swapon --show | grep -q . && echo YA_HAY_SWAP || (sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab && echo SWAP_CREADO)'
```

**Esperado:** `YA_HAY_SWAP` o `SWAP_CREADO`.

## Paso 4 — Instalar Docker

```bash
ssh -o BatchMode=yes USUARIO@IP 'docker compose version 2>/dev/null || (curl -fsSL https://get.docker.com | sudo sh && docker compose version)'
```

**Esperado:** `Docker Compose version v2.x` o superior.

Si `USUARIO` no es `root`, dale permiso para usar Docker sin `sudo`. Cada `ssh` nuevo ya toma el grupo:

```bash
ssh -o BatchMode=yes USUARIO@IP '[ "$(id -u)" = 0 ] || sudo usermod -aG docker "$(whoami)"'
ssh -o BatchMode=yes USUARIO@IP 'docker ps >/dev/null && echo DOCKER_OK'
```

**Esperado:** `DOCKER_OK`.

**Si falla:** revisá la salida del script de get.docker.com (suele ser un problema de red o un sistema operativo no soportado) y consultá.

## Paso 5 — Llevar el código al VPS

**Opción A — con repositorio git:**

```bash
ssh -o BatchMode=yes USUARIO@IP 'sudo mkdir -p DIR && sudo chown $(id -u):$(id -g) DIR && git clone URL_DEL_REPO DIR'
```

**Opción B — desde la carpeta local** (sirve también en Windows con Git Bash). Ejecutá esto en la **máquina local**, dentro de la carpeta del proyecto:

```bash
tar -czf /tmp/pedidos.tgz --exclude=node_modules --exclude=.next --exclude=.git --exclude=uploads --exclude=backups --exclude=.env --exclude=.env.local .
scp /tmp/pedidos.tgz USUARIO@IP:/tmp/pedidos.tgz
ssh -o BatchMode=yes USUARIO@IP 'sudo mkdir -p DIR && sudo chown $(id -u):$(id -g) DIR && tar -xzf /tmp/pedidos.tgz -C DIR && rm /tmp/pedidos.tgz'
rm /tmp/pedidos.tgz
```

> En Git Bash para Windows, si un comando `docker ... /app` falla con una ruta tipo `C:/Program Files/Git/app`, anteponé `MSYS_NO_PATHCONV=1`. En el VPS esto no pasa.

**Esperado:**

```bash
ssh -o BatchMode=yes USUARIO@IP 'ls DIR'
# Tiene que listar: Dockerfile  docker-compose.yml  Caddyfile  drizzle  scripts  src  package.json ...
```

## Paso 6 — Crear el `.env`

Primero verificá que **no exista** (si existe, no lo toques y saltá al paso 7):

```bash
ssh -o BatchMode=yes USUARIO@IP 'test -f DIR/.env && echo YA_EXISTE || echo NO_EXISTE'
```

Si no existe, crealo con contraseñas aleatorias. Usá solo hexadecimal: van dentro de una URL de conexión y caracteres como `@`, `/` o `:` la rompen.

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && umask 077 && cat > .env <<EOF
DOMAIN=DOMINIO
POSTGRES_USER=pedidos
POSTGRES_PASSWORD=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d " \n")
POSTGRES_DB=pedidos
ADMIN_EMAIL=ADMIN_EMAIL
ADMIN_PASSWORD=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d " \n")
ADMIN_NOMBRE=Administrador
EOF
grep -c = .env'
```

**Esperado:** `7`. No imprimas el contenido del `.env` en el chat: tiene las contraseñas.

| Variable | Para qué |
|---|---|
| `DOMAIN` | Dominio público (Caddy saca el HTTPS solo) o `:80` para HTTP por IP |
| `POSTGRES_*` | Credenciales de la base (red interna, no expuesta) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` | Primer administrador. Solo se usan cuando la base no tiene usuarios |
| `COOKIE_SECURE` | Opcional. Por defecto la cookie es `Secure` cuando se entra por HTTPS |
| `APP_PORT` | Opcional. Puerto local de la app, solo escucha en 127.0.0.1 (por defecto 3000) |

## Paso 7 — Firewall (solo si `ufw` está activo)

```bash
ssh -o BatchMode=yes USUARIO@IP 'sudo ufw status | head -1'
```

- Si dice `Status: active`, abrí los puertos web **sin tocar SSH**:

```bash
ssh -o BatchMode=yes USUARIO@IP 'sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw status'
```

- Si dice `inactive`, **no lo actives** sin consultar: te podés dejar afuera.
- Recordale a la persona que el firewall del proveedor (panel de Hetzner, DigitalOcean, AWS Security Group, etc.) también tiene que permitir 80 y 443.

## Paso 8 — Construir y levantar

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && docker compose up -d --build 2>&1 | tail -20'
```

La primera vez tarda entre 3 y 10 minutos: descarga imágenes y compila la app. Si la herramienta tiene un tiempo máximo por comando, usá uno de 15 minutos o más, o corré el build en segundo plano.

**Esperado:** termina sin `ERROR` y los tres contenedores quedan `Started`.

**Si falla:**
- *Killed*, *exit code 137* o *JavaScript heap out of memory*: falta RAM. Hacé el paso 3 y reintentá.
- *npm error* o problemas de red: reintentá una vez; si persiste, mostrá el error.
- *port is already allocated*: volvé al paso 2.

## Paso 9 — Verificar

**9.1 Contenedores** (esperá unos 40 s después del paso 8):

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && docker compose ps --format "{{.Service}}: {{.Status}}"'
```

**Esperado:** `db: Up ... (healthy)`, `app: Up ... (healthy)`, `caddy: Up ...`.

**9.2 Arranque de la app:**

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && docker compose logs app | grep -E "bootstrap|Error" | tail -15'
```

**Esperado:** líneas `[bootstrap] Usuario administrador creado: ...` y `[bootstrap] Lista «...» cargada ...`. En un redeploy no aparecen, porque ya existen, y está bien.

**9.3 La app responde:**

```bash
ssh -o BatchMode=yes USUARIO@IP 'curl -fsS http://127.0.0.1:3000/asistente-sistemas/api/health'
```

**Esperado:** `{"ok":true}`.

**9.4 Desde afuera** (ejecutalo en la máquina local):

```bash
# Con dominio:
curl -sS -o /dev/null -w "%{http_code}\n" https://DOMINIO/asistente-sistemas/login
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" http://DOMINIO/
# Sin dominio:
curl -sS -o /dev/null -w "%{http_code}\n" http://IP/asistente-sistemas/login
```

**Esperado:**
- Con dominio: `200` en `/login`, y `308` hacia `https://...` al entrar por http.
- Sin dominio: `200` en `/login`.

**Si falla el HTTPS:**

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && docker compose logs caddy | grep -iE "certificate|error" | tail -10'
```

- Debe aparecer `certificate obtained successfully`.
- Si aparecen errores de *challenge* o *DNS*, casi siempre el dominio no apunta al VPS o el puerto 80 está cerrado en el firewall del proveedor.

## Paso 10 — Entregar el acceso

Leé la contraseña inicial del admin y pasásela a la persona **directamente en la respuesta**, no en archivos ni en commits:

```bash
ssh -o BatchMode=yes USUARIO@IP 'grep -E "^ADMIN_(EMAIL|PASSWORD)=" DIR/.env'
```

Decile que:
1. Entre a `https://DOMINIO/asistente-sistemas` (o `http://IP/asistente-sistemas`) con ese email y esa contraseña.
2. La cambie desde «Cambiar contraseña» (menú de usuario, abajo a la izquierda).
3. Cree los usuarios del equipo desde **Usuarios** y revise las opciones de **Listas de opciones**.

## Paso 11 — Backup automático (recomendado)

Con autorización de la persona:

```bash
ssh -o BatchMode=yes USUARIO@IP '(crontab -l 2>/dev/null | grep -v "scripts/backup.sh"; echo "0 3 * * * cd DIR && bash scripts/backup.sh >> backups/backup.log 2>&1") | crontab - && crontab -l'
```

Hacé uno a mano para verificar:

```bash
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && bash scripts/backup.sh'
```

**Esperado:** `Backup guardado en backups/AAAA-MM-DD_HHMM (...)`.

Recordale a la persona que conviene copiar `backups/` fuera del VPS.

---

## Actualizar a una versión nueva

```bash
# 1. Backup antes de actualizar
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && bash scripts/backup.sh'
# 2. Código nuevo: git pull (opción A) o repetir el paso 5, opción B (no pisa .env ni los volúmenes)
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && git pull'
# 3. Reconstruir; las migraciones de base se aplican solas al arrancar
ssh -o BatchMode=yes USUARIO@IP 'cd DIR && docker compose up -d --build 2>&1 | tail -5'
```

Después repetí el **paso 9**. Si la app no arranca por un error de migración (`docker compose logs app`), **no borres volúmenes**: mostrá el error y ofrecé restaurar el backup del paso 1 con `bash scripts/restaurar.sh backups/<carpeta>`.

### Servicios opcionales (email, push, Mercado Libre, S3, Sentry)

Se activan agregando variables al `.env` (ver la lista comentada en [`.env.example`](../.env.example)). Reglas:

- **Agregá** las líneas nuevas al final del `.env` existente (`cat >> .env`); nunca lo pises ni cambies `POSTGRES_PASSWORD`.
- Los valores los da la persona (contraseñas de SMTP, claves de Mercado Libre o S3): pedíselos, no los inventes, y no los imprimas en el chat.
- Las claves push se generan una sola vez en el VPS: `docker compose exec app npx --yes web-push generate-vapid-keys`. Si se regeneran, cada usuario tiene que volver a activar los avisos.
- Después: `docker compose up -d` (no hace falta `--build`) y verificá en la app, en **Administración → Integraciones**, que figuren activos.
- Si se activa S3 en una instalación con archivos, copiá los existentes: `docker compose exec app node scripts/migrar-archivos-s3.mjs`. No borres el volumen `uploads` hasta que la persona confirme que los archivos viejos se abren bien.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `app` reinicia en bucle; logs con `password authentication failed` | Se cambió `POSTGRES_PASSWORD` después de la primera instalación | Volver a poner la contraseña original en `.env`. Si se perdió, consultar (hay que cambiarla dentro de Postgres con `ALTER USER`) |
| Build con `Killed` o código 137 | Poca RAM | Paso 3 (swap) |
| HTTPS no funciona, HTTP sí | DNS no apunta al VPS, o el puerto 80/443 está cerrado en el proveedor | Revisar DNS y firewall; `docker compose logs caddy` |
| Error 413 al subir archivos | Proxy extra delante de Caddy (Cloudflare, nginx) con límite bajo | Subir su límite a 100 MB, o sacar ese proxy |
| El admin no puede entrar u olvidó la contraseña | — | `docker compose exec app node scripts/usuario.mjs EMAIL NUEVA_CLAVE` (mínimo 8 caracteres) |
| Después de ingresar vuelve al login | Se entra por HTTP (sin dominio) con `COOKIE_SECURE=true`: el navegador descarta la cookie `Secure` | Quitar `COOKIE_SECURE` del `.env` o usar HTTPS; después `docker compose up -d` |
| Al guardar un formulario falla, y los logs dicen `Invalid Server Actions request` o que `x-forwarded-host` no coincide con `origin` | Hay otro proxy delante de Caddy que cambia el `Host` | Que ese proxy pase el `Host` original, o agregar el dominio público en `experimental.serverActions.allowedOrigins` de `next.config.ts` |
| No aparecen opciones nuevas en los desplegables | Las listas solo se precargan si están vacías | Cargarlas desde **Listas de opciones** |

## Comandos de referencia

```bash
cd DIR
docker compose ps                         # estado
docker compose logs -f app                # logs de la app (Ctrl+C para salir)
docker compose restart app                # reiniciar la app
docker compose exec db psql -U pedidos -d pedidos     # consola SQL
docker compose exec app node scripts/usuario.mjs EMAIL CLAVE [rol] [nombre]   # crear usuario o resetear contraseña
bash scripts/backup.sh                    # backup
bash scripts/restaurar.sh backups/<carpeta>  # restaurar (reemplaza todo)
```

Cómo se guardan los datos: [docs/datos.md](datos.md).

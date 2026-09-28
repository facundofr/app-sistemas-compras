# Pedidos Sistemas — Grupo Cober

Aplicación web para el circuito de compras del equipo de Sistemas: **Sistemas carga el pedido, Compras lo cotiza y lo compra, y todos ven en qué etapa está**, con las facturas, imágenes y el historial de cada pedido.

- **Frontend y backend:** Next.js 16 (App Router, Server Actions) + React 19 + shadcn/ui + Tailwind v4, con tema claro/oscuro.
- **Base de datos:** PostgreSQL 17, con Drizzle ORM. Las migraciones se aplican solas al arrancar.
- **Archivos:** las imágenes y los PDF se guardan en disco, en un volumen de Docker. Solo los usuarios con sesión iniciada pueden verlos.
- **Despliegue:** Docker Compose con base de datos, aplicación y Caddy, que saca y renueva el HTTPS automáticamente.

## Documentación

- [docs/datos.md](docs/datos.md): cómo y dónde se guardan los datos, qué se guarda en cada tabla, qué no se guarda, y backups.
- [docs/deploy-con-ia.md](docs/deploy-con-ia.md): el deploy en un VPS paso a paso, escrito para que lo ejecute un agente de IA (o una persona).

## Qué hace

| Pantalla | Quién la ve | Para qué |
|---|---|---|
| **Nuevo pedido** | Todos | Los campos del formulario de Google: fecha de pedido, solicitante del sector, sector que solicitó la compra, nombre y apellido del solicitante, facturar por (o NA), domicilio de entrega (Cramer 1652, Av Los Incas 3536 u otro), prioridad, producto, cantidad, link, presupuesto pedido por el sector (hasta 5 archivos: imágenes, PDF, Excel o Word) y comentarios. Precarga los datos del último pedido del usuario. |
| **Pedidos / Estado de pedidos** | Todos | Alertas de pedidos trabados según prioridad (Urgente 1 día, Alta 3, Media 5, Baja 7), conteo por etapa, filtros por texto, estado, empresa y prioridad, y exportación a Excel. Se actualiza sola cada 30 s. |
| **Detalle del pedido** | Todos | Riel de etapas (Solicitado → Cotizando → Comprando → Entregado), datos del pedido, datos de compra (proveedor, CUIT, fechas, seguimiento, medio de pago, cuotas, importe, factura), imágenes, factura adjunta, historial completo, y acciones para cancelar, reactivar o eliminar. |
| **Compras efectuadas** | Todos | Todo lo comprado, con totales, ticket promedio y compras sin factura. Filtros por fechas, empresa, medio de pago y texto. Exporta a Excel. |
| **Reportes** | Compras y Admin | Gasto por mes, por empresa, por proveedor y por medio de pago, y días promedio del pedido a la entrega. |
| **Usuarios** | Admin | Alta de usuarios, rol, activar/desactivar y cambio de contraseña. |
| **Listas de opciones** | Admin | Las opciones de los desplegables (solicitantes, empresas, domicilios, medios de compra y de pago, tipos de factura), editables sin tocar código. |
| **Mi cuenta** | Todos | Cambiar la propia contraseña. |

### Roles

- **Equipo Sistemas:** carga pedidos, puede editar los suyos mientras sigan en «Solicitado», cancelarlos y confirmar la entrega cuando Compras ya compró.
- **Compras:** gestiona todos los pedidos: mueve las etapas, carga los datos de compra y la factura, y ve los reportes.
- **Administrador:** todo lo anterior, más usuarios, listas de opciones y eliminar pedidos.

Los permisos se validan en el servidor, en cada acción; ocultar un botón en pantalla no alcanza.

---

## Despliegue en un VPS

Requisitos: un VPS Linux (Ubuntu 22.04/24.04 o Debian 12) con 1 GB de RAM o más y acceso por SSH como root o con sudo. Si vas a usar un dominio, creá un registro **A** que apunte a la IP del VPS.

### Opción rápida (script)

```bash
# 1. Subir el proyecto al VPS (con git o copiando la carpeta)
git clone <url-de-tu-repo> /opt/pedidos-sistemas
cd /opt/pedidos-sistemas

# 2. Instalar y levantar
sudo bash scripts/instalar.sh
```

El script:
1. Instala Docker si no está.
2. Te pregunta el dominio y el email del administrador.
3. Genera el `.env` con contraseñas aleatorias.
4. Abre los puertos 80 y 443 si usás `ufw`.
5. Levanta todo.

Al terminar te muestra la URL y la **contraseña inicial del administrador**.

> Sin dominio todavía: dejá el dominio vacío y entrá por `http://IP-DEL-VPS/asistente-sistemas`. Cuando tengas el dominio, cambiá `DOMAIN=` en `.env` y corré `docker compose up -d`.

### Opción manual

```bash
cp .env.example .env
nano .env                       # completá DOMAIN, POSTGRES_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```

Usá contraseñas con letras y números (sin `@`, `/` ni `:`), porque se arma una URL de conexión con ellas.

### Actualizar a una versión nueva

```bash
cd /opt/pedidos-sistemas
git pull
docker compose up -d --build
```

Las migraciones de base de datos se aplican solas. Los datos y archivos quedan en volúmenes de Docker y no se tocan.

### Comandos útiles

```bash
docker compose ps                     # estado de los contenedores
docker compose logs -f app            # logs de la aplicación
docker compose restart app            # reiniciar la app

# Crear un usuario o resetear una contraseña (p. ej. si el admin se la olvidó)
docker compose exec app node scripts/usuario.mjs admin@empresa.com NuevaClave123
docker compose exec app node scripts/usuario.mjs juan@empresa.com Clave12345 compras Juan Pérez
```

### Backups

```bash
bash scripts/backup.sh                                # base de datos + archivos → backups/AAAA-MM-DD_HHMM/
bash scripts/restaurar.sh backups/2026-09-25_0300     # restaura (pide confirmación)
```

Para un backup automático todas las noches, agregá esto con `crontab -e`:

```
0 3 * * * cd /opt/pedidos-sistemas && bash scripts/backup.sh >> backups/backup.log 2>&1
```

Conservá una copia de `backups/` fuera del VPS (por ejemplo con `rsync` a otra máquina o un bucket).

---

## Correr todo en tu PC igual que en producción

Con Docker Desktop abierto, desde la carpeta del proyecto:

```bash
cp .env.example .env     # y en .env poné DOMAIN=:80 (más las contraseñas que quieras)
docker compose up -d --build
```

Entrás en **http://localhost/asistente-sistemas**. Para apagarlo sin perder datos:

```bash
docker compose stop
```

Para volver a prenderlo:

```bash
docker compose start
```

## Desarrollo local

Para modificar el código con recarga automática. Requisitos: Node 20.9+ y Docker.

```bash
npm install
npm run db:up        # PostgreSQL de desarrollo en el puerto 5433
```

Creá `.env.local`:

```
DATABASE_URL=postgres://pedidos:pedidos@localhost:5433/pedidos
ADMIN_EMAIL=admin@pedidos.local
ADMIN_PASSWORD=admin12345
UPLOAD_DIR=./uploads
```

```bash
npm run dev          # http://localhost:3000/asistente-sistemas — crea las tablas y el admin al arrancar
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run db:generate` | Genera una migración nueva después de cambiar `src/db/schema.ts` |
| `npm run db:studio` | Abre Drizzle Studio para mirar la base |
| `npm run usuario -- <email> <clave> [rol] [nombre]` | Crea un usuario o resetea su contraseña |
| `npm run typecheck` / `npm run lint` | Chequeos de tipos y lint |

## Estructura

```
src/
  app/
    login/                 Pantalla de ingreso
    (app)/                 Todo lo que requiere sesión (barra lateral + contenido)
      pedidos/             Listado, nuevo pedido y detalle [id]
      compras/             Compras efectuadas
      reportes/            Gráficos de gasto
      admin/               Usuarios y listas de opciones
      perfil/              Cambio de contraseña
    api/archivos/[id]      Descarga de adjuntos (con control de sesión)
    api/exportar           Exportación a Excel
    api/health             Chequeo de salud para Docker
  actions/                 Server Actions (crear, editar, cambiar etapa, usuarios...)
  db/                      Esquema, conexión y arranque (migraciones + admin inicial)
  lib/                     Sesiones, permisos, consultas, archivos, formatos
  components/              UI (shadcn/ui en components/ui)
drizzle/                   Migraciones SQL
scripts/                   instalar.sh, backup.sh, restaurar.sh, usuario.mjs
```

## Seguridad

- Contraseñas con `scrypt`. Las sesiones se guardan en la base (la cookie lleva un token aleatorio, httpOnly) y se cierran al desactivar un usuario o cambiarle la contraseña.
- Límite de intentos de ingreso por IP y email.
- Los archivos subidos se validan por su contenido real (JPG, PNG, WEBP, GIF o PDF, hasta 10 MB) y solo se sirven con sesión iniciada.
- PostgreSQL no se expone a internet y la app escucha solo en `127.0.0.1`. Al público se sale únicamente por Caddy (80/443).

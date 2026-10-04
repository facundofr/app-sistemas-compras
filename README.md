# Pedidos Sistemas — Grupo Cober

Aplicación web para el circuito de compras del equipo de Sistemas: **Sistemas carga el pedido, Compras lo cotiza y lo compra, y todos ven en qué etapa está**, con las facturas, imágenes y el historial de cada pedido.

- **Frontend y backend:** Next.js 16 (App Router, Server Actions) + React 19 + shadcn/ui + Tailwind v4, con tema claro/oscuro.
- **Base de datos:** PostgreSQL 17, con Drizzle ORM. Las migraciones se aplican solas al arrancar.
- **Archivos:** las imágenes y los PDF se guardan en disco, en un volumen de Docker. Solo los usuarios con sesión iniciada pueden verlos.
- **Despliegue:** Docker Compose con base de datos, aplicación y Caddy, que saca y renueva el HTTPS automáticamente.

## Documentación

- [docs/datos.md](docs/datos.md): cómo y dónde se guardan los datos, qué se guarda en cada tabla, qué no se guarda, y backups.
- [docs/resumen-dev.md](docs/resumen-dev.md): resumen de la rama `dev`: credenciales de prueba, flujo de cada usuario, qué hace y qué no.
- [docs/deploy-con-ia.md](docs/deploy-con-ia.md): el deploy en un VPS paso a paso, escrito para que lo ejecute un agente de IA (o una persona).

## Qué hace

| Pantalla | Quién la ve | Para qué |
|---|---|---|
| **Inicio** | Todos | Lo que le importa a cada rol: Sistemas ve sus pedidos en camino («Llega el jueves 08/10») y lo que falta confirmar; Compras, una bandeja con lo trabado o atrasado, lo que hay que cotizar y comprar, lo que llega esta semana y las facturas faltantes; Recepción, lo que está por llegar. |
| **Nuevo pedido** | Sistemas, Compras y Admin | Los campos del formulario de Google: fecha de pedido, solicitante del sector, sector que solicitó la compra, nombre y apellido del solicitante, facturar por (o NA), domicilio de entrega (Cramer 1652, Av Los Incas 3536 u otro), prioridad, uno o más productos (cada uno con cantidad y link, como un carrito), presupuesto pedido por el sector (hasta 5 archivos: imágenes, PDF, Excel o Word) y comentarios. Precarga los datos del último pedido del usuario. Con «Volver a pedir» (en un pedido entregado o cancelado) se abre con todos los productos de ese pedido. |
| **Pedidos / Estado de pedidos** | Todos | Alertas de pedidos trabados según prioridad (Urgente 1 día, Alta 3, Media 5, Baja 7), conteo por etapa, búsqueda tolerante a errores de tipeo, filtros como chips (en el celular, en un panel desde abajo), frase de estado de cada pedido, «Ver más» de a 50 y exportación a Excel (con una hoja por producto). Se actualiza sola cuando alguien cambia algo. |
| **Detalle del pedido** | Todos | Riel de etapas (Solicitado → Cotizando → Comprando → Entregado), datos del pedido, datos de compra (proveedor, CUIT, fechas, seguimiento, medio de pago, cuotas, importe, factura), imágenes, factura adjunta, historial completo, y acciones para cancelar, reactivar o eliminar. |
| **Etiqueta QR y confirmar entrega** | Todos (la etiqueta se imprime desde el detalle) | Cuando el pedido pasa a «Comprando», el detalle muestra una etiqueta con QR para imprimir y pegar en el paquete. Al escanearla (con la cámara del celular o con el botón **QR** del menú inferior) se abre `/pedidos/[id]/recibir`, que muestra el pedido y un botón para confirmar la entrega, con calificación opcional (1 a 5 estrellas), comentario y foto del paquete. Abrir el link no cambia nada: hay que tocar el botón. El lector tiene un modo «Recibir varios seguidos» para cuando llegan muchos paquetes juntos. Si el pedido tiene varios productos o unidades se marca qué llegó: queda «Llegó una parte» hasta que se reciba el resto. |
| **Inventario** | Todos (lo gestionan Sistemas y Admin) | Los equipos de Sistemas: número de serie, a quién se le dio, sector, ubicación, estado (en uso, depósito, reparación, baja) y garantía. Se cargan desde un pedido recibido (una fila por unidad, precargada) o a mano. Cada equipo tiene su etiqueta QR `EQ-00001`, que el botón QR abre directo en su ficha, y un historial de asignaciones. Exporta a Excel. |
| **Notificaciones** | Todos | La campanita del encabezado: nuevo pedido, cambio de etapa, fecha estimada, entrega, cancelación, pedidos trabados y entregas atrasadas (revisión automática cada hora). Si están configurados, también llegan por email y como push al celular. |
| **Compras efectuadas** | Todos | Todo lo comprado, con totales, ticket promedio y compras sin factura. Filtros por fechas, empresa, medio de pago y texto. Exporta a Excel. |
| **Reportes** | Compras y Admin | Gasto por mes, por empresa, por proveedor y por medio de pago, días promedio del pedido a la entrega y cumplimiento de cada proveedor (calificación, entregas a tiempo y demora). |
| **Usuarios** | Admin | Alta de usuarios, rol, activar/desactivar y cambio de contraseña. |
| **Integraciones** | Admin | Estado de los servicios opcionales (email, push, Mercado Libre, S3, Sentry), conexión de la cuenta de Mercado Libre y botones para correr las revisiones a mano. |
| **Listas de opciones** | Admin | Las opciones de los desplegables (solicitantes, empresas, domicilios, medios de compra y de pago, tipos de factura), editables sin tocar código. |
| **Mi cuenta** | Todos | Cambiar la propia contraseña. |

### Roles

- **Equipo Sistemas:** carga pedidos, puede editar los suyos mientras sigan en «Solicitado», cancelarlos, confirmar la entrega cuando Compras ya compró y lleva el inventario de equipos.
- **Compras:** gestiona todos los pedidos: mueve las etapas, carga los datos de compra y la factura, y ve los reportes.
- **Recepción:** quien recibe los paquetes. Ve los pedidos, escanea las etiquetas y confirma entregas; no carga ni edita pedidos.
- **Administrador:** todo lo anterior, más usuarios, listas de opciones, integraciones y eliminar pedidos.

Los permisos se validan en el servidor, en cada acción; ocultar un botón en pantalla no alcanza.

---

### Servicios opcionales

Todo funciona sin configurar nada de esto; cada bloque del `.env` activa una mejora (ver [.env.example](.env.example)). En la app, **Administración → Integraciones** muestra qué está activo.

| Qué | Variables | Qué agrega |
|---|---|---|
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `APP_URL` | Las notificaciones llegan también por correo, con link al pedido |
| Push al celular | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (con `npx web-push generate-vapid-keys`) | Cada persona las activa en «Notificaciones». En iPhone, con la app agregada a la pantalla de inicio |
| Mercado Libre | `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `APP_URL` | Con el N° de orden cargado, la fecha estimada y el seguimiento se completan solos, y avisa cuando sale y cuando llega |
| Archivos en S3 | `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Adjuntos fuera del servidor (Cloudflare R2, Backblaze B2, AWS). Migrar los existentes: `docker compose exec app node scripts/migrar-archivos-s3.mjs` |
| Errores | `SENTRY_DSN` | Los errores del servidor y del navegador llegan a Sentry |

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

## Tests

```bash
npm test            # unitarios (Vitest): permisos, lectura del QR, frase de estado, ítems, recepción parcial, equipos, seguimiento, formatos
npm run test:e2e    # de punta a punta (Playwright): crea la base pedidos_e2e y usa la app con un navegador
```

Los de punta a punta necesitan la base de desarrollo levantada (`npm run db:up`) y que no haya otro `next dev` corriendo en la carpeta. La primera vez: `npx playwright install chromium`. En GitHub, [.github/workflows/ci.yml](.github/workflows/ci.yml) corre tipos, lint y los dos tipos de tests en cada push.

---

## Estructura

```
src/
  app/
    login/                 Pantalla de ingreso
    (app)/                 Todo lo que requiere sesión (barra lateral + contenido)
      pedidos/             Listado, nuevo pedido, detalle [id] y confirmar entrega [id]/recibir
      escanear/            Lector de QR con la cámara (botón central del menú del celular)
      inicio/              Inicio según el rol
      equipos/             Inventario: lista, alta (también desde un pedido) y ficha [id] con su etiqueta QR
      notificaciones/      La campanita: lista de avisos y activar push
      compras/             Compras efectuadas
      reportes/            Gráficos de gasto
      admin/               Usuarios, listas de opciones e integraciones
      perfil/              Cambio de contraseña
    api/archivos/[id]      Descarga de adjuntos (con control de sesión)
    api/exportar           Exportación a Excel
    api/health             Chequeo de salud para Docker
    api/eventos            Avisos en vivo (Server-Sent Events) para que las pantallas se actualicen solas
    api/mercadolibre/      Conectar la cuenta de Mercado Libre (OAuth)
    manifest.ts, icono/    «Agregar a pantalla de inicio» (app instalable en el celular)
  proxy.ts                 Renueva la cookie de sesión y recuerda la página pedida para volver después del login
  actions/                 Server Actions (crear, editar, cambiar etapa, usuarios...)
  db/                      Esquema, conexión y arranque (migraciones + admin inicial)
  lib/                     Sesiones, permisos, consultas, archivos, formatos, notificaciones, cola de tareas
                           (trabajos.ts: emails, push, atrasos y Mercado Libre), tiempo real
  components/              UI (shadcn/ui en components/ui)
drizzle/                   Migraciones SQL
e2e/                       Tests de punta a punta (Playwright)
scripts/                   instalar.sh, backup.sh, restaurar.sh, usuario.mjs
```

## Seguridad

- Contraseñas con `scrypt`. Las sesiones se guardan en la base (la cookie lleva un token aleatorio, httpOnly) y se cierran al desactivar un usuario o cambiarle la contraseña. Duran 30 días y se renuevan con el uso, así que quien entra seguido no vuelve a ver el login.
- Límite de intentos de ingreso por IP y email.
- Los archivos subidos se validan por su contenido real (JPG, PNG, WEBP, GIF o PDF, hasta 10 MB) y solo se sirven con sesión iniciada.
- PostgreSQL no se expone a internet y la app escucha solo en `127.0.0.1`. Al público se sale únicamente por Caddy (80/443).

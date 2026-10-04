# Resumen de la rama `dev`

Mejoras en evaluación. **Nada de esto está en producción** y no hay servicios externos activos.

---

## Levantarla en local

```bash
npm run db:up        # PostgreSQL de desarrollo (Docker, puerto 5433)
DATABASE_URL=postgres://pedidos:pedidos@localhost:5433/pedidos \
ADMIN_EMAIL=admin@prueba.local ADMIN_PASSWORD=prueba1234 \
npx next dev -p 3001
```

- Escritorio: http://localhost:3001/asistente-sistemas
- Celular (mismo WiFi): `http://<IP-de-la-PC>:3001/asistente-sistemas`. La cámara no funciona por HTTP; escribir el código a mano sí.
- Para ver la versión mobile en la PC: F12 → Ctrl+Shift+M.
- Las migraciones se aplican solas al arrancar.

## Credenciales de prueba

Solo existen en la base **local** de desarrollo. No son de producción.

| Rol | Email | Contraseña |
|---|---|---|
| Admin (también Compras) | `admin@prueba.local` | `prueba1234` |
| Sistemas | `ana@prueba.local` | `prueba1234` |
| Recepción | `recepcion@prueba.local` | `prueba1234` |

Los tests de punta a punta usan otra base (`pedidos_e2e`) con sus propios usuarios: `compras@e2e.local`, `ana@e2e.local` y `recepcion@e2e.local`, todos con `prueba1234`.

Para crear más usuarios: `DATABASE_URL=... node scripts/usuario.mjs <email> <clave> <rol> <nombre>`.

---

## El circuito de un pedido

```
Solicitado ──► Cotizando ──► Comprando ──► (Llegó una parte) ──► Entregado ──► Equipos al inventario
 Sistemas       Compras       Compras        Recepción/Sistemas     Recepción/Sistemas   Sistemas
```

## Qué hace cada usuario

### Sistemas
1. **Inicio:** ve «En camino», «En gestión de Compras» y «Recibidos hace poco».
2. **Nuevo pedido:** uno o varios productos, como un carrito. Precarga los datos del último pedido y sugiere productos ya pedidos.
3. Puede editarlo mientras siga en «Solicitado». Después solo puede cancelarlo.
4. Recibe avisos en la campanita: Compras empezó a cotizar, lo compró, fecha estimada, llegó.
5. **Cuando llega:** escanea la etiqueta con el botón **QR** (o «Ya llegó» en el inicio), marca qué llegó, califica y saca una foto si quiere.
6. **Inventario:** «Registrar equipos» desde el pedido recibido carga una fila por unidad; solo falta el número de serie.
7. **«Volver a pedir»** en un pedido entregado o cancelado.

### Compras (y Admin)
1. **Inicio:** bandeja con lo que necesita atención, por cotizar, por comprar, lo que llega esta semana y lo que no tiene factura.
2. Le llega un aviso por cada pedido nuevo (los urgentes, marcados).
3. **En el detalle:** «Empezar a cotizar» → carga proveedor, importe y **«Llega aprox. el»** → «Marcar como comprado».
4. **Imprime la etiqueta QR** y la pega en el paquete.
5. Carga la factura y el código de seguimiento. Si es de Mercado Libre, puede cargar el N° de orden, aunque la integración está apagada.
6. **Reportes:** gasto y cumplimiento de proveedores (calificación, entregas a tiempo y demora).

### Recepción
1. **Inicio:** «Hay N paquetes por llegar» y el botón **«Recibir paquetes»** (modo varios seguidos).
2. Escanea la etiqueta, marca qué llegó y confirma. Si falta algo, queda «Llegó una parte».
3. Puede consultar pedidos e inventario. **No carga ni edita pedidos ni equipos.**

### Admin
Todo lo de Compras, más usuarios, listas de opciones, **Integraciones** (estado de los servicios opcionales) y eliminar pedidos.

---

## Qué hace la app (en `dev`)

- **Etiqueta QR del pedido:** se imprime cuando está en «Comprando». Al escanearla abre la confirmación de entrega; abrir el link no confirma nada, hay que tocar el botón.
- **Mobile estilo Mercado Pago:** menú inferior con el botón QR grande en el centro, tarjetas en lugar de tablas, filtros en un panel desde abajo y app instalable («Agregar a pantalla de inicio»).
- **Sesión de 30 días** que se renueva con el uso. Sin sesión, después del login vuelve a la página del QR.
- **Recepción parcial:** se marca por producto y por cantidad.
- **Inventario de equipos:** número de serie único, asignación, estado, garantía, historial, etiqueta QR `EQ-00001` y exportación a Excel.
- **Notificaciones en la campanita:** se actualizan en vivo, sin recargar la página.
- **Revisión automática cada hora:** pedidos trabados y entregas atrasadas (lunes a viernes, de 8 a 19).
- **Frase de estado:** «Llega el jueves 08/10», «Atrasado», «Llegó una parte».
- **Búsqueda tolerante a errores de tipeo,** chips de filtros y «Ver más» de a 50.
- **Rol Recepción.**
- **Tests:** 40 unitarios y 15 de punta a punta. Corren en GitHub Actions en cada push.

## Qué NO hace

- **No hay aprobación de compras.** Ningún rol autoriza antes de comprar; Compras decide cuándo pasa a «Comprando». Está propuesto (rol «Aprobador», aprobación por monto) y falta definir quién aprueba.
- **Los servicios externos están apagados:** email, push al celular, Mercado Libre, archivos en S3 y Sentry. El código está, pero se activan con claves en el `.env` y no se usan por decisión.
- **Mercado Libre nunca se probó** contra la API real.
- **No hay QR sin login:** hay que tener usuario (para eso está el rol Recepción).
- **Al confirmar, el cambio no se ve al instante:** aparece cuando responde el servidor.
- **No funciona sin conexión:** sin señal no se puede confirmar una entrega.
- **Los proveedores son texto libre:** «Mercado Libre» y «MercadoLibre» cuentan como dos en los reportes.

## A tener en cuenta

- **Cámara:** el lector QR necesita HTTPS (en producción hay) o `localhost`.
- **iPhone:** la cámara abre los links en Safari. Si la sesión está en Chrome, conviene usar el botón QR de la app.
- **Tests de punta a punta:** `E2E_CHANNEL=chrome npm run test:e2e`. No puede haber otro `next dev` corriendo en la carpeta.
- **Base:** si se cambia `src/db/schema.ts`, generar la migración (`npm run db:generate`) y actualizar [datos.md](datos.md).
- **`docker-compose.yml`:** solo le pasa a la app las variables que lista. Si se agrega una variable nueva al `.env`, también hay que agregarla ahí.
- **Antes de llevar `dev` a producción:** hacer backup (`scripts/backup.sh`). Las migraciones 0003 a 0005 crean tablas nuevas y pasan los pedidos existentes a la tabla de productos.
- **Indicador «N»:** la «N» que aparece abajo a la izquierda es de Next.js en modo desarrollo; en producción no aparece.

## Ideas pendientes

1. Aprobación de compras (falta definir quién aprueba y desde qué monto).
2. Conversación por pedido entre Sistemas y Compras.
3. Cotizaciones a elegir (2 o 3 opciones y el solicitante elige).
4. Proveedores como lista, historial de precios y orden de compra en PDF.
5. Recepción sin conexión y búsqueda rápida con Ctrl+K.

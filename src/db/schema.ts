import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// «recepcion»: quien recibe los paquetes. Ve los pedidos y confirma entregas; no carga ni edita pedidos.
export const rolEnum = pgEnum("rol", ["admin", "compras", "sistemas", "recepcion"]);

export const estadoEnum = pgEnum("estado_pedido", [
  "Solicitado",
  "Cotizando",
  "Comprando",
  "Entregado",
]);

export const prioridadEnum = pgEnum("prioridad", [
  "Baja",
  "Media",
  "Alta",
  "Urgente",
]);

// «recepcion»: foto del paquete al confirmar la entrega.
export const tipoAdjuntoEnum = pgEnum("tipo_adjunto", ["referencia", "factura", "recepcion"]);

export const listaEnum = pgEnum("lista_opciones", [
  "empresa",
  "medio_compra",
  "medio_pago",
  "tipo_factura",
  "solicitante_sector",
  "domicilio",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    rol: rolEnum("rol").notNull().default("sistemas"),
    activo: boolean("activo").notNull().default(true),
    ultimoIngreso: timestamp("ultimo_ingreso", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("usuarios_email_idx").on(t.email)],
);

export const sesiones = pgTable(
  "sesiones",
  {
    // SHA-256 del token que viaja en la cookie; el token en claro nunca se guarda.
    id: text("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    creadoPorId: integer("creado_por_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),

    // Datos del pedido (los del formulario de Google)
    fechaPedido: date("fecha_pedido").notNull().defaultNow(),
    solicitanteSector: text("solicitante_sector"),
    solicitante: text("solicitante").notNull(),
    sector: text("sector").notNull(),
    facturarPor: text("facturar_por").notNull(),
    domicilioEntrega: text("domicilio_entrega").notNull(),
    prioridad: prioridadEnum("prioridad").notNull().default("Media"),
    cantidad: integer("cantidad").notNull(),
    producto: text("producto").notNull(),
    link: text("link"),
    comentarios: text("comentarios"),

    estado: estadoEnum("estado").notNull().default("Solicitado"),
    estadoDesde: timestamp("estado_desde", { withTimezone: true }).notNull().defaultNow(),

    // Datos de compra (lo que completa Compras)
    medioCompra: text("medio_compra"),
    proveedor: text("proveedor"),
    cuit: text("cuit"),
    fechaCompra: date("fecha_compra"),
    fechaEntrega: date("fecha_entrega"),
    // Cuándo debería llegar, según Compras: alimenta la frase de estado y la alerta de entrega atrasada.
    fechaEstimada: date("fecha_estimada"),
    codigoSeguimiento: text("codigo_seguimiento"),
    medioPago: text("medio_pago"),
    cuotas: integer("cuotas"),
    importe: numeric("importe", { precision: 14, scale: 2, mode: "number" }),
    facturaNumero: text("factura_numero"),
    tipoFactura: text("tipo_factura"),
    facturaLink: text("factura_link"),
    notasCompras: text("notas_compras"),

    // Compras hechas en Mercado Libre: número de orden y último estado del envío informado por su API.
    mlOrden: text("ml_orden"),
    mlEnvioEstado: text("ml_envio_estado"),

    // Cómo llegó, según quien lo recibió (1 a 5). Alimenta el ranking de proveedores en Reportes.
    calificacion: integer("calificacion"),
    comentarioRecepcion: text("comentario_recepcion"),

    cancelado: boolean("cancelado").notNull().default(false),
    canceladoEn: timestamp("cancelado_en", { withTimezone: true }),
    canceladoMotivo: text("cancelado_motivo"),

    ...timestamps,
  },
  (t) => [
    index("pedidos_estado_idx").on(t.estado),
    index("pedidos_created_idx").on(t.createdAt),
    index("pedidos_fecha_compra_idx").on(t.fechaCompra),
    index("pedidos_creado_por_idx").on(t.creadoPorId),
    // Búsqueda por similitud (pg_trgm): rápida con miles de pedidos y tolerante a errores de tipeo.
    index("pedidos_producto_trgm_idx").using("gin", sql`${t.producto} gin_trgm_ops`),
    index("pedidos_proveedor_trgm_idx").using("gin", sql`${t.proveedor} gin_trgm_ops`),
    index("pedidos_solicitante_trgm_idx").using("gin", sql`${t.solicitante} gin_trgm_ops`),
  ],
);

export const adjuntos = pgTable(
  "adjuntos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pedidoId: integer("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    tipo: tipoAdjuntoEnum("tipo").notNull(),
    nombre: text("nombre").notNull(),
    mime: text("mime").notNull(),
    tamano: integer("tamano").notNull(),
    ruta: text("ruta").notNull(),
    subidoPorId: integer("subido_por_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("adjuntos_pedido_idx").on(t.pedidoId)],
);

export const historial = pgTable(
  "historial",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    usuarioId: integer("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    accion: text("accion").notNull(),
    detalle: text("detalle"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("historial_pedido_idx").on(t.pedidoId)],
);

export const opciones = pgTable(
  "opciones",
  {
    id: serial("id").primaryKey(),
    lista: listaEnum("lista").notNull(),
    valor: text("valor").notNull(),
    orden: integer("orden").notNull().default(0),
    activo: boolean("activo").notNull().default(true),
  },
  (t) => [uniqueIndex("opciones_lista_valor_idx").on(t.lista, t.valor)],
);

/**
 * Productos del pedido. `pedidos.producto` guarda el resumen («Monitor 24'' y 2 productos más») y
 * `pedidos.cantidad` el total de unidades, para que listados, búsqueda, etiqueta y Excel sigan iguales.
 */
export const pedidoItems = pgTable(
  "pedido_items",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull().default(0),
    producto: text("producto").notNull(),
    cantidad: integer("cantidad").notNull(),
    link: text("link"),
    // Recepción parcial: cuántas unidades ya llegaron. El pedido pasa a «Entregado» cuando llegaron todas.
    cantidadRecibida: integer("cantidad_recibida").notNull().default(0),
  },
  (t) => [index("pedido_items_pedido_idx").on(t.pedidoId, t.orden)],
);

export const estadoEquipoEnum = pgEnum("estado_equipo", ["en_uso", "en_deposito", "en_reparacion", "baja"]);

/**
 * Inventario de equipos de Sistemas. Se cargan al recibir un pedido (con su número de serie y a quién se le dio)
 * o a mano, para lo que ya estaba. Cada uno tiene su etiqueta QR (EQ-00001).
 */
export const equipos = pgTable(
  "equipos",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
    pedidoItemId: integer("pedido_item_id").references(() => pedidoItems.id, { onDelete: "set null" }),
    descripcion: text("descripcion").notNull(),
    numeroSerie: text("numero_serie"),
    estado: estadoEquipoEnum("estado").notNull().default("en_uso"),
    asignadoA: text("asignado_a"),
    sector: text("sector"),
    ubicacion: text("ubicacion"),
    fechaAlta: date("fecha_alta").notNull().defaultNow(),
    garantiaHasta: date("garantia_hasta"),
    notas: text("notas"),
    creadoPorId: integer("creado_por_id").references(() => usuarios.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("equipos_serie_idx").on(t.numeroSerie),
    index("equipos_pedido_idx").on(t.pedidoId),
    index("equipos_estado_idx").on(t.estado),
    index("equipos_descripcion_trgm_idx").using("gin", sql`${t.descripcion} gin_trgm_ops`),
  ],
);

/** Auditoría de cada equipo: alta, cambios de asignación, de estado, etc. */
export const equipoHistorial = pgTable(
  "equipo_historial",
  {
    id: serial("id").primaryKey(),
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "cascade" }),
    usuarioId: integer("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    accion: text("accion").notNull(),
    detalle: text("detalle"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("equipo_historial_equipo_idx").on(t.equipoId)],
);

/** Credenciales de integraciones externas (hoy: la cuenta de Mercado Libre de Compras). */
export const integraciones = pgTable("integraciones", {
  clave: text("clave").primaryKey(),
  datos: jsonb("datos").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Avisos para cada usuario: se ven en la campanita y, si hay SMTP o push configurados, también llegan afuera. */
export const notificaciones = pgTable(
  "notificaciones",
  {
    id: serial("id").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    pedidoId: integer("pedido_id").references(() => pedidos.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    cuerpo: text("cuerpo"),
    leidaEn: timestamp("leida_en", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notificaciones_usuario_idx").on(t.usuarioId, t.createdAt)],
);

/** Celulares y navegadores que aceptaron notificaciones push (Web Push). */
export const suscripcionesPush = pgTable(
  "suscripciones_push",
  {
    endpoint: text("endpoint").primaryKey(),
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("suscripciones_push_usuario_idx").on(t.usuarioId)],
);

/** Intentos fallidos de login por IP + email. En la base para que sobrevivan a un reinicio. */
export const intentosLogin = pgTable("intentos_login", {
  clave: text("clave").primaryKey(),
  fallos: integer("fallos").notNull().default(0),
  desde: timestamp("desde", { withTimezone: true }).notNull().defaultNow(),
});

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  pedidos: many(pedidos),
}));

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  creadoPor: one(usuarios, { fields: [pedidos.creadoPorId], references: [usuarios.id] }),
  items: many(pedidoItems),
  adjuntos: many(adjuntos),
  historial: many(historial),
}));

export const adjuntosRelations = relations(adjuntos, ({ one }) => ({
  pedido: one(pedidos, { fields: [adjuntos.pedidoId], references: [pedidos.id] }),
  subidoPor: one(usuarios, { fields: [adjuntos.subidoPorId], references: [usuarios.id] }),
}));

export const historialRelations = relations(historial, ({ one }) => ({
  pedido: one(pedidos, { fields: [historial.pedidoId], references: [pedidos.id] }),
  usuario: one(usuarios, { fields: [historial.usuarioId], references: [usuarios.id] }),
}));

export type Usuario = typeof usuarios.$inferSelect;
export type Pedido = typeof pedidos.$inferSelect;
export type Adjunto = typeof adjuntos.$inferSelect;
export type Notificacion = typeof notificaciones.$inferSelect;
export type PedidoItem = typeof pedidoItems.$inferSelect;
export type Rol = (typeof rolEnum.enumValues)[number];
export type Estado = (typeof estadoEnum.enumValues)[number];
export type Prioridad = (typeof prioridadEnum.enumValues)[number];
export type Lista = (typeof listaEnum.enumValues)[number];

export const pedidoItemsRelations = relations(pedidoItems, ({ one }) => ({
  pedido: one(pedidos, { fields: [pedidoItems.pedidoId], references: [pedidos.id] }),
}));

export type Equipo = typeof equipos.$inferSelect;
export type EstadoEquipo = (typeof estadoEquipoEnum.enumValues)[number];

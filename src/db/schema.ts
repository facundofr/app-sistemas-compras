import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const rolEnum = pgEnum("rol", ["admin", "compras", "sistemas"]);

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

export const tipoAdjuntoEnum = pgEnum("tipo_adjunto", ["referencia", "factura"]);

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
    codigoSeguimiento: text("codigo_seguimiento"),
    medioPago: text("medio_pago"),
    cuotas: integer("cuotas"),
    importe: numeric("importe", { precision: 14, scale: 2, mode: "number" }),
    facturaNumero: text("factura_numero"),
    tipoFactura: text("tipo_factura"),
    facturaLink: text("factura_link"),
    notasCompras: text("notas_compras"),

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

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  pedidos: many(pedidos),
}));

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  creadoPor: one(usuarios, { fields: [pedidos.creadoPorId], references: [usuarios.id] }),
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
export type Rol = (typeof rolEnum.enumValues)[number];
export type Estado = (typeof estadoEnum.enumValues)[number];
export type Prioridad = (typeof prioridadEnum.enumValues)[number];
export type Lista = (typeof listaEnum.enumValues)[number];

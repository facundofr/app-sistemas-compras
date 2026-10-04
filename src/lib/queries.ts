import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  adjuntos,
  equipoHistorial,
  equipos,
  estadoEquipoEnum,
  historial,
  listaEnum,
  opciones,
  pedidoItems,
  pedidos,
  usuarios,
  type Estado,
  type EstadoEquipo,
  type Lista,
  type Prioridad,
} from "@/db/schema";
import { ESTADOS, esIdPedido, PRIORIDADES } from "./constants";

const TZ = "America/Argentina/Buenos_Aires";

/** «texto» → «%texto%» para ILIKE, escapando los comodines que haya escrito la persona. */
const patronLike = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

/* ---------------- Listas configurables ---------------- */

export async function getOpciones() {
  const filas = await db
    .select({ lista: opciones.lista, valor: opciones.valor })
    .from(opciones)
    .where(eq(opciones.activo, true))
    .orderBy(asc(opciones.orden), asc(opciones.valor));
  const out = Object.fromEntries(listaEnum.enumValues.map((l) => [l, [] as string[]])) as Record<Lista, string[]>;
  for (const f of filas) out[f.lista].push(f.valor);
  return out;
}

export async function getTodasLasOpciones() {
  return db.select().from(opciones).orderBy(asc(opciones.lista), asc(opciones.orden), asc(opciones.valor));
}

/* ---------------- Alertas y métricas ---------------- */

const umbralDias = sql`(case ${pedidos.prioridad}
  when 'Urgente' then 1 when 'Alta' then 3 when 'Media' then 5 else 7 end)`;

/** Sin avanzar de etapa más días de los que permite su prioridad (Urgente 1, Alta 3, Media 5, Baja 7). */
export const estaTrabado = sql`${pedidos.estadoDesde} <= now() - ${umbralDias} * interval '1 day'`;
/** Ya comprado y pasó la fecha estimada sin que se confirme la entrega. */
export const entregaAtrasada = sql`(${pedidos.estado} = 'Comprando' and ${pedidos.fechaEstimada} < (now() at time zone ${TZ})::date)`;

export const necesitaAtencion = and(
  eq(pedidos.cancelado, false),
  sql`${pedidos.estado} <> 'Entregado'`,
  or(estaTrabado, entregaAtrasada),
)!;

/** Fecha que cuenta para el gasto: la de compra si está, si no la del pedido. */
const fechaGasto = sql`coalesce(${pedidos.fechaCompra}, ${pedidos.fechaPedido})`;
const mesActual = sql`date_trunc('month', (now() at time zone ${TZ}))::date`;

export async function getStats() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      enCurso: sql<number>`count(*) filter (where not ${pedidos.cancelado} and ${pedidos.estado} <> 'Entregado')::int`,
      gastoMes: sql<number>`coalesce(sum(${pedidos.importe}) filter (
        where not ${pedidos.cancelado} and date_trunc('month', ${fechaGasto})::date = ${mesActual}), 0)::float8`,
      alertas: sql<number>`count(*) filter (where ${necesitaAtencion})::int`,
    })
    .from(pedidos);
  return row;
}

export async function getAlertas(limite = 8) {
  return db
    .select({
      id: pedidos.id,
      producto: pedidos.producto,
      prioridad: pedidos.prioridad,
      estado: pedidos.estado,
      estadoDesde: pedidos.estadoDesde,
    })
    .from(pedidos)
    .where(necesitaAtencion)
    .orderBy(asc(pedidos.estadoDesde))
    .limit(limite);
}

export async function contarPorEstado() {
  const filas = await db
    .select({ estado: pedidos.estado, n: sql<number>`count(*)::int` })
    .from(pedidos)
    .where(eq(pedidos.cancelado, false))
    .groupBy(pedidos.estado);
  const out = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  for (const f of filas) out[f.estado] = f.n;
  return out;
}

/* ---------------- Pedidos ---------------- */

/** Unidades ya recibidas del pedido (recepción parcial). */
const unidadesRecibidas = sql<number>`(select coalesce(sum(least(i.cantidad_recibida, i.cantidad)), 0)::int
  from pedido_items i where i.pedido_id = "pedidos"."id")`;

export type FiltrosPedidos = {
  q?: string;
  estado?: string;
  empresa?: string;
  prioridad?: string;
  mios?: boolean;
  usuarioId?: number;
};

function wherePedidos(f: FiltrosPedidos) {
  const conds: SQL[] = [];
  if (f.q) {
    const like = patronLike(f.q);
    const numero = Number(f.q.replace(/\D/g, ""));
    conds.push(
      or(
        ilike(pedidos.producto, like),
        ilike(pedidos.proveedor, like),
        ilike(pedidos.solicitante, like),
        ilike(pedidos.solicitanteSector, like),
        ilike(pedidos.sector, like),
        sql`exists (select 1 from pedido_items i where i.pedido_id = ${pedidos.id} and i.producto ilike ${like})`,
        // Similitud de palabras (pg_trgm, con índice): «moniter» encuentra «Monitor».
        ...(f.q.trim().length >= 4
          ? [
              sql`${f.q} <% ${pedidos.producto}`,
              sql`${f.q} <% ${pedidos.proveedor}`,
              sql`${f.q} <% ${pedidos.solicitante}`,
            ]
          : []),
        ...(esIdPedido(numero) ? [eq(pedidos.id, numero)] : []),
      )!,
    );
  }
  if (f.estado === "Cancelado") conds.push(eq(pedidos.cancelado, true));
  else if (f.estado === "Atencion") conds.push(necesitaAtencion);
  else if (f.estado && (ESTADOS as string[]).includes(f.estado))
    conds.push(and(eq(pedidos.cancelado, false), eq(pedidos.estado, f.estado as Estado))!);
  if (f.empresa) conds.push(eq(pedidos.facturarPor, f.empresa));
  if (f.prioridad && (PRIORIDADES as string[]).includes(f.prioridad))
    conds.push(eq(pedidos.prioridad, f.prioridad as Prioridad));
  if (f.mios && f.usuarioId) conds.push(eq(pedidos.creadoPorId, f.usuarioId));
  return conds.length ? and(...conds) : undefined;
}

export async function listarPedidos(f: FiltrosPedidos, limite = 500) {
  return db
    .select({
      id: pedidos.id,
      createdAt: pedidos.createdAt,
      fechaPedido: pedidos.fechaPedido,
      solicitanteSector: pedidos.solicitanteSector,
      producto: pedidos.producto,
      cantidad: pedidos.cantidad,
      solicitante: pedidos.solicitante,
      sector: pedidos.sector,
      facturarPor: pedidos.facturarPor,
      prioridad: pedidos.prioridad,
      estado: pedidos.estado,
      estadoDesde: pedidos.estadoDesde,
      cancelado: pedidos.cancelado,
      proveedor: pedidos.proveedor,
      importe: pedidos.importe,
      fechaCompra: pedidos.fechaCompra,
      fechaEstimada: pedidos.fechaEstimada,
      fechaEntrega: pedidos.fechaEntrega,
      recibidas: unidadesRecibidas,
      adjuntos: sql<number>`(select count(*)::int from adjuntos a where a.pedido_id = "pedidos"."id")`,
    })
    .from(pedidos)
    .where(wherePedidos(f))
    .orderBy(desc(pedidos.createdAt))
    .limit(limite);
}

export async function contarPedidos(f: FiltrosPedidos) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(pedidos).where(wherePedidos(f));
  return r.n;
}

export async function pedidosParaExportar(f: FiltrosPedidos) {
  return db
    .select({ p: pedidos, creadoPor: usuarios.nombre })
    .from(pedidos)
    .leftJoin(usuarios, eq(usuarios.id, pedidos.creadoPorId))
    .where(wherePedidos(f))
    .orderBy(asc(pedidos.id));
}

export async function getPedido(id: number) {
  const [row] = await db
    .select({ p: pedidos, creadoPor: usuarios.nombre })
    .from(pedidos)
    .leftJoin(usuarios, eq(usuarios.id, pedidos.creadoPorId))
    .where(eq(pedidos.id, id))
    .limit(1);
  if (!row) return null;

  const [archivos, eventos, items] = await Promise.all([
    db
      .select({
        id: adjuntos.id,
        tipo: adjuntos.tipo,
        nombre: adjuntos.nombre,
        mime: adjuntos.mime,
        tamano: adjuntos.tamano,
        subidoPorId: adjuntos.subidoPorId,
        subidoPor: usuarios.nombre,
        createdAt: adjuntos.createdAt,
      })
      .from(adjuntos)
      .leftJoin(usuarios, eq(usuarios.id, adjuntos.subidoPorId))
      .where(eq(adjuntos.pedidoId, id))
      .orderBy(asc(adjuntos.createdAt)),
    db
      .select({
        id: historial.id,
        accion: historial.accion,
        detalle: historial.detalle,
        createdAt: historial.createdAt,
        usuario: usuarios.nombre,
      })
      .from(historial)
      .leftJoin(usuarios, eq(usuarios.id, historial.usuarioId))
      .where(eq(historial.pedidoId, id))
      .orderBy(desc(historial.createdAt), desc(historial.id)),
    db
      .select({
        id: pedidoItems.id,
        producto: pedidoItems.producto,
        cantidad: pedidoItems.cantidad,
        link: pedidoItems.link,
        cantidadRecibida: pedidoItems.cantidadRecibida,
      })
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, id))
      .orderBy(asc(pedidoItems.orden), asc(pedidoItems.id)),
  ]);

  const recibidas = items.reduce((s, i) => s + Math.min(i.cantidadRecibida, i.cantidad), 0);
  return { ...row.p, creadoPor: row.creadoPor, adjuntos: archivos, historial: eventos, items, recibidas };
}

/* ---------------- Compras efectuadas ---------------- */

export type FiltrosCompras = {
  desde?: string;
  hasta?: string;
  empresa?: string;
  medioPago?: string;
  q?: string;
};

const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function whereCompras(f: FiltrosCompras) {
  const conds: SQL[] = [
    eq(pedidos.cancelado, false),
    inArray(pedidos.estado, ["Comprando", "Entregado"]),
  ];
  if (esFecha(f.desde)) conds.push(sql`${fechaGasto} >= ${f.desde}::date`);
  if (esFecha(f.hasta)) conds.push(sql`${fechaGasto} <= ${f.hasta}::date`);
  if (f.empresa) conds.push(eq(pedidos.facturarPor, f.empresa));
  if (f.medioPago) conds.push(eq(pedidos.medioPago, f.medioPago));
  if (f.q) {
    const like = patronLike(f.q);
    conds.push(
      or(
        ilike(pedidos.producto, like),
        ilike(pedidos.proveedor, like),
        ilike(pedidos.facturaNumero, like),
        ilike(pedidos.cuit, like),
      )!,
    );
  }
  return and(...conds);
}

export async function listarCompras(f: FiltrosCompras) {
  const where = whereCompras(f);
  const [filas, [tot]] = await Promise.all([
    db
      .select({
        id: pedidos.id,
        fecha: sql<string>`${fechaGasto}::text`,
        producto: pedidos.producto,
        cantidad: pedidos.cantidad,
        facturarPor: pedidos.facturarPor,
        proveedor: pedidos.proveedor,
        cuit: pedidos.cuit,
        medioCompra: pedidos.medioCompra,
        medioPago: pedidos.medioPago,
        cuotas: pedidos.cuotas,
        importe: pedidos.importe,
        facturaNumero: pedidos.facturaNumero,
        tipoFactura: pedidos.tipoFactura,
        facturaLink: pedidos.facturaLink,
        estado: pedidos.estado,
        fechaEntrega: pedidos.fechaEntrega,
        facturas: sql<number>`(select count(*)::int from adjuntos a
          where a.pedido_id = "pedidos"."id" and a.tipo = 'factura')`,
      })
      .from(pedidos)
      .where(where)
      .orderBy(desc(fechaGasto), desc(pedidos.id)),
    db
      .select({
        cantidad: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${pedidos.importe}), 0)::float8`,
        conImporte: sql<number>`count(${pedidos.importe})::int`,
        entregadas: sql<number>`count(*) filter (where ${pedidos.estado} = 'Entregado')::int`,
        sinFactura: sql<number>`count(*) filter (where ${pedidos.facturaNumero} is null
          and ${pedidos.facturaLink} is null
          and not exists (select 1 from adjuntos a where a.pedido_id = "pedidos"."id" and a.tipo = 'factura'))::int`,
      })
      .from(pedidos)
      .where(where),
  ]);
  return { filas, totales: tot };
}

/* ---------------- Reportes ---------------- */

export async function getReportes() {
  const base = and(eq(pedidos.cancelado, false), isNotNull(pedidos.importe));
  const [porMes, porEmpresa, porProveedor, porMedioPago, resumen] = await Promise.all([
    db
      .select({
        mes: sql<string>`to_char(date_trunc('month', ${fechaGasto}), 'YYYY-MM')`,
        total: sql<number>`sum(${pedidos.importe})::float8`,
      })
      .from(pedidos)
      .where(and(base, sql`${fechaGasto} >= (${mesActual} - interval '11 months')`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ nombre: pedidos.facturarPor, total: sql<number>`sum(${pedidos.importe})::float8` })
      .from(pedidos)
      .where(base)
      .groupBy(pedidos.facturarPor)
      .orderBy(sql`2 desc`),
    db
      .select({
        nombre: sql<string>`coalesce(nullif(${pedidos.proveedor}, ''), 'Sin proveedor')`,
        total: sql<number>`sum(${pedidos.importe})::float8`,
        compras: sql<number>`count(*)::int`,
      })
      .from(pedidos)
      .where(base)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({
        nombre: sql<string>`coalesce(nullif(${pedidos.medioPago}, ''), 'Sin definir')`,
        total: sql<number>`sum(${pedidos.importe})::float8`,
      })
      .from(pedidos)
      .where(base)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`),
    db
      .select({
        total: sql<number>`coalesce(sum(${pedidos.importe}), 0)::float8`,
        compras: sql<number>`count(*)::int`,
        entregado: sql<number>`coalesce(sum(${pedidos.importe}) filter (where ${pedidos.estado} = 'Entregado'), 0)::float8`,
        diasPromedio: sql<number | null>`(select avg(extract(epoch from (h.created_at - p.created_at)) / 86400)::float8
          from ${pedidos} p join ${historial} h on h.pedido_id = p.id
          where h.accion = 'estado' and h.detalle like '%→ Entregado' and not p.cancelado)`,
      })
      .from(pedidos)
      .where(base),
  ]);
  return { porMes, porEmpresa, porProveedor, porMedioPago, resumen: resumen[0] };
}

/* ---------------- Usuarios ---------------- */

export async function listarUsuarios() {
  return db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
      ultimoIngreso: usuarios.ultimoIngreso,
      createdAt: usuarios.createdAt,
      pedidos: sql<number>`(select count(*)::int from pedidos p where p.creado_por_id = "usuarios"."id")`,
    })
    .from(usuarios)
    .orderBy(desc(usuarios.activo), asc(usuarios.nombre));
}

/** Datos del último pedido del usuario, para precargar lo que casi nunca cambia. */
export async function getUltimoPedidoDe(usuarioId: number) {
  const [row] = await db
    .select({
      solicitanteSector: pedidos.solicitanteSector,
      solicitante: pedidos.solicitante,
      sector: pedidos.sector,
      facturarPor: pedidos.facturarPor,
      domicilioEntrega: pedidos.domicilioEntrega,
    })
    .from(pedidos)
    .where(eq(pedidos.creadoPorId, usuarioId))
    .orderBy(desc(pedidos.id))
    .limit(1);
  return row ?? null;
}

/* ---------------- Inicio (según el rol) ---------------- */

const sinFactura = sql`(${pedidos.facturaNumero} is null and ${pedidos.facturaLink} is null
  and not exists (select 1 from adjuntos a where a.pedido_id = "pedidos"."id" and a.tipo = 'factura'))`;
const activo = and(eq(pedidos.cancelado, false), sql`${pedidos.estado} <> 'Entregado'`)!;

const columnasTarjeta = {
  id: pedidos.id,
  producto: pedidos.producto,
  cantidad: pedidos.cantidad,
  solicitante: pedidos.solicitante,
  sector: pedidos.sector,
  prioridad: pedidos.prioridad,
  estado: pedidos.estado,
  estadoDesde: pedidos.estadoDesde,
  cancelado: pedidos.cancelado,
  proveedor: pedidos.proveedor,
  fechaCompra: pedidos.fechaCompra,
  fechaEstimada: pedidos.fechaEstimada,
  fechaEntrega: pedidos.fechaEntrega,
  recibidas: unidadesRecibidas,
};
export type PedidoTarjeta = Awaited<ReturnType<typeof tarjetas>>[number];

/** Primero lo urgente y lo que llega antes. */
const ordenTarjetas = [
  sql`case ${pedidos.prioridad} when 'Urgente' then 0 when 'Alta' then 1 when 'Media' then 2 else 3 end`,
  sql`${pedidos.fechaEstimada} asc nulls last`,
  asc(pedidos.estadoDesde),
];

function tarjetas(where: SQL, limite = 6) {
  return db
    .select(columnasTarjeta)
    .from(pedidos)
    .where(where)
    .orderBy(...ordenTarjetas)
    .limit(limite);
}

async function seccion(where: SQL, limite = 6) {
  const [items, [{ n }]] = await Promise.all([
    tarjetas(where, limite),
    db.select({ n: sql<number>`count(*)::int` }).from(pedidos).where(where),
  ]);
  return { items, total: n };
}

const semana = sql`${pedidos.fechaEstimada} <= (now() at time zone ${TZ})::date + 7`;

/** Sistemas: lo propio que está en camino, lo que falta confirmar y lo último recibido (para volver a pedir). */
export async function inicioSistemas(usuarioId: number) {
  const propio = eq(pedidos.creadoPorId, usuarioId);
  const [porConfirmar, enCurso, recibidos] = await Promise.all([
    seccion(and(propio, eq(pedidos.cancelado, false), eq(pedidos.estado, "Comprando"))!),
    seccion(and(propio, activo, sql`${pedidos.estado} <> 'Comprando'`)!),
    db
      .select(columnasTarjeta)
      .from(pedidos)
      .where(and(propio, eq(pedidos.estado, "Entregado"), eq(pedidos.cancelado, false)))
      .orderBy(desc(pedidos.estadoDesde))
      .limit(4),
  ]);
  return { porConfirmar, enCurso, recibidos };
}

/** Compras: una bandeja con lo que requiere acción. */
export async function inicioCompras() {
  const [atencion, porCotizar, porComprar, porLlegar, facturasFaltantes] = await Promise.all([
    seccion(necesitaAtencion),
    seccion(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Solicitado"))!),
    seccion(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Cotizando"))!),
    seccion(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Comprando"), semana)!),
    seccion(and(eq(pedidos.cancelado, false), inArray(pedidos.estado, ["Comprando", "Entregado"]), sinFactura)!, 4),
  ]);
  return { atencion, porCotizar, porComprar, porLlegar, facturasFaltantes };
}

/** Recepción: todo lo comprado que todavía no llegó, primero lo que llega antes. */
export async function inicioRecepcion() {
  return seccion(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Comprando"))!, 30);
}

/** Cumplimiento por proveedor: calificación de la recepción, entregas a tiempo y demora desde la compra. */
export async function getCumplimientoProveedores() {
  return db
    .select({
      proveedor: pedidos.proveedor,
      entregas: sql<number>`count(*)::int`,
      calificacion: sql<number | null>`avg(${pedidos.calificacion})::float8`,
      calificados: sql<number>`count(${pedidos.calificacion})::int`,
      aTiempo: sql<number | null>`(avg(case when ${pedidos.fechaEntrega} <= ${pedidos.fechaEstimada} then 1.0 else 0 end)
        filter (where ${pedidos.fechaEstimada} is not null and ${pedidos.fechaEntrega} is not null))::float8`,
      dias: sql<number | null>`avg(${pedidos.fechaEntrega} - ${pedidos.fechaCompra})
        filter (where ${pedidos.fechaCompra} is not null and ${pedidos.fechaEntrega} is not null)::float8`,
    })
    .from(pedidos)
    .where(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Entregado"), isNotNull(pedidos.proveedor)))
    .groupBy(pedidos.proveedor)
    .orderBy(desc(sql`count(*)`))
    .limit(15);
}

/** Ítems de varios pedidos (para la hoja «Productos» del Excel). */
export async function itemsDePedidos(ids: number[]) {
  if (!ids.length) return [];
  return db
    .select({ pedidoId: pedidoItems.pedidoId, producto: pedidoItems.producto, cantidad: pedidoItems.cantidad, link: pedidoItems.link })
    .from(pedidoItems)
    .where(inArray(pedidoItems.pedidoId, ids))
    .orderBy(asc(pedidoItems.pedidoId), asc(pedidoItems.orden), asc(pedidoItems.id));
}

/** Productos ya pedidos, los más frecuentes primero: sugerencias mientras se escribe un pedido nuevo. */
export async function productosFrecuentes(limite = 80) {
  const filas = await db
    .select({ producto: pedidoItems.producto })
    .from(pedidoItems)
    .groupBy(pedidoItems.producto)
    .orderBy(desc(sql`count(*)`), asc(pedidoItems.producto))
    .limit(limite);
  return filas.map((f) => f.producto);
}

/* ---------------- Inventario de equipos ---------------- */

export type FiltrosEquipos = { q?: string; estado?: string; sector?: string };

function whereEquipos(f: FiltrosEquipos) {
  const conds: SQL[] = [];
  if (f.q) {
    const like = patronLike(f.q);
    const numero = Number(f.q.replace(/^EQ-?/i, "").replace(/\D/g, ""));
    conds.push(
      or(
        ilike(equipos.descripcion, like),
        ilike(equipos.numeroSerie, like),
        ilike(equipos.asignadoA, like),
        ilike(equipos.ubicacion, like),
        ...(f.q.trim().length >= 4 ? [sql`${f.q} <% ${equipos.descripcion}`] : []),
        ...(esIdPedido(numero) && /^(EQ-?)?\d+$/i.test(f.q.trim()) ? [eq(equipos.id, numero)] : []),
      )!,
    );
  }
  if (f.estado && (estadoEquipoEnum.enumValues as string[]).includes(f.estado)) {
    conds.push(eq(equipos.estado, f.estado as EstadoEquipo));
  }
  if (f.sector) conds.push(eq(equipos.sector, f.sector));
  return conds.length ? and(...conds) : undefined;
}

export async function listarEquipos(f: FiltrosEquipos, limite = 500) {
  return db.select().from(equipos).where(whereEquipos(f)).orderBy(desc(equipos.id)).limit(limite);
}

export async function contarEquiposPorEstado() {
  const filas = await db.select({ estado: equipos.estado, n: sql<number>`count(*)::int` }).from(equipos).groupBy(equipos.estado);
  const out = Object.fromEntries(estadoEquipoEnum.enumValues.map((e) => [e, 0])) as Record<EstadoEquipo, number>;
  for (const r of filas) out[r.estado] = r.n;
  return out;
}

export async function sectoresDeEquipos() {
  const filas = await db
    .selectDistinct({ sector: equipos.sector })
    .from(equipos)
    .where(isNotNull(equipos.sector))
    .orderBy(asc(equipos.sector));
  return filas.map((f) => f.sector!);
}

export async function getEquipo(id: number) {
  if (!esIdPedido(id)) return null;
  const [e] = await db.select().from(equipos).where(eq(equipos.id, id)).limit(1);
  if (!e) return null;
  const [eventos, pedido] = await Promise.all([
    db
      .select({
        id: equipoHistorial.id,
        accion: equipoHistorial.accion,
        detalle: equipoHistorial.detalle,
        createdAt: equipoHistorial.createdAt,
        usuario: usuarios.nombre,
      })
      .from(equipoHistorial)
      .leftJoin(usuarios, eq(usuarios.id, equipoHistorial.usuarioId))
      .where(eq(equipoHistorial.equipoId, id))
      .orderBy(desc(equipoHistorial.createdAt), desc(equipoHistorial.id)),
    e.pedidoId
      ? db
          .select({ id: pedidos.id, producto: pedidos.producto, proveedor: pedidos.proveedor, fechaCompra: pedidos.fechaCompra })
          .from(pedidos)
          .where(eq(pedidos.id, e.pedidoId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return { ...e, historial: eventos, pedido };
}

export async function equiposDePedido(pedidoId: number) {
  return db.select().from(equipos).where(eq(equipos.pedidoId, pedidoId)).orderBy(asc(equipos.id));
}

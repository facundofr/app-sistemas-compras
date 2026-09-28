import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  adjuntos,
  historial,
  listaEnum,
  opciones,
  pedidos,
  usuarios,
  type Estado,
  type Lista,
  type Prioridad,
} from "@/db/schema";
import { ESTADOS, esIdPedido, PRIORIDADES } from "./constants";

const TZ = "America/Argentina/Buenos_Aires";

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

const necesitaAtencion = and(
  eq(pedidos.cancelado, false),
  sql`${pedidos.estado} <> 'Entregado'`,
  sql`${pedidos.estadoDesde} <= now() - ${umbralDias} * interval '1 day'`,
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
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    const numero = Number(f.q.replace(/\D/g, ""));
    conds.push(
      or(
        ilike(pedidos.producto, like),
        ilike(pedidos.proveedor, like),
        ilike(pedidos.solicitante, like),
        ilike(pedidos.solicitanteSector, like),
        ilike(pedidos.sector, like),
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
      adjuntos: sql<number>`(select count(*)::int from adjuntos a where a.pedido_id = "pedidos"."id")`,
    })
    .from(pedidos)
    .where(wherePedidos(f))
    .orderBy(desc(pedidos.createdAt))
    .limit(limite);
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

  const [archivos, eventos] = await Promise.all([
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
  ]);

  return { ...row.p, creadoPor: row.creadoPor, adjuntos: archivos, historial: eventos };
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
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
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

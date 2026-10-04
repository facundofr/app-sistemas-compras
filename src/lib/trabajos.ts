import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificaciones, pedidos } from "@/db/schema";
import { COLAS, getCola } from "./cola";
import { enviarEmail } from "./email";
import { codigoPedido, fmtDate } from "./format";
import { idsDeCompras, notificar } from "./notificaciones";
import { consultarOrden, ESTADO_ENVIO_ML, mlConfigurado } from "./mercadolibre";
import { enviarPush } from "./push";
import { avisarCambio } from "./tiempo-real";
import { entregaAtrasada, estaTrabado } from "./queries";

type Email = { para: string; asunto: string; texto: string; url?: string };
type Push = { usuarioId: number; titulo: string; cuerpo?: string; url?: string };

/** Registra los trabajadores de la cola. Se llama una vez al arrancar (instrumentation.ts). */
export async function iniciarTrabajos() {
  const cola = await getCola();
  await cola.work<Email>(COLAS.email, async (jobs) => {
    for (const j of jobs) await enviarEmail(j.data);
  });
  await cola.work<Push>(COLAS.push, async (jobs) => {
    for (const j of jobs) await enviarPush(j.data.usuarioId, j.data);
  });
  await cola.work(COLAS.atrasos, async () => revisarAtrasos());
  // Una vez por hora, en horario de oficina (lunes a viernes de 8 a 19, hora de Argentina).
  await cola.schedule(COLAS.atrasos, "0 8-19 * * 1-5", null, { tz: "America/Argentina/Buenos_Aires" });
  await cola.work(COLAS.mercadolibre, async () => sincronizarMercadoLibre());
  if (mlConfigurado()) {
    // Cada media hora de 8 a 21: fecha estimada, seguimiento y estado de los envíos de Mercado Libre.
    await cola.schedule(COLAS.mercadolibre, "*/30 8-21 * * *", null, { tz: "America/Argentina/Buenos_Aires" });
  }
  console.log("[trabajos] Cola iniciada.");
}

/** Pedidos de `ids` que ya recibieron un aviso de este tipo desde que entraron en su etapa actual. */
async function yaAvisados(tipo: string, ids: number[]) {
  if (!ids.length) return new Set<number>();
  const filas = await db
    .selectDistinct({ id: notificaciones.pedidoId })
    .from(notificaciones)
    .innerJoin(pedidos, eq(pedidos.id, notificaciones.pedidoId))
    .where(and(eq(notificaciones.tipo, tipo), inArray(notificaciones.pedidoId, ids), gt(notificaciones.createdAt, pedidos.estadoDesde)));
  return new Set(filas.map((f) => f.id));
}

/**
 * Avisa una sola vez por etapa: a Compras de los pedidos trabados, y a quien lo pidió (y a Compras)
 * cuando pasó la fecha estimada y todavía no se confirmó la entrega.
 */
export async function revisarAtrasos() {
  const base = and(eq(pedidos.cancelado, false), sql`${pedidos.estado} <> 'Entregado'`);
  const compras = await idsDeCompras();

  const trabados = await db.select().from(pedidos).where(and(base, estaTrabado));
  const avisadosT = await yaAvisados("trabado", trabados.map((p) => p.id));
  for (const p of trabados.filter((p) => !avisadosT.has(p.id))) {
    await notificar(compras, {
      pedidoId: p.id,
      tipo: "trabado",
      titulo: `Pedido trabado: ${p.producto}`,
      cuerpo: `${codigoPedido(p.id)} (prioridad ${p.prioridad}) sigue en «${p.estado}» desde el ${fmtDate(p.estadoDesde)}.`,
    });
  }

  const atrasados = await db.select().from(pedidos).where(and(base, entregaAtrasada));
  const avisadosA = await yaAvisados("atrasado", atrasados.map((p) => p.id));
  for (const p of atrasados.filter((p) => !avisadosA.has(p.id))) {
    await notificar([...(p.creadoPorId ? [p.creadoPorId] : []), ...compras], {
      pedidoId: p.id,
      tipo: "atrasado",
      titulo: `¿Ya llegó? ${p.producto}`,
      cuerpo: `Tenía que llegar el ${fmtDate(p.fechaEstimada)}. Si ya está, confirmá la entrega; si no, Compras tiene que revisar el envío.`,
    });
  }
  return { trabados: trabados.length, atrasados: atrasados.length };
}

/**
 * Trae de Mercado Libre el estado de los envíos de lo comprado ahí: completa la fecha estimada y el
 * código de seguimiento si faltan, y avisa a quien lo pidió cuando sale y cuando llega.
 */
export async function sincronizarMercadoLibre() {
  if (!mlConfigurado()) return { revisados: 0 };
  const lista = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.cancelado, false), eq(pedidos.estado, "Comprando"), sql`${pedidos.mlOrden} is not null`));
  let revisados = 0;
  for (const p of lista) {
    let e;
    try {
      e = await consultarOrden(p.mlOrden!);
    } catch (err) {
      console.error(`[mercadolibre] ${codigoPedido(p.id)}:`, err);
      continue;
    }
    if (!e) return { revisados, error: "La cuenta de Mercado Libre no está conectada." };
    revisados++;
    const cambios: Partial<typeof pedidos.$inferInsert> = {};
    if (e.estado !== p.mlEnvioEstado) cambios.mlEnvioEstado = e.estado;
    if (e.fechaEstimada && e.fechaEstimada !== p.fechaEstimada) cambios.fechaEstimada = e.fechaEstimada;
    if (e.seguimiento && !p.codigoSeguimiento) cambios.codigoSeguimiento = e.seguimiento;
    if (!Object.keys(cambios).length) continue;
    await db.update(pedidos).set(cambios).where(eq(pedidos.id, p.id));

    if (cambios.mlEnvioEstado && p.creadoPorId && (e.estado === "shipped" || e.estado === "delivered" || e.estado === "not_delivered")) {
      const llego = e.estado === "delivered";
      await notificar(llego ? [p.creadoPorId, ...(await idsDeCompras())] : [p.creadoPorId], {
        pedidoId: p.id,
        tipo: llego ? "ml_entregado" : "ml_envio",
        titulo: llego ? `Mercado Libre dice que llegó: ${p.producto}` : `${ESTADO_ENVIO_ML[e.estado]}: ${p.producto}`,
        cuerpo: llego
          ? `Si ya lo tenés, confirmá la entrega de ${codigoPedido(p.id)} (escaneá la etiqueta o entrá al pedido).`
          : e.fechaEstimada
            ? `Llega aprox. el ${fmtDate(e.fechaEstimada)}.`
            : undefined,
      });
    }
  }
  if (revisados) await avisarCambio({ tipo: "pedidos" });
  return { revisados };
}

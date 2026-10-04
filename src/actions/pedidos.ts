"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adjuntos, historial, pedidoItems, pedidos, type Adjunto, type Estado, type Pedido } from "@/db/schema";
import { requireUsuario, type UsuarioSesion } from "@/lib/auth";
import { ARCHIVOS_MAX_POR_ENVIO, esIdPedido, ESTADOS, PRIORIDADES, SELECT_VACIO } from "@/lib/constants";
import { codigoPedido, fmtDate, hoyISO } from "@/lib/format";
import { filasDeItems, ITEMS_MAX, resumenItems, type ItemPedido } from "@/lib/items";
import { idsDeCompras, notificar } from "@/lib/notificaciones";
import { aplicarRecepcion, detalleRecibidos } from "@/lib/recepcion";
import {
  puedeAdjuntarReferencia,
  puedeBorrarAdjunto,
  puedeCambiarEstado,
  puedeCargarPedidos,
  puedeCancelar,
  puedeEditarCompra,
  puedeEditarPedido,
  puedeEliminar,
  puedeReactivar,
} from "@/lib/permisos";
import { ArchivoInvalido, archivosDelForm, borrarArchivo, guardarArchivo } from "@/lib/storage";
import { avisarCambio } from "@/lib/tiempo-real";

export type FormState = {
  ok?: boolean;
  error?: string;
  errores?: Record<string, string>;
  mensaje?: string;
  id?: number;
  /** Cambia en cada envío exitoso para que el cliente pueda reaccionar (limpiar el form, etc.). */
  stamp?: number;
};

/* ---------------- helpers de validación ---------------- */

const requerido = (msg: string, max = 300) =>
  z.string(msg).trim().max(max, `Máximo ${max} caracteres.`).min(1, msg);
const opcional = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .transform((v) => v || null);
const url = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => v || null)
  .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Tiene que empezar con http:// o https://");
const monto = z
  .preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number("Ingresá un número.").nonnegative("No puede ser negativo.").max(999_999_999_999, "Monto demasiado alto.").nullable(),
  )
  .transform((v) => (v === null ? null : Math.round(v * 100) / 100));
const fecha = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida.");

const datosPedidoSchema = z.object({
  fechaPedido: z
    .string("Indicá la fecha del pedido.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Indicá la fecha del pedido."),
  solicitanteSector: requerido("Elegí quién lo solicita en el sector.", 120),
  sector: requerido("Indicá qué sector solicitó la compra.", 120),
  solicitante: requerido("Indicá nombre y apellido.", 120),
  facturarPor: requerido("Elegí la empresa que factura (o NA).", 120),
  domicilioEntrega: requerido("Elegí el domicilio o escribí otro.", 200),
  prioridad: z.enum(PRIORIDADES as [string, ...string[]], "Elegí una prioridad."),
  comentarios: opcional(),
});

const itemSchema = z.object({
  producto: requerido("Describí el producto.", 500),
  cantidad: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number("Indicá la cantidad.")
      .int("Tiene que ser un número entero.")
      .min(1, "Tiene que ser al menos 1.")
      .max(100000, "Cantidad demasiado alta."),
  ),
  link: requerido("Pegá el link del producto.", 2000),
});

/**
 * Datos del pedido + sus ítems (columnas repetidas item_producto/item_cantidad/item_link).
 * Los errores de un ítem vuelven como «items.<n>.<campo>» para marcar la fila exacta.
 */
function parsearPedido(formData: FormData) {
  const datos = datosPedidoSchema.safeParse(datosDe(formData, Object.keys(datosPedidoSchema.shape)));
  const filas = filasDeItems({
    producto: formData.getAll("item_producto"),
    cantidad: formData.getAll("item_cantidad"),
    link: formData.getAll("item_link"),
  });
  const errores: Record<string, string> = datos.success ? {} : (erroresDe(datos.error).errores ?? {});
  if (!filas.length) errores.items = "Agregá al menos un producto.";
  if (filas.length > ITEMS_MAX) errores.items = `Hasta ${ITEMS_MAX} productos por pedido.`;
  const items: ItemPedido[] = [];
  filas.forEach((f, i) => {
    const r = itemSchema.safeParse(f);
    if (r.success) items.push(r.data);
    else for (const issue of r.error.issues) errores[`items.${i}.${String(issue.path[0])}`] ??= issue.message;
  });
  if (!datos.success || Object.keys(errores).length) {
    return { ok: false as const, estado: { error: "Revisá los campos marcados.", errores } satisfies FormState };
  }
  return {
    ok: true as const,
    items,
    data: { ...datos.data, ...resumenItems(items), prioridad: datos.data.prioridad as Pedido["prioridad"] },
  };
}

/** La base o una transacción en curso: lo que se escribe junto tiene que quedar todo o nada. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ejecutor = typeof db | Tx;

async function guardarItems(tx: Ejecutor, pedidoId: number, items: ItemPedido[]) {
  await tx.delete(pedidoItems).where(eq(pedidoItems.pedidoId, pedidoId));
  await tx.insert(pedidoItems).values(items.map((it, orden) => ({ ...it, pedidoId, orden })));
}

const compraSchema = z.object({
  medioCompra: opcional(120),
  proveedor: opcional(200),
  cuit: opcional(20).refine(
    (v) => !v || /^\d{2}-?\d{8}-?\d$/.test(v),
    "El CUIT tiene 11 dígitos (ej: 30-12345678-9).",
  ),
  fechaCompra: fecha,
  fechaEntrega: fecha,
  fechaEstimada: fecha,
  codigoSeguimiento: opcional(200),
  mlOrden: opcional(30).refine((v) => !v || /^[0-9]{6,20}$/.test(v), "El número de orden de Mercado Libre son solo dígitos."),
  medioPago: opcional(120),
  cuotas: z
    .preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int("Número entero.").min(1, "Mínimo 1.").max(60, "Máximo 60.").nullable()),
  importe: monto,
  facturaNumero: opcional(60),
  tipoFactura: opcional(30),
  facturaLink: url,
  notasCompras: opcional(),
});

function erroresDe(error: z.ZodError): FormState {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    errores[k] ??= issue.message;
  }
  return { error: "Revisá los campos marcados.", errores };
}

function datosDe(formData: FormData, campos: string[]) {
  return Object.fromEntries(
    campos.map((c) => {
      const v = formData.get(c);
      return [c, v === SELECT_VACIO ? "" : (v ?? undefined)];
    }),
  );
}

const ETIQUETAS: Partial<Record<keyof Pedido, string>> = {
  fechaPedido: "Fecha de pedido",
  solicitanteSector: "Solicitante del sector",
  solicitante: "Solicitante",
  sector: "Sector",
  facturarPor: "Facturar por",
  domicilioEntrega: "Domicilio",
  prioridad: "Prioridad",
  cantidad: "Cantidad",
  producto: "Producto",
  link: "Link",
  comentarios: "Comentarios",
  medioCompra: "Medio de compra",
  proveedor: "Proveedor",
  cuit: "CUIT",
  fechaCompra: "Fecha de compra",
  fechaEntrega: "Fecha de entrega",
  fechaEstimada: "Fecha estimada de entrega",
  codigoSeguimiento: "Seguimiento",
  mlOrden: "Orden de Mercado Libre",
  medioPago: "Medio de pago",
  cuotas: "Cuotas",
  importe: "Importe",
  facturaNumero: "N° de factura",
  tipoFactura: "Tipo de factura",
  facturaLink: "Link de factura",
  notasCompras: "Notas",
};

function camposCambiados(antes: Pedido, despues: Record<string, unknown>) {
  return Object.entries(despues)
    .filter(([k, v]) => (antes[k as keyof Pedido] ?? null) !== (v ?? null))
    .map(([k]) => ETIQUETAS[k as keyof Pedido] ?? k);
}

async function cargarPedido(id: number) {
  if (!esIdPedido(id)) return null;
  const [p] = await db.select().from(pedidos).where(eq(pedidos.id, id)).limit(1);
  return p ?? null;
}

async function registrar(
  pedidoId: number,
  usuario: UsuarioSesion,
  accion: string,
  detalle?: string,
  tx: Ejecutor = db,
) {
  await tx.insert(historial).values({ pedidoId, usuarioId: usuario.id, accion, detalle });
}

async function guardarAdjuntos(
  formData: FormData,
  campo: string,
  pedidoId: number,
  tipo: Adjunto["tipo"],
  usuario: UsuarioSesion,
) {
  const files = archivosDelForm(formData, campo);
  if (files.length > ARCHIVOS_MAX_POR_ENVIO) {
    throw new ArchivoInvalido(`Podés subir hasta ${ARCHIVOS_MAX_POR_ENVIO} archivos por vez.`);
  }
  const guardados: Awaited<ReturnType<typeof guardarArchivo>>[] = [];
  try {
    for (const f of files) guardados.push(await guardarArchivo(f));
    if (guardados.length) {
      await db
        .insert(adjuntos)
        .values(guardados.map((g) => ({ ...g, pedidoId, tipo, subidoPorId: usuario.id })));
    }
  } catch (err) {
    await Promise.all(guardados.map((g) => borrarArchivo(g.ruta)));
    throw err;
  }
  return guardados;
}

function refrescar() {
  revalidatePath("/", "layout");
  // Los demás navegadores abiertos recargan solos (src/components/en-vivo.tsx).
  void avisarCambio({ tipo: "pedidos" });
}

/* ---------------- acciones ---------------- */

export async function crearPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  if (!puedeCargarPedidos(usuario.rol)) return { error: "Tu rol no puede cargar pedidos." };
  const parsed = parsearPedido(formData);
  if (!parsed.ok) return parsed.estado;

  // Pedido, productos e historial juntos: si algo falla, no queda un pedido sin productos.
  const nuevo = await db.transaction(async (tx) => {
    const [n] = await tx
      .insert(pedidos)
      .values({ ...parsed.data, creadoPorId: usuario.id })
      .returning({ id: pedidos.id });
    await guardarItems(tx, n.id, parsed.items);
    await registrar(
      n.id,
      usuario,
      "creado",
      parsed.items.length > 1 ? `Pedido cargado con ${parsed.items.length} productos` : "Pedido cargado",
      tx,
    );
    return n;
  });

  let aviso: string | undefined;
  try {
    const g = await guardarAdjuntos(formData, "archivos", nuevo.id, "referencia", usuario);
    if (g.length) await registrar(nuevo.id, usuario, "adjunto", `${g.length} archivo(s) del sector`);
  } catch (err) {
    if (!(err instanceof ArchivoInvalido)) throw err;
    aviso = `El pedido se guardó, pero no se adjuntaron los archivos: ${err.message}`;
  }

  const d = parsed.data;
  await notificar(
    await idsDeCompras(),
    {
      pedidoId: nuevo.id,
      tipo: "nuevo",
      titulo: `${d.prioridad === "Urgente" ? "Pedido URGENTE" : "Nuevo pedido"}: ${d.producto}`,
      cuerpo: `${codigoPedido(nuevo.id)} · ${d.cantidad} u. · ${d.solicitante} (${d.sector}) · Prioridad ${d.prioridad}`,
    },
    usuario.id,
  );
  refrescar();
  return {
    ok: true,
    id: nuevo.id,
    stamp: Date.now(),
    mensaje: aviso ?? `${codigoPedido(nuevo.id)} enviado. Compras ya lo puede ver.`,
  };
}

export async function actualizarPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  const id = Number(formData.get("id"));
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeEditarPedido(usuario, p)) {
    return { error: "Este pedido ya está en gestión de Compras y no se puede modificar." };
  }
  const parsed = parsearPedido(formData);
  if (!parsed.ok) return parsed.estado;

  const actuales = await db
    .select({ producto: pedidoItems.producto, cantidad: pedidoItems.cantidad, link: pedidoItems.link })
    .from(pedidoItems)
    .where(eq(pedidoItems.pedidoId, id))
    .orderBy(asc(pedidoItems.orden));
  const itemsCambiaron = JSON.stringify(actuales) !== JSON.stringify(parsed.items);
  // El resumen (producto/cantidad/link) se deriva de los ítems: si cambiaron, se informa como «Productos».
  const { producto, cantidad, link, ...resto } = parsed.data;
  const cambios = [...camposCambiados(p, resto), ...(itemsCambiaron ? ["Productos"] : [])];
  if (!cambios.length) return { ok: true, stamp: Date.now(), mensaje: "No había cambios para guardar." };
  // Todo junto, y solo si nadie lo movió de etapa o lo canceló mientras se editaba.
  const guardado = await db.transaction(async (tx) => {
    const filas = await tx
      .update(pedidos)
      .set({ ...resto, producto, cantidad, link })
      .where(and(eq(pedidos.id, id), eq(pedidos.estado, p.estado), eq(pedidos.cancelado, false)))
      .returning({ id: pedidos.id });
    if (!filas.length) return false;
    if (itemsCambiaron) await guardarItems(tx, id, parsed.items);
    await registrar(id, usuario, "edicion", `Cambió: ${cambios.join(", ")}`, tx);
    return true;
  });
  refrescar();
  if (!guardado) return { error: "Otra persona acaba de modificar este pedido. Revisá su estado actual." };
  return { ok: true, stamp: Date.now(), mensaje: "Datos del pedido guardados." };
}

export async function actualizarCompra(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  const id = Number(formData.get("id"));
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeEditarCompra(usuario, p)) return { error: "Solo Compras puede cargar los datos de la compra." };

  const parsed = compraSchema.safeParse(datosDe(formData, Object.keys(compraSchema.shape)));
  if (!parsed.success) return erroresDe(parsed.error);

  const cambios = camposCambiados(p, parsed.data);
  let aviso: string | undefined;
  try {
    const g = await guardarAdjuntos(formData, "facturas", id, "factura", usuario);
    if (g.length) await registrar(id, usuario, "adjunto", `${g.length} archivo(s) de factura`);
    if (g.length) cambios.push("Factura adjunta");
  } catch (err) {
    if (!(err instanceof ArchivoInvalido)) throw err;
    aviso = err.message;
  }

  if (!cambios.length) return { ok: !aviso, error: aviso, stamp: Date.now(), mensaje: "No había cambios para guardar." };
  await db.update(pedidos).set(parsed.data).where(eq(pedidos.id, id));
  await registrar(id, usuario, "compra", `Cambió: ${cambios.join(", ")}`);
  if (p.creadoPorId && parsed.data.fechaEstimada && parsed.data.fechaEstimada !== p.fechaEstimada && p.estado !== "Entregado") {
    await notificar(
      [p.creadoPorId],
      {
        pedidoId: id,
        tipo: "fecha_estimada",
        titulo: `${p.producto}: llega aprox. el ${fmtDate(parsed.data.fechaEstimada)}`,
        cuerpo: `Compras ${p.fechaEstimada ? "cambió" : "cargó"} la fecha estimada de entrega de ${codigoPedido(id)}.`,
      },
      usuario.id,
    );
  }
  refrescar();
  if (aviso) return { error: `Se guardaron los datos, pero no la factura: ${aviso}`, stamp: Date.now() };
  return { ok: true, stamp: Date.now(), mensaje: "Datos de compra guardados." };
}

/** Qué se le avisa a quien cargó el pedido en cada cambio de etapa. */
function avisoDeEtapa(p: Pedido, destino: Estado, quien: string) {
  switch (destino) {
    case "Cotizando":
      return { titulo: `Compras empezó a cotizar: ${p.producto}`, cuerpo: `${codigoPedido(p.id)} está en «Cotizando».` };
    case "Comprando":
      return {
        titulo: `Compras compró tu pedido: ${p.producto}`,
        cuerpo: [
          p.fechaEstimada ? `Llega aprox. el ${fmtDate(p.fechaEstimada)}.` : "Cuando llegue, confirmá la entrega.",
          p.proveedor && `Proveedor: ${p.proveedor}.`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    case "Entregado":
      return { titulo: `Se recibió: ${p.producto}`, cuerpo: `${quien} confirmó la entrega de ${codigoPedido(p.id)}.` };
    default:
      return { titulo: `${p.producto} volvió a «${destino}»`, cuerpo: `${quien} movió ${codigoPedido(p.id)} a «${destino}».` };
  }
}

type DatosRecepcion = { calificacion?: number | null; comentarioRecepcion?: string | null };

async function moverEstado(usuario: UsuarioSesion, id: number, destino: Estado, recepcion?: DatosRecepcion) {
  if (!ESTADOS.includes(destino)) return { error: "Estado inválido." };
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeCambiarEstado(usuario, p, destino)) {
    return {
      error:
        destino === "Entregado"
          ? "Solo se puede confirmar la entrega cuando el pedido ya está comprado."
          : `La etapa «${destino}» la gestiona el equipo de Compras.`,
    };
  }
  const hoy = hoyISO();
  const movido = await db.transaction(async (tx) => {
    // Solo si sigue en la etapa que se leyó: un doble clic o dos personas a la vez no duplican el cambio.
    const filas = await tx
      .update(pedidos)
      .set({
        estado: destino,
        estadoDesde: new Date(),
        ...(destino === "Comprando" && !p.fechaCompra ? { fechaCompra: hoy } : {}),
        ...(destino === "Entregado" && !p.fechaEntrega ? { fechaEntrega: hoy } : {}),
        ...(destino === "Entregado" ? recepcion : {}),
      })
      .where(and(eq(pedidos.id, id), eq(pedidos.estado, p.estado), eq(pedidos.cancelado, false)))
      .returning({ id: pedidos.id });
    if (!filas.length) return false;
    // Marcado como entregado (desde el detalle o al completar la recepción): todo lo pedido quedó recibido.
    if (destino === "Entregado") {
      await tx.update(pedidoItems).set({ cantidadRecibida: pedidoItems.cantidad }).where(eq(pedidoItems.pedidoId, id));
    }
    await registrar(id, usuario, "estado", `${p.estado} → ${destino}`, tx);
    return true;
  });
  if (!movido) {
    refrescar();
    return { error: "Otra persona acaba de modificar este pedido. Revisá su estado actual." };
  }

  const aviso = { pedidoId: id, tipo: `estado_${destino.toLowerCase()}`, ...avisoDeEtapa(p, destino, usuario.nombre) };
  // La entrega también le importa a Compras (cierra el circuito); el resto, solo a quien lo pidió.
  const destinatarios = [...(p.creadoPorId ? [p.creadoPorId] : []), ...(destino === "Entregado" ? await idsDeCompras() : [])];
  await notificar(destinatarios, aviso, usuario.id);
  return { ok: true, pedido: p };
}

export async function cambiarEstado(id: number, destino: Estado): Promise<FormState> {
  const usuario = await requireUsuario();
  const r = await moverEstado(usuario, id, destino);
  refrescar();
  if (r.error) return { error: r.error };
  return { ok: true, mensaje: `${codigoPedido(id)} pasó a «${destino}».` };
}

const recepcionSchema = z.object({
  calificacion: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1).max(5).nullable(),
  ),
  comentarioRecepcion: opcional(500),
});

/** Confirmación desde la pantalla del QR: además de la entrega, guarda cómo llegó y una foto opcional. */
export async function confirmarEntrega(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  const id = Number(formData.get("id"));
  const parsed = recepcionSchema.safeParse(datosDe(formData, ["calificacion", "comentarioRecepcion"]));
  if (!parsed.success) return erroresDe(parsed.error);

  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (p.estado !== "Comprando" || !puedeCambiarEstado(usuario, p, "Entregado")) {
    return { error: "Solo se puede confirmar la entrega cuando el pedido ya está comprado." };
  }

  // Con detalle por producto (llego_<id>) es una recepción parcial; sin detalle, llegó todo lo pendiente.
  const conDetalle = [...formData.keys()].some((k) => k.startsWith("llego_"));
  const llegaron = conDetalle
    ? new Map(
        [...formData.entries()]
          .filter(([k]) => k.startsWith("llego_"))
          .map(([k, v]) => [Number(k.slice(6)), Number(v) || 0] as const),
      )
    : undefined;

  type Resultado = { error: string } | { completo: boolean; detalle: string; faltan: number };
  const r: Resultado = await db.transaction(async (tx) => {
    // Bloquea el pedido: dos personas recibiendo a la vez no suman dos veces lo mismo.
    const [actual] = await tx.select().from(pedidos).where(eq(pedidos.id, id)).for("update");
    if (!actual || actual.cancelado || actual.estado !== "Comprando") {
      return { error: "Otra persona acaba de modificar este pedido. Revisá su estado actual." };
    }
    const items = await tx
      .select({ id: pedidoItems.id, producto: pedidoItems.producto, cantidad: pedidoItems.cantidad, cantidadRecibida: pedidoItems.cantidadRecibida })
      .from(pedidoItems)
      .where(eq(pedidoItems.pedidoId, id))
      .orderBy(asc(pedidoItems.orden), asc(pedidoItems.id));
    const rec = aplicarRecepcion(items, llegaron);
    if (!rec.recibidosAhora.length) return { error: "Marcá qué productos llegaron." };
    for (const it of rec.recibidosAhora) {
      await tx.update(pedidoItems).set({ cantidadRecibida: it.cantidadRecibida }).where(eq(pedidoItems.id, it.id));
    }
    const detalle = detalleRecibidos(rec.recibidosAhora);
    if (rec.completo) {
      await tx
        .update(pedidos)
        .set({ estado: "Entregado", estadoDesde: new Date(), ...(actual.fechaEntrega ? {} : { fechaEntrega: hoyISO() }), ...parsed.data })
        .where(eq(pedidos.id, id));
      if (rec.total > 1 || rec.recibidosAhora.length < rec.total) await registrar(id, usuario, "recepcion", `Llegó: ${detalle}`, tx);
      await registrar(id, usuario, "estado", "Comprando → Entregado", tx);
    } else {
      await registrar(id, usuario, "recepcion", `Llegó: ${detalle} · faltan ${rec.unidades - rec.recibidas} u.`, tx);
    }
    return { completo: rec.completo, detalle, faltan: rec.unidades - rec.recibidas };
  });
  if ("error" in r) {
    refrescar();
    return { error: r.error };
  }

  const destinatarios = [...(p.creadoPorId ? [p.creadoPorId] : []), ...(await idsDeCompras())];
  await notificar(
    destinatarios,
    r.completo
      ? { pedidoId: id, tipo: "estado_entregado", ...avisoDeEtapa(p, "Entregado", usuario.nombre) }
      : {
          pedidoId: id,
          tipo: "recepcion_parcial",
          titulo: `Llegó una parte: ${p.producto}`,
          cuerpo: `${usuario.nombre} recibió ${r.detalle} de ${codigoPedido(id)}. Faltan ${r.faltan} unidad(es).`,
        },
    usuario.id,
  );

  let aviso: string | undefined;
  try {
    const g = await guardarAdjuntos(formData, "fotos", id, "recepcion", usuario);
    if (g.length) await registrar(id, usuario, "adjunto", `${g.length} foto(s) de la recepción`);
  } catch (err) {
    if (!(err instanceof ArchivoInvalido)) throw err;
    aviso = `La recepción quedó registrada, pero no se guardó la foto: ${err.message}`;
  }
  refrescar();
  if (aviso) return { error: aviso, stamp: Date.now() };
  return {
    ok: true,
    stamp: Date.now(),
    mensaje: r.completo
      ? `${codigoPedido(id)} entregado. ¡Gracias!`
      : `Recepción parcial registrada. Faltan ${r.faltan} unidad(es) de ${codigoPedido(id)}.`,
  };
}

export async function cancelarPedido(id: number, motivo: string): Promise<FormState> {
  const usuario = await requireUsuario();
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeCancelar(usuario, p)) return { error: "No podés cancelar este pedido." };
  const m = motivo.trim().slice(0, 500) || null;
  const cancelados = await db
    .update(pedidos)
    .set({ cancelado: true, canceladoEn: new Date(), canceladoMotivo: m })
    .where(and(eq(pedidos.id, id), eq(pedidos.cancelado, false)))
    .returning({ id: pedidos.id });
  if (!cancelados.length) return { ok: true, mensaje: `${codigoPedido(id)} ya estaba cancelado.` };
  await registrar(id, usuario, "cancelado", m ?? undefined);
  await notificar(
    [...(p.creadoPorId ? [p.creadoPorId] : []), ...(await idsDeCompras())],
    {
      pedidoId: id,
      tipo: "cancelado",
      titulo: `Pedido cancelado: ${p.producto}`,
      cuerpo: `${usuario.nombre} canceló ${codigoPedido(id)}${m ? `. Motivo: ${m}` : "."}`,
    },
    usuario.id,
  );
  refrescar();
  return { ok: true, mensaje: `${codigoPedido(id)} cancelado.` };
}

export async function reactivarPedido(id: number): Promise<FormState> {
  const usuario = await requireUsuario();
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeReactivar(usuario, p)) return { error: "No podés reactivar este pedido." };
  const reactivados = await db
    .update(pedidos)
    .set({ cancelado: false, canceladoEn: null, canceladoMotivo: null, estadoDesde: new Date() })
    .where(and(eq(pedidos.id, id), eq(pedidos.cancelado, true)))
    .returning({ id: pedidos.id });
  if (!reactivados.length) return { ok: true, mensaje: `${codigoPedido(id)} ya estaba activo.` };
  await registrar(id, usuario, "reactivado");
  refrescar();
  return { ok: true, mensaje: `${codigoPedido(id)} reactivado.` };
}

export async function eliminarPedido(id: number) {
  const usuario = await requireUsuario();
  if (!puedeEliminar(usuario)) return { error: "Solo un administrador puede eliminar pedidos." };
  if (!esIdPedido(id)) return { error: "Pedido inválido." };
  const archivos = await db.select({ ruta: adjuntos.ruta }).from(adjuntos).where(eq(adjuntos.pedidoId, id));
  await db.delete(pedidos).where(eq(pedidos.id, id));
  await Promise.all(archivos.map((a) => borrarArchivo(a.ruta)));
  refrescar();
  redirect("/pedidos");
}

export async function subirReferencias(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  const id = Number(formData.get("id"));
  const p = await cargarPedido(id);
  if (!p) return { error: "El pedido no existe." };
  if (!puedeAdjuntarReferencia(usuario, p)) return { error: "No podés adjuntar archivos a este pedido." };
  try {
    const g = await guardarAdjuntos(formData, "archivos", id, "referencia", usuario);
    if (!g.length) return { error: "Elegí al menos un archivo." };
    await registrar(id, usuario, "adjunto", `${g.length} archivo(s) del sector`);
  } catch (err) {
    if (err instanceof ArchivoInvalido) return { error: err.message };
    throw err;
  }
  refrescar();
  return { ok: true, stamp: Date.now(), mensaje: "Archivos adjuntados." };
}

export async function borrarAdjunto(adjuntoId: string): Promise<FormState> {
  const usuario = await requireUsuario();
  if (!z.uuid().safeParse(adjuntoId).success) return { error: "Archivo inválido." };
  const [a] = await db.select().from(adjuntos).where(eq(adjuntos.id, adjuntoId)).limit(1);
  if (!a) return { error: "El archivo ya no existe." };
  const p = await cargarPedido(a.pedidoId);
  if (!p || !puedeBorrarAdjunto(usuario, p, a.subidoPorId)) return { error: "No podés quitar este archivo." };
  await db.delete(adjuntos).where(and(eq(adjuntos.id, adjuntoId), eq(adjuntos.pedidoId, p.id)));
  await borrarArchivo(a.ruta);
  await registrar(p.id, usuario, "adjunto_borrado", a.nombre);
  refrescar();
  return { ok: true, mensaje: "Archivo quitado." };
}

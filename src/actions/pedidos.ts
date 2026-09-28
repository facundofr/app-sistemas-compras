"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adjuntos, historial, pedidos, type Estado, type Pedido } from "@/db/schema";
import { requireUsuario, type UsuarioSesion } from "@/lib/auth";
import { ARCHIVOS_MAX_POR_ENVIO, esIdPedido, ESTADOS, PRIORIDADES, SELECT_VACIO } from "@/lib/constants";
import { codigoPedido, hoyISO } from "@/lib/format";
import {
  puedeAdjuntarReferencia,
  puedeBorrarAdjunto,
  puedeCambiarEstado,
  puedeCancelar,
  puedeEditarCompra,
  puedeEditarPedido,
  puedeEliminar,
  puedeReactivar,
} from "@/lib/permisos";
import { ArchivoInvalido, archivosDelForm, borrarArchivo, guardarArchivo } from "@/lib/storage";

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
  comentarios: opcional(),
});

const compraSchema = z.object({
  medioCompra: opcional(120),
  proveedor: opcional(200),
  cuit: opcional(20).refine(
    (v) => !v || /^\d{2}-?\d{8}-?\d$/.test(v),
    "El CUIT tiene 11 dígitos (ej: 30-12345678-9).",
  ),
  fechaCompra: fecha,
  fechaEntrega: fecha,
  codigoSeguimiento: opcional(200),
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
  codigoSeguimiento: "Seguimiento",
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

async function registrar(pedidoId: number, usuario: UsuarioSesion, accion: string, detalle?: string) {
  await db.insert(historial).values({ pedidoId, usuarioId: usuario.id, accion, detalle });
}

async function guardarAdjuntos(
  formData: FormData,
  campo: string,
  pedidoId: number,
  tipo: "referencia" | "factura",
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
}

/* ---------------- acciones ---------------- */

export async function crearPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  const parsed = datosPedidoSchema.safeParse(datosDe(formData, Object.keys(datosPedidoSchema.shape)));
  if (!parsed.success) return erroresDe(parsed.error);

  const [nuevo] = await db
    .insert(pedidos)
    .values({ ...parsed.data, prioridad: parsed.data.prioridad as Pedido["prioridad"], creadoPorId: usuario.id })
    .returning({ id: pedidos.id });
  await registrar(nuevo.id, usuario, "creado", "Pedido cargado");

  let aviso: string | undefined;
  try {
    const g = await guardarAdjuntos(formData, "archivos", nuevo.id, "referencia", usuario);
    if (g.length) await registrar(nuevo.id, usuario, "adjunto", `${g.length} archivo(s) del sector`);
  } catch (err) {
    if (!(err instanceof ArchivoInvalido)) throw err;
    aviso = `El pedido se guardó, pero no se adjuntaron los archivos: ${err.message}`;
  }

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
  const parsed = datosPedidoSchema.safeParse(datosDe(formData, Object.keys(datosPedidoSchema.shape)));
  if (!parsed.success) return erroresDe(parsed.error);

  const cambios = camposCambiados(p, parsed.data);
  if (!cambios.length) return { ok: true, stamp: Date.now(), mensaje: "No había cambios para guardar." };
  await db
    .update(pedidos)
    .set({ ...parsed.data, prioridad: parsed.data.prioridad as Pedido["prioridad"] })
    .where(eq(pedidos.id, id));
  await registrar(id, usuario, "edicion", `Cambió: ${cambios.join(", ")}`);
  refrescar();
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
  refrescar();
  if (aviso) return { error: `Se guardaron los datos, pero no la factura: ${aviso}`, stamp: Date.now() };
  return { ok: true, stamp: Date.now(), mensaje: "Datos de compra guardados." };
}

export async function cambiarEstado(id: number, destino: Estado): Promise<FormState> {
  const usuario = await requireUsuario();
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
  // Solo si sigue en la etapa que se leyó: un doble clic o dos personas a la vez no duplican el cambio.
  const movidos = await db
    .update(pedidos)
    .set({
      estado: destino,
      estadoDesde: new Date(),
      ...(destino === "Comprando" && !p.fechaCompra ? { fechaCompra: hoy } : {}),
      ...(destino === "Entregado" && !p.fechaEntrega ? { fechaEntrega: hoy } : {}),
    })
    .where(and(eq(pedidos.id, id), eq(pedidos.estado, p.estado), eq(pedidos.cancelado, false)))
    .returning({ id: pedidos.id });
  if (!movidos.length) {
    refrescar();
    return { error: "Otra persona acaba de modificar este pedido. Revisá su estado actual." };
  }
  await registrar(id, usuario, "estado", `${p.estado} → ${destino}`);
  refrescar();
  return { ok: true, mensaje: `${codigoPedido(id)} pasó a «${destino}».` };
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

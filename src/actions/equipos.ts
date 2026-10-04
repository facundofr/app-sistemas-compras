"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { equipoHistorial, equipos, estadoEquipoEnum, historial, type Equipo } from "@/db/schema";
import { requireUsuario, type UsuarioSesion } from "@/lib/auth";
import { esIdPedido } from "@/lib/constants";
import { codigoEquipo, ESTADOS_EQUIPO } from "@/lib/equipos";
import { codigoPedido } from "@/lib/format";
import { puedeGestionarInventario } from "@/lib/permisos";
import type { FormState } from "./pedidos";

const MAX_POR_ALTA = 50;

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .transform((v) => v || null);

const equipoSchema = z.object({
  descripcion: z.string("Describí el equipo.").trim().min(1, "Describí el equipo.").max(300, "Máximo 300 caracteres."),
  numeroSerie: texto(120),
  estado: z.enum(estadoEquipoEnum.enumValues, "Elegí un estado."),
  asignadoA: texto(120),
  sector: texto(120),
  ubicacion: texto(200),
  garantiaHasta: texto(10).refine((v) => !v || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v), "Fecha inválida."),
  notas: texto(2000),
});
type DatosEquipo = z.infer<typeof equipoSchema>;
const CAMPOS = Object.keys(equipoSchema.shape) as (keyof DatosEquipo)[];

const esSerieRepetida = (err: unknown) =>
  (err as { code?: string; cause?: { code?: string } }).code === "23505" ||
  (err as { cause?: { code?: string } }).cause?.code === "23505";

function refrescar() {
  revalidatePath("/", "layout");
}

async function puede(usuario: UsuarioSesion) {
  return puedeGestionarInventario(usuario.rol);
}

/**
 * Alta de uno o varios equipos (columnas repetidas eq_<campo>). Si viene `pedidoId`, quedan vinculados
 * al pedido: así desde un equipo se llega a su compra (proveedor, factura, fecha) y al revés.
 */
export async function crearEquipos(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  if (!(await puede(usuario))) return { error: "El inventario lo gestiona el equipo de Sistemas." };

  const pedidoId = Number(formData.get("pedidoId")) || null;
  if (pedidoId !== null && !esIdPedido(pedidoId)) return { error: "Pedido inválido." };
  const items = formData.getAll("eq_item").map((v) => Number(v) || null);
  const columnas = Object.fromEntries(CAMPOS.map((c) => [c, formData.getAll(`eq_${c}`)])) as Record<string, FormDataEntryValue[]>;
  const filas = columnas.descripcion.length;
  if (!filas) return { error: "Agregá al menos un equipo." };
  if (filas > MAX_POR_ALTA) return { error: `Hasta ${MAX_POR_ALTA} equipos por vez.` };

  const errores: Record<string, string> = {};
  const datos: DatosEquipo[] = [];
  for (let i = 0; i < filas; i++) {
    const r = equipoSchema.safeParse(Object.fromEntries(CAMPOS.map((c) => [c, columnas[c][i] ?? undefined])));
    if (r.success) datos.push(r.data);
    else for (const issue of r.error.issues) errores[`eq.${i}.${String(issue.path[0])}`] ??= issue.message;
  }
  // Números de serie repetidos dentro del mismo formulario.
  const vistos = new Map<string, number>();
  datos.forEach((d, i) => {
    if (!d.numeroSerie) return;
    const k = d.numeroSerie.toUpperCase();
    if (vistos.has(k)) errores[`eq.${i}.numeroSerie`] = "Este número de serie está repetido.";
    vistos.set(k, i);
  });
  if (Object.keys(errores).length) return { error: "Revisá los campos marcados.", errores };

  try {
    await db.transaction(async (tx) => {
      const nuevos = await tx
        .insert(equipos)
        .values(datos.map((d, i) => ({ ...d, pedidoId, pedidoItemId: items[i] ?? null, creadoPorId: usuario.id })))
        .returning({ id: equipos.id });
      await tx.insert(equipoHistorial).values(
        nuevos.map((n) => ({
          equipoId: n.id,
          usuarioId: usuario.id,
          accion: "alta",
          detalle: pedidoId ? `Desde ${codigoPedido(pedidoId)}` : "Carga manual",
        })),
      );
      if (pedidoId) {
        await tx.insert(historial).values({
          pedidoId,
          usuarioId: usuario.id,
          accion: "equipos",
          detalle: `${nuevos.length} equipo(s) al inventario: ${nuevos.map((n) => codigoEquipo(n.id)).join(", ")}`,
        });
      }
    });
  } catch (err) {
    if (esSerieRepetida(err)) return { error: "Alguno de esos números de serie ya está cargado en el inventario." };
    throw err;
  }
  refrescar();
  return {
    ok: true,
    stamp: Date.now(),
    mensaje: filas === 1 ? "Equipo registrado en el inventario." : `${filas} equipos registrados en el inventario.`,
  };
}

const ETIQUETAS: Record<keyof DatosEquipo, string> = {
  descripcion: "Descripción",
  numeroSerie: "N° de serie",
  estado: "Estado",
  asignadoA: "Asignado a",
  sector: "Sector",
  ubicacion: "Ubicación",
  garantiaHasta: "Garantía",
  notas: "Notas",
};

export async function actualizarEquipo(_prev: FormState, formData: FormData): Promise<FormState> {
  const usuario = await requireUsuario();
  if (!(await puede(usuario))) return { error: "El inventario lo gestiona el equipo de Sistemas." };
  const id = Number(formData.get("id"));
  if (!esIdPedido(id)) return { error: "Equipo inválido." };
  const [actual] = await db.select().from(equipos).where(eq(equipos.id, id)).limit(1);
  if (!actual) return { error: "El equipo no existe." };

  const r = equipoSchema.safeParse(Object.fromEntries(CAMPOS.map((c) => [c, formData.get(c) ?? undefined])));
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const issue of r.error.issues) errores[String(issue.path[0])] ??= issue.message;
    return { error: "Revisá los campos marcados.", errores };
  }
  const d = r.data;
  const distinto = (k: keyof DatosEquipo) => (actual[k as keyof Equipo] ?? null) !== (d[k] ?? null);
  const cambiados = CAMPOS.filter(distinto);
  if (!cambiados.length) return { ok: true, stamp: Date.now(), mensaje: "No había cambios para guardar." };

  // Lo que importa seguir en el tiempo (a quién se le dio, en qué estado está) queda con su valor anterior.
  const eventos: { accion: string; detalle: string }[] = [];
  if (distinto("asignadoA") || distinto("sector")) {
    const quien = (a: string | null, s: string | null) => [a, s].filter(Boolean).join(" · ") || "nadie";
    eventos.push({ accion: "asignacion", detalle: `${quien(actual.asignadoA, actual.sector)} → ${quien(d.asignadoA, d.sector)}` });
  }
  if (distinto("estado")) {
    eventos.push({ accion: "estado", detalle: `${ESTADOS_EQUIPO[actual.estado].nombre} → ${ESTADOS_EQUIPO[d.estado].nombre}` });
  }
  const otros = cambiados.filter((k) => !["asignadoA", "sector", "estado"].includes(k));
  if (otros.length) eventos.push({ accion: "edicion", detalle: `Cambió: ${otros.map((k) => ETIQUETAS[k]).join(", ")}` });

  try {
    await db.transaction(async (tx) => {
      await tx.update(equipos).set(d).where(eq(equipos.id, id));
      await tx.insert(equipoHistorial).values(eventos.map((e) => ({ ...e, equipoId: id, usuarioId: usuario.id })));
    });
  } catch (err) {
    if (esSerieRepetida(err)) return { error: "Ese número de serie ya está cargado en otro equipo.", errores: { numeroSerie: "Ya existe." } };
    throw err;
  }
  refrescar();
  return { ok: true, stamp: Date.now(), mensaje: "Equipo actualizado." };
}


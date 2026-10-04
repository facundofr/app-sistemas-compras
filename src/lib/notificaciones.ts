import "server-only";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { notificaciones, usuarios } from "@/db/schema";
import { conBase } from "./base-path";
import { COLAS, encolar } from "./cola";
import { emailConfigurado } from "./email";
import { pushConfigurado } from "./push";
import { avisarCambio } from "./tiempo-real";

export type NuevaNotificacion = {
  pedidoId?: number;
  tipo: string;
  titulo: string;
  cuerpo?: string;
};

/** Dirección pública de la app, para los links de los emails. APP_URL si está; si no, la del pedido actual. */
async function urlPublica(ruta: string) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "") + ruta;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) return `${h.get("x-forwarded-proto") ?? "http"}://${host}${conBase(ruta)}`;
  } catch {}
  return undefined; // Desde un trabajo de fondo sin APP_URL: el email va sin link.
}

/**
 * Guarda la notificación para cada destinatario (campanita), avisa en vivo y encola email y push.
 * `excluir`: quien hizo la acción no se notifica a sí mismo.
 */
export async function notificar(destinatarios: number[], n: NuevaNotificacion, excluir?: number) {
  const ids = [...new Set(destinatarios)].filter((id) => id !== excluir);
  if (!ids.length) return;
  await db.insert(notificaciones).values(ids.map((usuarioId) => ({ usuarioId, ...n })));
  await Promise.all(ids.map((usuarioId) => avisarCambio({ tipo: "notificacion", usuarioId })));

  const ruta = n.pedidoId ? `/pedidos/${n.pedidoId}` : "/notificaciones";
  if (pushConfigurado()) {
    for (const usuarioId of ids) {
      await encolar(COLAS.push, { usuarioId, titulo: n.titulo, cuerpo: n.cuerpo, url: conBase(ruta) });
    }
  }
  if (emailConfigurado()) {
    const url = await urlPublica(ruta);
    const dest = await db
      .select({ email: usuarios.email })
      .from(usuarios)
      .where(and(inArray(usuarios.id, ids), eq(usuarios.activo, true)));
    for (const d of dest) {
      await encolar(COLAS.email, { para: d.email, asunto: n.titulo, texto: n.cuerpo ?? n.titulo, url });
    }
  }
}

/** Usuarios activos de Compras y Admin, que reciben los avisos de gestión. */
export async function idsDeCompras() {
  const filas = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(inArray(usuarios.rol, ["admin", "compras"]), eq(usuarios.activo, true)));
  return filas.map((f) => f.id);
}

/* ---------------- lectura (campanita) ---------------- */

export async function contarNoLeidas(usuarioId: number) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notificaciones)
    .where(and(eq(notificaciones.usuarioId, usuarioId), isNull(notificaciones.leidaEn)));
  return r.n;
}

export async function listarNotificaciones(usuarioId: number, limite = 50) {
  return db
    .select()
    .from(notificaciones)
    .where(eq(notificaciones.usuarioId, usuarioId))
    .orderBy(desc(notificaciones.createdAt), desc(notificaciones.id))
    .limit(limite);
}

export async function marcarLeidas(usuarioId: number, id?: number) {
  await db
    .update(notificaciones)
    .set({ leidaEn: new Date() })
    .where(
      and(
        eq(notificaciones.usuarioId, usuarioId),
        isNull(notificaciones.leidaEn),
        id ? eq(notificaciones.id, id) : ne(notificaciones.id, 0),
      ),
    );
}

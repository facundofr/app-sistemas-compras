"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { suscripcionesPush } from "@/db/schema";
import { requireUsuario } from "@/lib/auth";
import { marcarLeidas } from "@/lib/notificaciones";

export async function marcarTodasLeidas() {
  const usuario = await requireUsuario();
  await marcarLeidas(usuario.id);
  revalidatePath("/", "layout");
}

/**
 * El servidor le hace POST al endpoint: solo se aceptan los servicios push de los navegadores,
 * para que nadie pueda registrar una dirección interna y usar la app para pegarle (SSRF).
 */
const SERVICIOS_PUSH = [
  "fcm.googleapis.com", // Chrome, Edge en Android, Samsung Internet
  "updates.push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari (web.push.apple.com y similares)
  "notify.windows.com", // Edge en Windows
];
const esServicioPush = (u: string) => {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && SERVICIOS_PUSH.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

const suscripcionSchema = z.object({
  endpoint: z.url().max(2000).refine(esServicioPush, "Servicio push no reconocido."),
  keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }),
});

/** Guarda la suscripción push de este navegador. Si el endpoint ya existía (otro usuario en el mismo celular), pasa a este. */
export async function guardarSuscripcion(sub: unknown) {
  const usuario = await requireUsuario();
  const parsed = suscripcionSchema.safeParse(sub);
  if (!parsed.success) return { error: "Suscripción inválida." };
  const { endpoint, keys } = parsed.data;
  await db
    .insert(suscripcionesPush)
    .values({ endpoint, usuarioId: usuario.id, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: suscripcionesPush.endpoint,
      set: { usuarioId: usuario.id, p256dh: keys.p256dh, auth: keys.auth },
    });
  return { ok: true };
}

export async function borrarSuscripcion(endpoint: string) {
  const usuario = await requireUsuario();
  await db
    .delete(suscripcionesPush)
    .where(and(eq(suscripcionesPush.endpoint, endpoint), eq(suscripcionesPush.usuarioId, usuario.id)));
  return { ok: true };
}

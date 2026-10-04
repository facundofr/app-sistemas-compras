import "server-only";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { suscripcionesPush } from "@/db/schema";

/**
 * Notificaciones push al celular (Web Push). Se activa con VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y
 * VAPID_SUBJECT en el .env (las claves se generan una vez con `npx web-push generate-vapid-keys`).
 */
export const pushConfigurado = () =>
  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

let listo = false;
function configurar() {
  if (listo) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  listo = true;
}

export async function enviarPush(usuarioId: number, m: { titulo: string; cuerpo?: string; url?: string }) {
  if (!pushConfigurado()) return;
  configurar();
  const subs = await db.select().from(suscripcionesPush).where(eq(suscripcionesPush.usuarioId, usuarioId));
  const payload = JSON.stringify({ titulo: m.titulo, cuerpo: m.cuerpo, url: m.url });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err) {
        // 404/410: el navegador dio de baja la suscripción (se desinstaló la app, se borraron datos...).
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(suscripcionesPush).where(eq(suscripcionesPush.endpoint, s.endpoint));
        } else throw err;
      }
    }),
  );
}

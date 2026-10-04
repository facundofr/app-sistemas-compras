import { z } from "zod";
import { getUsuarioActual } from "@/lib/auth";

const errorSchema = z.object({
  mensaje: z.string().max(1000),
  stack: z.string().max(4000).optional(),
  url: z.string().max(500).optional(),
});

/** Errores del navegador (los informa la pantalla de error): al log y, si está configurado, a Sentry. */
export async function POST(req: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario) return new Response(null, { status: 401 });
  const parsed = errorSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const e = parsed.data;
  console.error(`[navegador] ${e.url ?? ""} (${usuario.email}): ${e.mensaje}`);
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    const err = new Error(e.mensaje);
    if (e.stack) err.stack = e.stack;
    Sentry.captureException(err, { tags: { origen: "navegador", ruta: e.url }, user: { id: String(usuario.id) } });
  }
  return new Response(null, { status: 204 });
}

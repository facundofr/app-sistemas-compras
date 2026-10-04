import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Monitoreo de errores: solo si hay SENTRY_DSN en el .env.
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "produccion",
      tracesSampleRate: 0,
    });
  }
  const { bootstrap } = await import("./db/bootstrap");
  await bootstrap();
  if (!process.env.DATABASE_URL) return;
  // Si la cola no arranca, la app sigue funcionando: solo se pierden los envíos de fondo y las revisiones.
  try {
    const { iniciarTrabajos } = await import("./lib/trabajos");
    await iniciarTrabajos();
  } catch (err) {
    console.error("[trabajos] No se pudo iniciar la cola:", err);
  }
}

/** Errores del servidor (páginas, acciones, rutas) → Sentry, si está configurado. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};

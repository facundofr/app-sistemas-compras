import "server-only";
import { PgBoss } from "pg-boss";

/**
 * Cola de tareas en segundo plano (pg-boss, sobre la misma base): emails, push y revisiones periódicas.
 * Así una acción del usuario no espera a que responda un servidor de correo, y si el envío falla se reintenta.
 * Los trabajadores se registran al arrancar (src/lib/trabajos.ts, desde instrumentation.ts).
 */
export const COLAS = {
  email: "enviar-email",
  push: "enviar-push",
  atrasos: "revisar-atrasos",
  mercadolibre: "sincronizar-mercadolibre",
} as const;

const g = globalThis as unknown as { cola?: Promise<PgBoss> };

export function getCola() {
  g.cola ??= (async () => {
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
    boss.on("error", (err) => console.error("[cola]", err));
    await boss.start();
    for (const nombre of Object.values(COLAS)) await boss.createQueue(nombre);
    return boss;
  })();
  return g.cola;
}

/** Encola sin hacer fallar la acción que lo pide: si la cola no anda, se registra el error y listo. */
export async function encolar(nombre: (typeof COLAS)[keyof typeof COLAS], data: object) {
  try {
    const boss = await getCola();
    await boss.send(nombre, data, { retryLimit: 5, retryDelay: 30, retryBackoff: true });
  } catch (err) {
    console.error(`[cola] No se pudo encolar «${nombre}»:`, err);
  }
}

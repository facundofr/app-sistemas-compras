import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import { pool } from "@/db";

/**
 * Avisos en vivo: cada cambio hace NOTIFY en Postgres y /api/eventos se lo pasa a los navegadores
 * abiertos (Server-Sent Events), que recargan solo cuando hace falta en vez de cada 30 segundos.
 * Pasa por Postgres para que funcione igual aunque haya más de una instancia de la app.
 */
const CANAL = "cambios";

export type Cambio = { tipo: "pedidos" } | { tipo: "notificacion"; usuarioId: number };

export async function avisarCambio(cambio: Cambio) {
  try {
    await pool.query("select pg_notify($1, $2)", [CANAL, JSON.stringify(cambio)]);
  } catch (err) {
    console.error("[tiempo-real] No se pudo avisar el cambio:", err);
  }
}

/* Un solo LISTEN por proceso, repartido a todos los navegadores conectados. */
const g = globalThis as unknown as { oyente?: { emisor: EventEmitter; conectando?: Promise<void> } };

function getOyente() {
  if (!g.oyente) {
    const emisor = new EventEmitter();
    emisor.setMaxListeners(0);
    g.oyente = { emisor };
  }
  const o = g.oyente;
  o.conectando ??= (async () => {
    const cliente = new Client({ connectionString: process.env.DATABASE_URL });
    let caido = false;
    const reintentar = () => {
      if (caido) return; // «error» y «end» llegan juntos: se reconecta una sola vez.
      caido = true;
      o.conectando = undefined;
      cliente.end().catch(() => {});
      setTimeout(() => getOyente(), 5000);
    };
    cliente.on("error", reintentar);
    cliente.on("end", reintentar);
    cliente.on("notification", (n) => {
      if (n.channel !== CANAL || !n.payload) return;
      try {
        o.emisor.emit("cambio", JSON.parse(n.payload) as Cambio);
      } catch {}
    });
    await cliente.connect();
    await cliente.query(`listen ${CANAL}`);
  })().catch((err) => {
    console.error("[tiempo-real] No se pudo escuchar la base:", err);
    o.conectando = undefined;
  });
  return o;
}

export function suscribirCambios(fn: (c: Cambio) => void) {
  const o = getOyente();
  o.emisor.on("cambio", fn);
  return () => o.emisor.off("cambio", fn);
}

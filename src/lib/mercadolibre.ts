import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { integraciones } from "@/db/schema";

/**
 * Integración con la API de Mercado Libre (cuenta compradora de Compras).
 * Se activa con ML_CLIENT_ID y ML_CLIENT_SECRET (una app creada en developers.mercadolibre.com.ar)
 * y APP_URL; un admin conecta la cuenta una vez desde «Integraciones».
 */
const API = "https://api.mercadolibre.com";
const AUTH = "https://auth.mercadolibre.com.ar/authorization";
const CLAVE = "mercadolibre";

export const mlConfigurado = () => !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET && process.env.APP_URL);
export const urlCallback = () => `${process.env.APP_URL!.replace(/\/$/, "")}/api/mercadolibre/callback`;

type Credenciales = { accessToken: string; refreshToken: string; expiraEn: number; userId: number; nickname?: string };

export function urlAutorizacion(state: string) {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ML_CLIENT_ID!,
    redirect_uri: urlCallback(),
    state,
  });
  return `${AUTH}?${q}`;
}

async function pedirToken(params: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: process.env.ML_CLIENT_ID!, client_secret: process.env.ML_CLIENT_SECRET!, ...params }),
  });
  if (!res.ok) throw new Error(`Mercado Libre rechazó el token (${res.status}): ${await res.text()}`);
  const t = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    // Un minuto de margen para no usar un token que vence en el camino.
    expiraEn: Date.now() + (t.expires_in - 60) * 1000,
    userId: t.user_id,
  } satisfies Credenciales;
}

async function guardar(c: Credenciales) {
  await db.insert(integraciones).values({ clave: CLAVE, datos: c }).onConflictDoUpdate({ target: integraciones.clave, set: { datos: c } });
}

export async function canjearCodigo(code: string) {
  const c: Credenciales = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: urlCallback() });
  const yo = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${c.accessToken}` } });
  if (yo.ok) c.nickname = ((await yo.json()) as { nickname?: string }).nickname;
  await guardar(c);
  return c;
}

export async function estadoConexion() {
  const [r] = await db.select().from(integraciones).where(eq(integraciones.clave, CLAVE)).limit(1);
  const c = r?.datos as Credenciales | undefined;
  return c ? { conectado: true as const, nickname: c.nickname, desde: r.updatedAt } : { conectado: false as const };
}

export async function desconectar() {
  await db.delete(integraciones).where(eq(integraciones.clave, CLAVE));
}

/** Token vigente; si venció, lo renueva (el refresh token de Mercado Libre es de un solo uso: se guarda el nuevo). */
async function token() {
  const [r] = await db.select().from(integraciones).where(eq(integraciones.clave, CLAVE)).limit(1);
  const c = r?.datos as Credenciales | undefined;
  if (!c) return null;
  if (Date.now() < c.expiraEn) return c.accessToken;
  const nuevo = { ...(await pedirToken({ grant_type: "refresh_token", refresh_token: c.refreshToken })), nickname: c.nickname };
  await guardar(nuevo);
  return nuevo.accessToken;
}

async function get<T>(ruta: string, tk: string, extra: Record<string, string> = {}) {
  const res = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${tk}`, Accept: "application/json", ...extra } });
  if (!res.ok) throw new Error(`Mercado Libre ${ruta} → ${res.status}`);
  return (await res.json()) as T;
}

export type EstadoEnvioML = {
  estado: string; // pending | handling | ready_to_ship | shipped | delivered | not_delivered | cancelled
  seguimiento?: string;
  fechaEstimada?: string; // YYYY-MM-DD
};

const soloFecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);

/** Estado del envío de una orden de compra. Lee los campos con tolerancia porque la API tiene dos formatos de envío. */
export async function consultarOrden(ordenId: string): Promise<EstadoEnvioML | null> {
  const tk = await token();
  if (!tk) return null;
  const orden = await get<{ shipping?: { id?: number } }>(`/orders/${encodeURIComponent(ordenId)}`, tk);
  const envioId = orden.shipping?.id;
  if (!envioId) return { estado: "sin_envio" };
  const e = await get<{
    status?: string;
    tracking_number?: string;
    shipping_option?: { estimated_delivery_time?: { date?: string } };
    lead_time?: { estimated_delivery_time?: { date?: string } };
  }>(`/shipments/${envioId}`, tk, { "x-format-new": "true" });
  return {
    estado: e.status ?? "desconocido",
    seguimiento: e.tracking_number || undefined,
    fechaEstimada: soloFecha(e.lead_time?.estimated_delivery_time?.date) ?? soloFecha(e.shipping_option?.estimated_delivery_time?.date),
  };
}

export const ESTADO_ENVIO_ML: Record<string, string> = {
  pending: "Pendiente",
  handling: "Preparando el envío",
  ready_to_ship: "Listo para enviar",
  shipped: "En camino",
  delivered: "Entregado según Mercado Libre",
  not_delivered: "No se pudo entregar",
  cancelled: "Envío cancelado",
  sin_envio: "Sin envío (retiro o acordar con el vendedor)",
};

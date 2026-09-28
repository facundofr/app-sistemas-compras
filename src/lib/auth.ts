import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sesiones, usuarios, type Rol } from "@/db/schema";
import { BASE_PATH } from "./base-path";

const COOKIE = "ps_sesion";
const DURACION_MS = 30 * 24 * 60 * 60 * 1000;
// La cookie solo viaja a esta app, no al resto de las páginas del dominio.
const COOKIE_PATH = BASE_PATH || "/";

export type UsuarioSesion = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function cookieSegura() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  // Detrás de Caddy con HTTPS llega x-forwarded-proto=https; entrando directo por HTTP (IP:puerto) no.
  const h = await headers();
  return h.get("x-forwarded-proto") === "https";
}

export async function crearSesion(usuarioId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_MS);
  await db.insert(sesiones).values({ id: hashToken(token), usuarioId, expiraEn });
  // Limpieza oportunista de sesiones vencidas.
  await db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSegura(),
    path: COOKIE_PATH,
    expires: expiraEn,
  });
}

export async function cerrarSesion() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.id, hashToken(token)));
  store.delete({ name: COOKIE, path: COOKIE_PATH });
}

export const getUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
    })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(
      and(eq(sesiones.id, hashToken(token)), gt(sesiones.expiraEn, new Date()), eq(usuarios.activo, true)),
    )
    .limit(1);
  return row ?? null;
});

export async function requireUsuario() {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  return usuario;
}

export async function requireRol(...roles: Rol[]) {
  const usuario = await requireUsuario();
  if (!roles.includes(usuario.rol)) redirect("/");
  return usuario;
}

export async function cerrarSesionesDeUsuario(usuarioId: number) {
  await db.delete(sesiones).where(eq(sesiones.usuarioId, usuarioId));
}

/* Límite simple de intentos de login por IP + email (en memoria, suficiente para una sola instancia). */
const intentos = new Map<string, number[]>();
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 8;

export async function claveLimite(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${ip}|${email}`;
}

export function limiteExcedido(clave: string) {
  const ahora = Date.now();
  const lista = (intentos.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
  intentos.set(clave, lista);
  return lista.length >= MAX_INTENTOS;
}

export function registrarFallo(clave: string) {
  const lista = intentos.get(clave) ?? [];
  lista.push(Date.now());
  intentos.set(clave, lista);
}

export function limpiarFallos(clave: string) {
  intentos.delete(clave);
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { intentosLogin, sesiones, usuarios, type Rol } from "@/db/schema";
import {
  COOKIE_PATH,
  COOKIE_SESION as COOKIE,
  DURACION_SESION_MS as DURACION_MS,
  esCookieSegura,
  HEADER_RUTA,
  opcionesCookieSesion,
  RENOVAR_SESION_MS,
} from "./sesion-cookie";

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
  return esCookieSegura((await headers()).get("x-forwarded-proto"));
}

export async function crearSesion(usuarioId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_MS);
  await db.insert(sesiones).values({ id: hashToken(token), usuarioId, expiraEn });
  // Limpieza oportunista de sesiones vencidas.
  await db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));

  const store = await cookies();
  store.set(COOKIE, token, opcionesCookieSesion(await cookieSegura(), expiraEn));
}

export async function cerrarSesion() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.id, hashToken(token)));
  store.delete({ name: COOKIE, path: COOKIE_PATH });
}

/**
 * La sesión se renueva con el uso: si le quedan menos de RENOVAR_SESION_MS, se extiende en la base.
 * La cookie del navegador la extiende src/proxy.ts (los Server Components no pueden escribir cookies).
 */
export const getUsuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      expiraEn: sesiones.expiraEn,
    })
    .from(sesiones)
    .innerJoin(usuarios, eq(usuarios.id, sesiones.usuarioId))
    .where(and(eq(sesiones.id, id), gt(sesiones.expiraEn, new Date()), eq(usuarios.activo, true)))
    .limit(1);
  if (!row) return null;
  const { expiraEn, ...usuario } = row;
  if (expiraEn.getTime() - Date.now() < RENOVAR_SESION_MS) {
    await db
      .update(sesiones)
      .set({ expiraEn: new Date(Date.now() + DURACION_MS) })
      .where(eq(sesiones.id, id));
  }
  return usuario;
});

/** Sin sesión manda al login, que después vuelve a la página pedida (la ruta la agrega src/proxy.ts). */
export async function requireUsuario() {
  const usuario = await getUsuarioActual();
  if (!usuario) {
    const ruta = (await headers()).get(HEADER_RUTA);
    redirect(ruta && ruta !== "/" ? `/login?next=${encodeURIComponent(ruta)}` : "/login");
  }
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

/* Límite de intentos de login por IP + email: en la base, así no se reinicia al reiniciar la app. */
const VENTANA = sql`interval '15 minutes'`;
const MAX_INTENTOS = 8;

export async function claveLimite(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${ip}|${email}`;
}

export async function limiteExcedido(clave: string) {
  const [r] = await db
    .select({ fallos: intentosLogin.fallos })
    .from(intentosLogin)
    .where(and(eq(intentosLogin.clave, clave), gt(intentosLogin.desde, sql`now() - ${VENTANA}`)))
    .limit(1);
  return (r?.fallos ?? 0) >= MAX_INTENTOS;
}

/** Ventana fija de 15 minutos desde el primer fallo: pasada la ventana, el contador vuelve a 1. */
export async function registrarFallo(clave: string) {
  await db
    .insert(intentosLogin)
    .values({ clave, fallos: 1 })
    .onConflictDoUpdate({
      target: intentosLogin.clave,
      set: {
        fallos: sql`case when ${intentosLogin.desde} > now() - ${VENTANA} then ${intentosLogin.fallos} + 1 else 1 end`,
        desde: sql`case when ${intentosLogin.desde} > now() - ${VENTANA} then ${intentosLogin.desde} else now() end`,
      },
    });
  // Limpieza oportunista de ventanas vencidas.
  await db.delete(intentosLogin).where(lt(intentosLogin.desde, sql`now() - interval '1 day'`));
}

export async function limpiarFallos(clave: string) {
  await db.delete(intentosLogin).where(eq(intentosLogin.clave, clave));
}

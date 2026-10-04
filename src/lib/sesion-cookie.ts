import { BASE_PATH } from "./base-path";

/* Datos de la cookie de sesión compartidos por auth.ts y src/proxy.ts (que no puede importar la base). */

export const COOKIE_SESION = "ps_sesion";
export const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
/** Si a la sesión le queda menos que esto, se extiende otra vez a DURACION_SESION_MS. */
export const RENOVAR_SESION_MS = 15 * 24 * 60 * 60 * 1000;
// La cookie solo viaja a esta app, no al resto de las páginas del dominio.
export const COOKIE_PATH = BASE_PATH || "/";

/** Detrás de Caddy con HTTPS llega x-forwarded-proto=https; entrando directo por HTTP (IP:puerto) no. */
export function esCookieSegura(forwardedProto: string | null) {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return forwardedProto === "https";
}

export const opcionesCookieSesion = (secure: boolean, expires: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: COOKIE_PATH,
  expires,
});

/** Header con la ruta pedida que agrega src/proxy.ts, para volver a ella después del login. */
export const HEADER_RUTA = "x-ruta-pedida";

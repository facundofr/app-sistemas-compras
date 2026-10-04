import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_SESION,
  DURACION_SESION_MS,
  esCookieSegura,
  HEADER_RUTA,
  opcionesCookieSesion,
} from "@/lib/sesion-cookie";

/**
 * 1. Pasa la ruta pedida (sin el basePath) a requireUsuario(), para volver a ella después del login:
 *    así quien escanea un QR sin sesión termina en la confirmación de entrega y no en el inicio.
 * 2. Renueva la cookie de sesión al navegar, para que quien use la app no tenga que volver a ingresar.
 *    Solo en GET: login y logout (POST) escriben la cookie ellos mismos y no tienen que pisarse.
 *    La validez real la decide la base (auth.ts), que también se extiende con el uso.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(HEADER_RUTA, request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.next({ request: { headers } });

  const token = request.cookies.get(COOKIE_SESION)?.value;
  if (token && request.method === "GET") {
    response.cookies.set(
      COOKIE_SESION,
      token,
      opcionesCookieSesion(
        esCookieSegura(request.headers.get("x-forwarded-proto")),
        new Date(Date.now() + DURACION_SESION_MS),
      ),
    );
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icono|apple-icon|api/health).*)"],
};

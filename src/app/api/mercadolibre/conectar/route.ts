import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRol } from "@/lib/auth";
import { mlConfigurado, urlAutorizacion } from "@/lib/mercadolibre";
import { COOKIE_PATH } from "@/lib/sesion-cookie";

/** Manda al admin a autorizar la app en Mercado Libre. El `state` en cookie evita que otro sitio complete el flujo. */
export async function GET() {
  await requireRol("admin");
  if (!mlConfigurado()) redirect("/admin/integraciones?ml=sin-configurar");
  const state = randomBytes(16).toString("base64url");
  (await cookies()).set("ml_state", state, { httpOnly: true, sameSite: "lax", path: COOKIE_PATH, maxAge: 600 });
  redirect(urlAutorizacion(state));
}

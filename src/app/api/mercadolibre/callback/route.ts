import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireRol } from "@/lib/auth";
import { canjearCodigo } from "@/lib/mercadolibre";
import { COOKIE_PATH } from "@/lib/sesion-cookie";

/** Vuelta de Mercado Libre después de autorizar: canjea el código por los tokens y los guarda. */
export async function GET(req: NextRequest) {
  await requireRol("admin");
  const store = await cookies();
  const esperado = store.get("ml_state")?.value;
  store.delete({ name: "ml_state", path: COOKIE_PATH });
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !esperado || req.nextUrl.searchParams.get("state") !== esperado) redirect("/admin/integraciones?ml=error");
  let ok = true;
  try {
    await canjearCodigo(code);
  } catch (err) {
    console.error("[mercadolibre] No se pudo conectar:", err);
    ok = false;
  }
  redirect(`/admin/integraciones?ml=${ok ? "conectado" : "error"}`);
}

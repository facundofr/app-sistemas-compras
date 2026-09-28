import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adjuntos } from "@/db/schema";
import { getUsuarioActual } from "@/lib/auth";
import { MIME_EN_LINEA } from "@/lib/constants";
import { leerArchivo } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: RouteContext<"/api/archivos/[id]">) {
  if (!(await getUsuarioActual())) return new Response("No autorizado", { status: 401 });

  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("No encontrado", { status: 404 });
  const [a] = await db.select().from(adjuntos).where(eq(adjuntos.id, id)).limit(1);
  if (!a) return new Response("No encontrado", { status: 404 });

  let data: Buffer;
  try {
    data = await leerArchivo(a.ruta);
  } catch {
    return new Response("El archivo no está en el servidor", { status: 404 });
  }

  const enLinea = MIME_EN_LINEA.includes(a.mime) && !req.nextUrl.searchParams.has("descargar");
  const disposicion = enLinea ? "inline" : "attachment";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": a.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `${disposicion}; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      "Cache-Control": "private, max-age=86400",
      // Solo se guardan archivos verificados por contenido; nosniff evita que se interpreten como otra cosa.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

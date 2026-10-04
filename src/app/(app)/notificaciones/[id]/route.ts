import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { notificaciones } from "@/db/schema";
import { requireUsuario } from "@/lib/auth";
import { marcarLeidas } from "@/lib/notificaciones";

/** Abrir una notificación: la marca como leída y lleva al pedido. */
export async function GET(_req: Request, ctx: RouteContext<"/notificaciones/[id]">) {
  const usuario = await requireUsuario();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) redirect("/notificaciones");
  const [n] = await db
    .select({ pedidoId: notificaciones.pedidoId })
    .from(notificaciones)
    .where(and(eq(notificaciones.id, id), eq(notificaciones.usuarioId, usuario.id)))
    .limit(1);
  if (!n) redirect("/notificaciones");
  await marcarLeidas(usuario.id, id);
  redirect(n.pedidoId ? `/pedidos/${n.pedidoId}` : "/notificaciones");
}

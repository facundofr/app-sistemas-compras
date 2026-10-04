import { iconoApp } from "@/lib/icono-app";

/** Íconos PNG que pide manifest.ts: /icono/192 y /icono/512. */
export async function GET(_req: Request, ctx: RouteContext<"/icono/[tamano]">) {
  const { tamano } = await ctx.params;
  if (tamano !== "192" && tamano !== "512") return new Response("No encontrado", { status: 404 });
  return iconoApp(Number(tamano));
}

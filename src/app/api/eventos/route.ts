import { getUsuarioActual } from "@/lib/auth";
import { suscribirCambios } from "@/lib/tiempo-real";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: avisa al navegador cuando cambió algo que le importa, para que recargue los datos.
 * Solo manda el tipo de cambio, nunca datos: el navegador los vuelve a pedir con su sesión.
 */
export async function GET(req: Request) {
  const usuario = await getUsuarioActual();
  if (!usuario) return new Response("Sin sesión", { status: 401 });

  const enc = new TextEncoder();
  let cerrar = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const enviar = (evento: string) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${evento}\ndata: {}\n\n`));
        } catch {
          cerrar();
        }
      };
      ctrl.enqueue(enc.encode("retry: 5000\n\n"));
      const baja = suscribirCambios((c) => {
        if (c.tipo === "pedidos") enviar("pedidos");
        else if (c.usuarioId === usuario.id) enviar("notificacion");
      });
      // Comentario cada 25 s para que ningún proxy corte la conexión por inactividad.
      const latido = setInterval(() => {
        try {
          ctrl.enqueue(enc.encode(": latido\n\n"));
        } catch {
          cerrar();
        }
      }, 25_000);
      cerrar = () => {
        clearInterval(latido);
        baja();
        try {
          ctrl.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cerrar());
    },
    cancel() {
      cerrar();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform: que Caddy no lo comprima ni lo retenga.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

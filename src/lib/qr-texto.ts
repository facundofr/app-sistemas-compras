import { esIdPedido } from "./constants";

/** Ruta (sin basePath) de la pantalla que abre el QR pegado en el paquete. */
export const rutaRecibir = (id: number) => `/pedidos/${id}/recibir`;

/** Acepta el link de la etiqueta (…/pedidos/42/recibir), el código impreso (PED-00042) o el número solo. */
export function idDesdeTexto(texto: string): number | null {
  const t = texto.trim();
  const m = t.match(/\/pedidos\/(\d+)\/recibir\b/) ?? t.match(/^(?:PED-?)?0*(\d+)$/i);
  const id = m ? Number(m[1]) : NaN;
  return esIdPedido(id) ? id : null;
}

/** Etiqueta de un equipo del inventario: el link (…/equipos/7) o el código impreso (EQ-00007). */
export function idEquipoDesdeTexto(texto: string): number | null {
  const t = texto.trim();
  const m = t.match(/\/equipos\/(\d+)(?:[/?#]|$)/) ?? t.match(/^EQ-?0*(\d+)$/i);
  const id = m ? Number(m[1]) : NaN;
  return esIdPedido(id) ? id : null;
}

/** Qué abre un código leído: la recepción de un pedido o la ficha de un equipo. */
export function destinoDesdeTexto(texto: string): { tipo: "pedido" | "equipo"; id: number } | null {
  const equipo = idEquipoDesdeTexto(texto);
  if (equipo) return { tipo: "equipo", id: equipo };
  const pedido = idDesdeTexto(texto);
  return pedido ? { tipo: "pedido", id: pedido } : null;
}

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

/**
 * A partir del código de seguimiento que carga Compras, arma el acceso más útil:
 * si es un link, el link; si la compra fue por Mercado Libre, «Mis compras»; si no, el código para copiar
 * con el nombre del correo cuando se reconoce el formato.
 */
export type Seguimiento = { codigo: string; empresa?: string; url?: string };

const MIS_COMPRAS_ML = "https://myaccount.mercadolibre.com.ar/my_purchases/list";

export function seguimientoDe(codigo: string | null, medioCompra?: string | null): Seguimiento | null {
  const c = codigo?.trim();
  if (!c) return null;
  if (/^https?:\/\/\S+$/i.test(c)) {
    let empresa: string | undefined;
    try {
      empresa = new URL(c).hostname.replace(/^www\./, "");
    } catch {}
    return { codigo: c, empresa, url: c };
  }
  if (/mercado\s*libre/i.test(medioCompra ?? "")) return { codigo: c, empresa: "Mercado Libre", url: MIS_COMPRAS_ML };
  // Formato internacional S10 (dos letras, 9 dígitos, «AR»): Correo Argentino.
  if (/^[A-Z]{2}\d{9}AR$/i.test(c)) return { codigo: c.toUpperCase(), empresa: "Correo Argentino" };
  return { codigo: c };
}

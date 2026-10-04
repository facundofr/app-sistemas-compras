export type ItemPedido = { producto: string; cantidad: number; link: string | null };

export const ITEMS_MAX = 20;

/**
 * Lo que se guarda en `pedidos` a partir de los ítems: el producto como resumen,
 * la cantidad total y el link del primero. Así los listados y la búsqueda no cambian.
 */
export function resumenItems(items: ItemPedido[]) {
  const [primero, ...resto] = items;
  const producto = resto.length
    ? `${primero.producto} y ${resto.length} ${resto.length === 1 ? "producto más" : "productos más"}`
    : primero.producto;
  return {
    producto: producto.slice(0, 500),
    cantidad: items.reduce((s, i) => s + i.cantidad, 0),
    link: primero.link,
  };
}

/** Junta las columnas repetidas del formulario (item_producto, item_cantidad, item_link) en filas. */
export function filasDeItems(campos: { producto: unknown[]; cantidad: unknown[]; link: unknown[] }) {
  return campos.producto.map((producto, i) => ({
    producto: typeof producto === "string" ? producto : "",
    cantidad: campos.cantidad[i] ?? "",
    link: campos.link[i] ?? "",
  }));
}

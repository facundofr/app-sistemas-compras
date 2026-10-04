export type ItemRecepcion = { id: number; producto: string; cantidad: number; cantidadRecibida: number };

/** Cuánto llegó de un pedido: para la frase de estado, los listados y saber si ya está completo. */
export function resumenRecepcion(items: Pick<ItemRecepcion, "cantidad" | "cantidadRecibida">[]) {
  const total = items.length;
  const completos = items.filter((i) => i.cantidadRecibida >= i.cantidad).length;
  const unidades = items.reduce((s, i) => s + i.cantidad, 0);
  const recibidas = items.reduce((s, i) => s + Math.min(i.cantidadRecibida, i.cantidad), 0);
  return { total, completos, unidades, recibidas, completo: total > 0 && completos === total, parcial: recibidas > 0 && recibidas < unidades };
}

/**
 * Suma lo que llegó ahora a lo ya recibido, sin pasarse de lo pedido.
 * `llegaron`: unidades por id de ítem; sin datos (confirmación de un toque), se toma que llegó todo lo pendiente.
 */
export function aplicarRecepcion(items: ItemRecepcion[], llegaron?: Map<number, number>) {
  const nuevos = items.map((i) => {
    const pendiente = Math.max(0, i.cantidad - i.cantidadRecibida);
    const llego = llegaron ? Math.max(0, Math.min(pendiente, Math.floor(llegaron.get(i.id) ?? 0))) : pendiente;
    return { ...i, llego, cantidadRecibida: i.cantidadRecibida + llego };
  });
  const recibidosAhora = nuevos.filter((i) => i.llego > 0);
  return { items: nuevos, recibidosAhora, ...resumenRecepcion(nuevos) };
}

/** «2× Monitor, 1× Cable HDMI»: lo que llegó en esta recepción, para el historial y el aviso. */
export const detalleRecibidos = (items: { producto: string; llego: number }[]) =>
  items.map((i) => `${i.llego}× ${i.producto}`).join(", ");

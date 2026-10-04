import type { Estado } from "@/db/schema";
import { fmtDate } from "./format";

export type FraseEstado = { texto: string; tono: "ok" | "info" | "alerta" | "apagado" };

type P = {
  estado: Estado;
  cancelado: boolean;
  fechaEstimada: string | null;
  fechaCompra: string | null;
  fechaEntrega: string | null;
  proveedor?: string | null;
};

const DIA = 86_400_000;
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const diaSemana = (iso: string) =>
  new Date(utc(iso)).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
const corta = (iso: string) => fmtDate(iso).slice(0, 5);

/**
 * Una frase que dice en qué está el pedido y qué falta, como el «Llega el jueves» de Mercado Libre.
 * `hoy` es la fecha de hoy en Argentina ("YYYY-MM-DD"): se pasa para que sea fácil de testear.
 */
export function fraseEstado(p: P, hoy: string): FraseEstado {
  if (p.cancelado) return { texto: "Pedido cancelado", tono: "apagado" };
  switch (p.estado) {
    case "Solicitado":
      return { texto: "Esperando que Compras lo tome", tono: "info" };
    case "Cotizando":
      return { texto: "Compras está pidiendo precios", tono: "info" };
    case "Entregado":
      return { texto: p.fechaEntrega ? `Entregado el ${corta(p.fechaEntrega)}` : "Entregado", tono: "ok" };
    case "Comprando": {
      const desde = p.proveedor ? ` · ${p.proveedor}` : "";
      if (!p.fechaEstimada) {
        return { texto: `Comprado${p.fechaCompra ? ` el ${corta(p.fechaCompra)}` : ""}, esperando la entrega${desde}`, tono: "info" };
      }
      const dias = Math.round((utc(p.fechaEstimada) - utc(hoy)) / DIA);
      if (dias < 0) {
        return { texto: `Atrasado: tenía que llegar el ${corta(p.fechaEstimada)}`, tono: "alerta" };
      }
      if (dias === 0) return { texto: `Llega hoy${desde}`, tono: "ok" };
      if (dias === 1) return { texto: `Llega mañana${desde}`, tono: "ok" };
      if (dias < 7) return { texto: `Llega el ${diaSemana(p.fechaEstimada)} ${corta(p.fechaEstimada)}${desde}`, tono: "ok" };
      return { texto: `Llega aprox. el ${corta(p.fechaEstimada)}${desde}`, tono: "ok" };
    }
  }
}

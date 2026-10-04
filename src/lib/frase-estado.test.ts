import { describe, expect, it } from "vitest";
import { fraseEstado } from "./frase-estado";

const base = { cancelado: false, fechaEstimada: null, fechaCompra: null, fechaEntrega: null, proveedor: null };
const HOY = "2026-10-05"; // lunes

describe("frase de estado", () => {
  it("antes de comprar dice quién lo tiene", () => {
    expect(fraseEstado({ ...base, estado: "Solicitado" }, HOY).texto).toBe("Esperando que Compras lo tome");
    expect(fraseEstado({ ...base, estado: "Cotizando" }, HOY).texto).toBe("Compras está pidiendo precios");
  });
  it("comprado sin fecha estimada", () => {
    const f = fraseEstado({ ...base, estado: "Comprando", fechaCompra: "2026-10-01" }, HOY);
    expect(f.texto).toBe("Comprado el 01/10, esperando la entrega");
  });
  it("cuenta los días hasta la entrega estimada", () => {
    const c = { ...base, estado: "Comprando" as const, proveedor: "Mercado Libre" };
    expect(fraseEstado({ ...c, fechaEstimada: HOY }, HOY).texto).toBe("Llega hoy · Mercado Libre");
    expect(fraseEstado({ ...c, fechaEstimada: "2026-10-06" }, HOY).texto).toBe("Llega mañana · Mercado Libre");
    expect(fraseEstado({ ...c, fechaEstimada: "2026-10-08" }, HOY).texto).toBe("Llega el jueves 08/10 · Mercado Libre");
    expect(fraseEstado({ ...c, fechaEstimada: "2026-10-20" }, HOY).texto).toBe("Llega aprox. el 20/10 · Mercado Libre");
  });
  it("marca el atraso como alerta", () => {
    const f = fraseEstado({ ...base, estado: "Comprando", fechaEstimada: "2026-10-02" }, HOY);
    expect(f).toEqual({ texto: "Atrasado: tenía que llegar el 02/10", tono: "alerta" });
  });
  it("recepción parcial", () => {
    const f = fraseEstado({ ...base, estado: "Comprando", fechaEstimada: "2026-10-08", cantidad: 4, recibidas: 2 }, HOY);
    expect(f.texto).toBe("Llegó una parte: 2 de 4 unidades");
  });
  it("entregado y cancelado", () => {
    expect(fraseEstado({ ...base, estado: "Entregado", fechaEntrega: "2026-10-03" }, HOY).texto).toBe("Entregado el 03/10");
    expect(fraseEstado({ ...base, estado: "Comprando", cancelado: true }, HOY).tono).toBe("apagado");
  });
});

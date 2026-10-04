import { describe, expect, it } from "vitest";
import { aplicarRecepcion, detalleRecibidos, resumenRecepcion } from "./recepcion";

const items = [
  { id: 1, producto: "Monitor", cantidad: 2, cantidadRecibida: 0 },
  { id: 2, producto: "Cable HDMI", cantidad: 2, cantidadRecibida: 0 },
];

describe("recepción parcial", () => {
  it("sin detalle, se recibe todo lo pendiente", () => {
    const r = aplicarRecepcion(items);
    expect(r.completo).toBe(true);
    expect(r.recibidosAhora.map((i) => i.llego)).toEqual([2, 2]);
  });
  it("con detalle, suma solo lo que llegó y queda parcial", () => {
    const r = aplicarRecepcion(items, new Map([[1, 2]]));
    expect(r.completo).toBe(false);
    expect(r.parcial).toBe(true);
    expect(r.completos).toBe(1);
    expect(detalleRecibidos(r.recibidosAhora)).toBe("2× Monitor");
  });
  it("no se pasa de lo pedido ni acepta negativos", () => {
    const r = aplicarRecepcion(
      [{ id: 1, producto: "Monitor", cantidad: 2, cantidadRecibida: 1 }],
      new Map([[1, 5]]),
    );
    expect(r.items[0].cantidadRecibida).toBe(2);
    expect(aplicarRecepcion(items, new Map([[1, -3]])).recibidosAhora).toHaveLength(0);
  });
  it("completa en una segunda recepción", () => {
    const primera = aplicarRecepcion(items, new Map([[1, 2]]));
    const segunda = aplicarRecepcion(primera.items, new Map([[2, 2]]));
    expect(segunda.completo).toBe(true);
    expect(detalleRecibidos(segunda.recibidosAhora)).toBe("2× Cable HDMI");
  });
  it("resume cuánto llegó", () => {
    expect(resumenRecepcion([{ cantidad: 3, cantidadRecibida: 1 }])).toEqual({
      total: 1,
      completos: 0,
      unidades: 3,
      recibidas: 1,
      completo: false,
      parcial: true,
    });
  });
});

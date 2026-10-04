import { describe, expect, it } from "vitest";
import { filasDeItems, resumenItems } from "./items";

describe("ítems del pedido", () => {
  it("con un solo ítem el resumen es el producto", () => {
    expect(resumenItems([{ producto: "Monitor 24''", cantidad: 2, link: "https://x" }])).toEqual({
      producto: "Monitor 24''",
      cantidad: 2,
      link: "https://x",
    });
  });
  it("con varios, resume y suma las unidades", () => {
    const r = resumenItems([
      { producto: "Monitor 24''", cantidad: 2, link: "a" },
      { producto: "Cable HDMI", cantidad: 2, link: null },
      { producto: "Soporte", cantidad: 1, link: null },
    ]);
    expect(r).toEqual({ producto: "Monitor 24'' y 2 productos más", cantidad: 5, link: "a" });
    expect(resumenItems([{ producto: "A", cantidad: 1, link: null }, { producto: "B", cantidad: 1, link: null }]).producto).toBe(
      "A y 1 producto más",
    );
  });
  it("arma las filas desde las columnas repetidas del formulario", () => {
    expect(filasDeItems({ producto: ["A", "B"], cantidad: ["1", "3"], link: ["x"] })).toEqual([
      { producto: "A", cantidad: "1", link: "x" },
      { producto: "B", cantidad: "3", link: "" },
    ]);
  });
});

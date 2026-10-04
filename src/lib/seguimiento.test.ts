import { describe, expect, it } from "vitest";
import { seguimientoDe } from "./seguimiento";

describe("seguimiento del envío", () => {
  it("sin código no hay nada", () => {
    expect(seguimientoDe(null)).toBeNull();
    expect(seguimientoDe("  ")).toBeNull();
  });
  it("un link se usa tal cual", () => {
    expect(seguimientoDe("https://www.andreani.com/envio/123")).toEqual({
      codigo: "https://www.andreani.com/envio/123",
      empresa: "andreani.com",
      url: "https://www.andreani.com/envio/123",
    });
  });
  it("las compras de Mercado Libre van a «Mis compras»", () => {
    expect(seguimientoDe("4412345678", "Mercado Libre")?.url).toContain("mercadolibre.com.ar");
  });
  it("reconoce el formato de Correo Argentino", () => {
    expect(seguimientoDe("cp123456789ar")).toEqual({ codigo: "CP123456789AR", empresa: "Correo Argentino" });
  });
  it("si no lo reconoce, deja el código para copiar", () => {
    expect(seguimientoDe("ABC-99", "Proveedor directo")).toEqual({ codigo: "ABC-99" });
  });
});

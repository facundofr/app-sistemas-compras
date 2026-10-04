import { describe, expect, it } from "vitest";
import { codigoEquipo, estadoGarantia } from "./equipos";

describe("equipos", () => {
  it("código con 5 dígitos", () => {
    expect(codigoEquipo(7)).toBe("EQ-00007");
  });
  it("estado de la garantía", () => {
    expect(estadoGarantia(null, "2026-10-05")).toBeNull();
    expect(estadoGarantia("2026-10-01", "2026-10-05")).toBe("vencida");
    expect(estadoGarantia("2026-10-20", "2026-10-05")).toBe("por_vencer");
    expect(estadoGarantia("2027-10-05", "2026-10-05")).toBe("vigente");
  });
});

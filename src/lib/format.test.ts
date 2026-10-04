import { describe, expect, it } from "vitest";
import { codigoPedido, fmtBytes, fmtDate } from "./format";

describe("formatos", () => {
  it("código de pedido con 5 dígitos", () => {
    expect(codigoPedido(42)).toBe("PED-00042");
    expect(codigoPedido(123456)).toBe("PED-123456");
  });
  it("las columnas date se muestran tal cual, sin corrimiento de zona horaria", () => {
    expect(fmtDate("2026-10-01")).toBe("01/10/2026");
    expect(fmtDate(null)).toBe("—");
  });
  it("tamaños de archivo", () => {
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(2048)).toBe("2 KB");
    expect(fmtBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

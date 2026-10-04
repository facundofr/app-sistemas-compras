import { describe, expect, it } from "vitest";
import { destinoDesdeTexto, idDesdeTexto, idEquipoDesdeTexto, rutaRecibir } from "./qr-texto";

describe("lectura del QR", () => {
  it("toma el id del link de la etiqueta, con cualquier dominio y basePath", () => {
    expect(idDesdeTexto("https://miplancober.com/asistente-sistemas/pedidos/42/recibir")).toBe(42);
    expect(idDesdeTexto("http://192.168.0.34:3001/asistente-sistemas/pedidos/7/recibir?x=1")).toBe(7);
  });
  it("acepta el código impreso o el número escritos a mano", () => {
    expect(idDesdeTexto("PED-00042")).toBe(42);
    expect(idDesdeTexto(" ped00042 ")).toBe(42);
    expect(idDesdeTexto("42")).toBe(42);
  });
  it("rechaza lo que no es una etiqueta de pedido", () => {
    expect(idDesdeTexto("https://mercadolibre.com.ar/algo")).toBeNull();
    expect(idDesdeTexto("https://x.com/pedidos/42")).toBeNull();
    expect(idDesdeTexto("PED-00000")).toBeNull();
    expect(idDesdeTexto("99999999999")).toBeNull();
    expect(idDesdeTexto("")).toBeNull();
  });
  it("arma la ruta de confirmación", () => {
    expect(rutaRecibir(42)).toBe("/pedidos/42/recibir");
  });
});

describe("lectura del QR de equipos", () => {
  it("reconoce el link y el código de un equipo", () => {
    expect(destinoDesdeTexto("https://x.com/asistente-sistemas/equipos/7")).toEqual({ tipo: "equipo", id: 7 });
    expect(destinoDesdeTexto("EQ-00007")).toEqual({ tipo: "equipo", id: 7 });
    expect(idEquipoDesdeTexto("eq7")).toBe(7);
  });
  it("lo demás sigue siendo de pedidos", () => {
    expect(destinoDesdeTexto("PED-00042")).toEqual({ tipo: "pedido", id: 42 });
    expect(destinoDesdeTexto("https://x.com/pedidos/3/recibir")).toEqual({ tipo: "pedido", id: 3 });
    expect(destinoDesdeTexto("https://x.com/equipos")).toBeNull();
  });
});

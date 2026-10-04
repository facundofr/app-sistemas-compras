import { describe, expect, it } from "vitest";
import type { Estado } from "@/db/schema";
import {
  puedeAdjuntarReferencia,
  puedeBorrarAdjunto,
  puedeCambiarEstado,
  puedeCancelar,
  puedeEditarCompra,
  puedeEditarPedido,
  puedeEliminar,
  puedeReactivar,
} from "./permisos";

const admin = { id: 1, rol: "admin" as const };
const compras = { id: 2, rol: "compras" as const };
const creador = { id: 3, rol: "sistemas" as const };
const otro = { id: 4, rol: "sistemas" as const };
const pedido = (estado: Estado, extra: { cancelado?: boolean } = {}) => ({
  estado,
  cancelado: extra.cancelado ?? false,
  creadoPorId: creador.id,
});

describe("editar datos del pedido", () => {
  it("Sistemas edita lo suyo solo mientras está «Solicitado»", () => {
    expect(puedeEditarPedido(creador, pedido("Solicitado"))).toBe(true);
    expect(puedeEditarPedido(creador, pedido("Cotizando"))).toBe(false);
    expect(puedeEditarPedido(otro, pedido("Solicitado"))).toBe(false);
  });
  it("Compras y Admin editan en cualquier etapa, salvo cancelado", () => {
    expect(puedeEditarPedido(compras, pedido("Comprando"))).toBe(true);
    expect(puedeEditarPedido(admin, pedido("Entregado"))).toBe(true);
    expect(puedeEditarPedido(compras, pedido("Comprando", { cancelado: true }))).toBe(false);
  });
  it("solo Compras carga los datos de compra", () => {
    expect(puedeEditarCompra(compras, pedido("Cotizando"))).toBe(true);
    expect(puedeEditarCompra(creador, pedido("Cotizando"))).toBe(false);
  });
});

describe("cambiar de etapa", () => {
  it("Sistemas solo confirma la entrega de lo que ya se compró", () => {
    expect(puedeCambiarEstado(creador, pedido("Comprando"), "Entregado")).toBe(true);
    expect(puedeCambiarEstado(otro, pedido("Comprando"), "Entregado")).toBe(true);
    expect(puedeCambiarEstado(creador, pedido("Cotizando"), "Entregado")).toBe(false);
    expect(puedeCambiarEstado(creador, pedido("Solicitado"), "Cotizando")).toBe(false);
  });
  it("Compras mueve cualquier etapa, pero no a la misma ni si está cancelado", () => {
    expect(puedeCambiarEstado(compras, pedido("Solicitado"), "Comprando")).toBe(true);
    expect(puedeCambiarEstado(compras, pedido("Comprando"), "Comprando")).toBe(false);
    expect(puedeCambiarEstado(compras, pedido("Comprando", { cancelado: true }), "Entregado")).toBe(false);
  });
});

describe("cancelar, reactivar y eliminar", () => {
  it("cancela el creador o Compras, nunca algo ya entregado", () => {
    expect(puedeCancelar(creador, pedido("Cotizando"))).toBe(true);
    expect(puedeCancelar(otro, pedido("Cotizando"))).toBe(false);
    expect(puedeCancelar(compras, pedido("Entregado"))).toBe(false);
  });
  it("reactiva solo lo cancelado", () => {
    expect(puedeReactivar(creador, pedido("Cotizando", { cancelado: true }))).toBe(true);
    expect(puedeReactivar(creador, pedido("Cotizando"))).toBe(false);
  });
  it("elimina solo el admin", () => {
    expect(puedeEliminar(admin)).toBe(true);
    expect(puedeEliminar(compras)).toBe(false);
  });
});

describe("adjuntos", () => {
  it("el creador adjunta y borra lo suyo mientras está «Solicitado»", () => {
    expect(puedeAdjuntarReferencia(creador, pedido("Cotizando"))).toBe(true);
    expect(puedeBorrarAdjunto(creador, pedido("Solicitado"), creador.id)).toBe(true);
    expect(puedeBorrarAdjunto(creador, pedido("Cotizando"), creador.id)).toBe(false);
    expect(puedeBorrarAdjunto(otro, pedido("Solicitado"), creador.id)).toBe(false);
    expect(puedeBorrarAdjunto(compras, pedido("Entregado"), creador.id)).toBe(true);
  });
});

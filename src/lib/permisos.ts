import type { Estado, Rol } from "@/db/schema";

type U = { id: number; rol: Rol };
type P = { estado: Estado; cancelado: boolean; creadoPorId: number | null };

export const gestionaCompras = (rol: Rol) => rol === "admin" || rol === "compras";

const esCreador = (u: U, p: P) => p.creadoPorId === u.id;

/** Datos del pedido: Compras siempre; Sistemas solo el propio y mientras siga «Solicitado». */
export function puedeEditarPedido(u: U, p: P) {
  if (p.cancelado) return false;
  if (gestionaCompras(u.rol)) return true;
  return esCreador(u, p) && p.estado === "Solicitado";
}

export function puedeEditarCompra(u: U, p: P) {
  return gestionaCompras(u.rol) && !p.cancelado;
}

/** Compras mueve cualquier etapa; Sistemas solo confirma la entrega de lo que ya se compró. */
export function puedeCambiarEstado(u: U, p: P, destino: Estado) {
  if (p.cancelado || p.estado === destino) return false;
  if (gestionaCompras(u.rol)) return true;
  return destino === "Entregado" && p.estado === "Comprando";
}

export function puedeCancelar(u: U, p: P) {
  if (p.cancelado || p.estado === "Entregado") return false;
  return gestionaCompras(u.rol) || esCreador(u, p);
}

export function puedeReactivar(u: U, p: P) {
  return p.cancelado && (gestionaCompras(u.rol) || esCreador(u, p));
}

export function puedeEliminar(u: U) {
  return u.rol === "admin";
}

export function puedeAdjuntarReferencia(u: U, p: P) {
  if (p.cancelado) return false;
  return gestionaCompras(u.rol) || esCreador(u, p);
}

export function puedeBorrarAdjunto(u: U, p: P, subidoPorId: number | null) {
  if (gestionaCompras(u.rol)) return true;
  return subidoPorId === u.id && p.estado === "Solicitado" && !p.cancelado;
}

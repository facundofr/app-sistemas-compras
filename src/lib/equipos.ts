import type { EstadoEquipo } from "@/db/schema";

export const codigoEquipo = (id: number) => `EQ-${String(id).padStart(5, "0")}`;

export const ESTADOS_EQUIPO: Record<EstadoEquipo, { nombre: string; clase: string }> = {
  en_uso: { nombre: "En uso", clase: "bg-teal-soft text-primary" },
  en_deposito: { nombre: "En depósito", clase: "bg-muted text-muted-foreground" },
  en_reparacion: { nombre: "En reparación", clase: "bg-gold-soft text-gold-foreground" },
  baja: { nombre: "De baja", clase: "bg-rust-soft text-destructive" },
};

/** Ruta (sin basePath) de la ficha del equipo: es lo que abre su etiqueta QR. */
export const rutaEquipo = (id: number) => `/equipos/${id}`;

/** ¿Vence la garantía en los próximos 30 días (o ya venció)? `hoy` como "YYYY-MM-DD". */
export function estadoGarantia(garantiaHasta: string | null, hoy: string): "vigente" | "por_vencer" | "vencida" | null {
  if (!garantiaHasta) return null;
  if (garantiaHasta < hoy) return "vencida";
  const dias = (Date.parse(garantiaHasta) - Date.parse(hoy)) / 86_400_000;
  return dias <= 30 ? "por_vencer" : "vigente";
}

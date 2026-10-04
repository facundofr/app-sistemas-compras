import type { EstadoEquipo } from "@/db/schema";
import { ESTADOS_EQUIPO } from "@/lib/equipos";
import { cn } from "@/lib/utils";

export function EstadoEquipoChip({ estado, className }: { estado: EstadoEquipo; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        ESTADOS_EQUIPO[estado].clase,
        className,
      )}
    >
      {ESTADOS_EQUIPO[estado].nombre}
    </span>
  );
}

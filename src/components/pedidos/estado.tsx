import type { Estado, Prioridad } from "@/db/schema";
import { ESTADOS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const ESTADO_CLASES: Record<Estado, { text: string; bg: string; soft: string }> = {
  Solicitado: {
    text: "text-estado-solicitado",
    bg: "bg-estado-solicitado",
    soft: "bg-estado-solicitado/12 text-estado-solicitado",
  },
  Cotizando: {
    text: "text-estado-cotizando",
    bg: "bg-estado-cotizando",
    soft: "bg-estado-cotizando/12 text-estado-cotizando",
  },
  Comprando: {
    text: "text-estado-comprando",
    bg: "bg-estado-comprando",
    soft: "bg-estado-comprando/12 text-estado-comprando",
  },
  Entregado: {
    text: "text-estado-entregado",
    bg: "bg-estado-entregado",
    soft: "bg-estado-entregado/14 text-estado-entregado",
  },
};

/** Chip de estado con mini riel de 4 tramos: se lee de un vistazo en qué etapa está. */
export function EstadoChip({
  estado,
  cancelado,
  className,
}: {
  estado: Estado;
  cancelado?: boolean;
  className?: string;
}) {
  const idx = ESTADOS.indexOf(estado);
  if (cancelado) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground",
          className,
        )}
      >
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        Cancelado
      </span>
    );
  }
  const c = ESTADO_CLASES[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        c.soft,
        className,
      )}
    >
      <span aria-hidden className="flex gap-[3px]">
        {ESTADOS.map((e, i) => (
          <span
            key={e}
            className={cn("h-1.5 w-2.5 rounded-full", i <= idx ? c.bg : "bg-current opacity-20")}
          />
        ))}
      </span>
      {estado}
    </span>
  );
}

const PRIORIDAD_CLASES: Record<Prioridad, string> = {
  Baja: "text-muted-foreground bg-muted",
  Media: "text-estado-cotizando bg-estado-cotizando/12",
  Alta: "text-gold-foreground bg-gold-soft",
  Urgente: "text-destructive bg-destructive/12",
};

export function PrioridadChip({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        PRIORIDAD_CLASES[prioridad],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {prioridad}
    </span>
  );
}

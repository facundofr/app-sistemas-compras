"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cambiarEstado } from "@/actions/pedidos";
import type { Estado } from "@/db/schema";
import { ESTADO_INFO, ESTADOS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function EstadoRail({
  pedidoId,
  estado,
  cancelado,
  habilitados,
}: {
  pedidoId: number;
  estado: Estado;
  cancelado: boolean;
  /** Etapas a las que el usuario actual puede mover el pedido. */
  habilitados: Estado[];
}) {
  const [pending, start] = useTransition();
  const idx = ESTADOS.indexOf(estado);

  function mover(destino: Estado) {
    start(async () => {
      const r = await cambiarEstado(pedidoId, destino);
      if (r.error) toast.error(r.error);
      else toast.success(r.mensaje);
    });
  }

  return (
    <ol
      aria-label="Etapas del pedido"
      className={cn("grid grid-cols-4", cancelado && "pointer-events-none opacity-40 grayscale", pending && "opacity-70")}
    >
      {ESTADOS.map((e, i) => {
        const hecho = i < idx;
        const actual = i === idx;
        const final = e === "Entregado";
        const puede = habilitados.includes(e) && !pending;
        const tono = final && (hecho || actual) ? "gold" : "teal";
        const info = ESTADO_INFO[e];

        const nodo = (
          <span
            className={cn(
              "relative z-10 grid size-4 place-items-center rounded-full border-2 transition-transform",
              hecho || actual
                ? tono === "gold"
                  ? "border-gold bg-gold"
                  : "border-primary bg-primary"
                : "border-input bg-card",
              actual && "size-5 ring-4",
              actual && (tono === "gold" ? "ring-gold/20" : "ring-primary/20"),
              puede && "group-hover:scale-125",
            )}
          />
        );

        return (
          <li key={e} aria-current={actual ? "step" : undefined} className="relative flex flex-col items-center">
            {i < ESTADOS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-2.5 left-1/2 h-0.5 w-full -translate-y-1/2",
                  i < idx ? (ESTADOS[i + 1] === "Entregado" ? "bg-gold" : "bg-primary") : "bg-border",
                )}
              />
            )}
            <div className="flex h-5 items-center">
              {puede ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => mover(e)}
                      className="group rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label={`Mover a ${e}`}
                    >
                      {nodo}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Mover a «{e}»</TooltipContent>
                </Tooltip>
              ) : (
                nodo
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-center text-[10.5px] font-semibold tracking-wide uppercase",
                actual ? (tono === "gold" ? "text-gold-foreground dark:text-gold" : "text-primary") : hecho ? "text-foreground/70" : "text-muted-foreground",
                actual && "font-bold",
              )}
            >
              {e}
            </span>
            <span className="hidden text-center text-[10.5px] text-muted-foreground sm:block">
              {info.equipo === "compras" ? "Compras" : "Sistemas"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

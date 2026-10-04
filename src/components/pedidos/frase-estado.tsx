import { AlertTriangleIcon, BanIcon, CircleCheckBigIcon, ClockIcon, TruckIcon } from "lucide-react";
import type { Estado } from "@/db/schema";
import { hoyISO } from "@/lib/format";
import { fraseEstado } from "@/lib/frase-estado";
import { cn } from "@/lib/utils";

const TONO = {
  ok: "text-primary",
  info: "text-muted-foreground",
  alerta: "text-destructive",
  apagado: "text-muted-foreground",
};

/** «Llega el jueves 08/10 · Mercado Libre»: qué pasa con el pedido y qué falta, en una línea. */
export function FraseEstado({
  pedido,
  className,
}: {
  pedido: Parameters<typeof fraseEstado>[0] & { estado: Estado };
  className?: string;
}) {
  const f = fraseEstado(pedido, hoyISO());
  const Icono = pedido.cancelado
    ? BanIcon
    : f.tono === "alerta"
      ? AlertTriangleIcon
      : pedido.estado === "Entregado"
        ? CircleCheckBigIcon
        : pedido.estado === "Comprando"
          ? TruckIcon
          : ClockIcon;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold", TONO[f.tono], className)}>
      <Icono className="size-3.5 shrink-0" />
      <span className="truncate">{f.texto}</span>
    </span>
  );
}

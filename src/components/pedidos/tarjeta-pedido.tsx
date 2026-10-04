import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { codigoPedido } from "@/lib/format";
import type { PedidoTarjeta } from "@/lib/queries";
import { EstadoChip, PrioridadChip } from "./estado";
import { FraseEstado } from "./frase-estado";

/** Fila compacta de un pedido: producto, frase de estado y, opcionalmente, una acción a la derecha. */
export function TarjetaPedido({ p, href, accion }: { p: PedidoTarjeta; href?: string; accion?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={href ?? `/pedidos/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <span className="font-mono font-medium">{codigoPedido(p.id)}</span>
            {p.prioridad !== "Media" && p.prioridad !== "Baja" && <PrioridadChip prioridad={p.prioridad} />}
          </div>
          <div className="mt-0.5 truncate text-[14px] font-semibold">{p.producto}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <FraseEstado pedido={p} className="max-w-full" />
          </div>
        </div>
        {!accion && (
          <span className="flex shrink-0 items-center gap-1.5">
            <EstadoChip estado={p.estado} cancelado={p.cancelado} className="max-sm:hidden" />
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </span>
        )}
      </Link>
      {accion}
    </li>
  );
}

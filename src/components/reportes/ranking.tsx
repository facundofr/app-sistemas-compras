import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtMoney } from "@/lib/format";

/** Barras horizontales ordenadas: una sola tinta, valor al final de la barra en color de texto. */
export function Ranking({
  filas,
  vacio,
  detalle,
}: {
  filas: { nombre: string; total: number; compras?: number }[];
  vacio: string;
  detalle?: (f: { nombre: string; total: number; compras?: number }) => string;
}) {
  if (!filas.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">{vacio}</p>;
  const max = Math.max(...filas.map((f) => f.total));
  const suma = filas.reduce((a, f) => a + f.total, 0);

  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.nombre}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="group cursor-default rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" tabIndex={0}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate">{f.nombre}</span>
                  <span className="shrink-0 font-mono text-[12.5px] font-medium tabular">{fmtMoney(f.total)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1 transition-opacity group-hover:opacity-80"
                    style={{ width: `${Math.max(1.5, (f.total / max) * 100)}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {((f.total / suma) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% del total
              {detalle ? ` · ${detalle(f)}` : ""}
            </TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

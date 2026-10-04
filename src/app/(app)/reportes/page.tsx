import type { Metadata } from "next";
import { DownloadIcon, StarIcon } from "lucide-react";
import { PageHeader, Stat, Stats } from "@/components/page-header";
import { GastoMensual } from "@/components/reportes/gasto-mensual";
import { Ranking } from "@/components/reportes/ranking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRol } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { fmtMes, fmtMoney, hoyISO } from "@/lib/format";
import { getCumplimientoProveedores, getReportes } from "@/lib/queries";

export const metadata: Metadata = { title: "Reportes" };

/** Los últimos 12 meses, incluidos los que no tuvieron gasto, para que el eje de tiempo sea continuo. */
function ultimos12(porMes: { mes: string; total: number }[]) {
  const [y, m] = hoyISO().split("-").map(Number);
  const mapa = new Map(porMes.map((r) => [r.mes, r.total]));
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { mes, total: mapa.get(mes) ?? 0 };
  });
}

export default async function ReportesPage() {
  await requireRol("admin", "compras");
  const [r, cumplimiento] = await Promise.all([getReportes(), getCumplimientoProveedores()]);
  const meses = ultimos12(r.porMes);
  const promedio = r.resumen.compras ? r.resumen.total / r.resumen.compras : 0;
  const dias = r.resumen.diasPromedio;

  return (
    <>
      <PageHeader title="Reportes" description="Costos y proveedores de todo el circuito de compras de Sistemas.">
        <Button variant="outline" size="sm" asChild>
          <a href={conBase("/api/exportar?tipo=pedidos")}>
            <DownloadIcon /> Exportar todo a Excel
          </a>
        </Button>
      </PageHeader>

      <Stats>
        <Stat valor={fmtMoney(r.resumen.total)} label="Gasto total registrado" mono />
        <Stat valor={fmtMoney(promedio)} label="Ticket promedio" mono />
        <Stat valor={fmtMoney(r.resumen.entregado)} label="Gasto ya entregado" mono />
        <Stat valor={r.resumen.compras} label="Pedidos con importe" />
        <Stat
          valor={dias == null ? "—" : `${dias.toLocaleString("es-AR", { maximumFractionDigits: 1 })} d`}
          label="Del pedido a la entrega"
        />
      </Stats>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Gasto por mes</CardTitle>
            <CardDescription>Últimos 12 meses, por fecha de compra.</CardDescription>
          </CardHeader>
          <CardContent>
            <GastoMensual datos={meses} />
            <details className="mt-3 text-[12.5px]">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver como tabla</summary>
              <table className="mt-2 w-full">
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.mes} className="border-b last:border-0">
                      <td className="py-1 capitalize">{fmtMes(m.mes)}</td>
                      <td className="py-1 text-right font-mono tabular">{fmtMoney(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Gasto por empresa</CardTitle>
            <CardDescription>Según «Facturar por».</CardDescription>
          </CardHeader>
          <CardContent>
            <Ranking filas={r.porEmpresa} vacio="Todavía no hay importes cargados." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Top proveedores por monto</CardTitle>
          </CardHeader>
          <CardContent>
            <Ranking
              filas={r.porProveedor}
              vacio="Todavía no hay importes cargados."
              detalle={(f) => `${f.compras} ${f.compras === 1 ? "compra" : "compras"}`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Por medio de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <Ranking filas={r.porMedioPago} vacio="Todavía no hay importes cargados." />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Cumplimiento de proveedores</CardTitle>
            <CardDescription>
              Según quien recibió cada paquete: calificación, entregas en la fecha estimada y días desde la compra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cumplimiento.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">Todavía no hay entregas con proveedor cargado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                      <th className="py-2 pr-3 font-medium">Proveedor</th>
                      <th className="px-3 py-2 text-right font-medium">Entregas</th>
                      <th className="px-3 py-2 font-medium">Calificación</th>
                      <th className="px-3 py-2 text-right font-medium">A tiempo</th>
                      <th className="py-2 pl-3 text-right font-medium">Demora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cumplimiento.map((c) => (
                      <tr key={c.proveedor} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{c.proveedor}</td>
                        <td className="px-3 py-2 text-right tabular">{c.entregas}</td>
                        <td className="px-3 py-2">
                          {c.calificacion == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              <StarIcon className="size-3.5 fill-gold text-gold" />
                              {c.calificacion.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                              <span className="text-[11.5px] text-muted-foreground">({c.calificados})</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular">
                          {c.aTiempo == null ? <span className="text-muted-foreground">—</span> : `${Math.round(c.aTiempo * 100)}%`}
                        </td>
                        <td className="py-2 pl-3 text-right tabular whitespace-nowrap">
                          {c.dias == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            `${c.dias.toLocaleString("es-AR", { maximumFractionDigits: 1 })} d`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

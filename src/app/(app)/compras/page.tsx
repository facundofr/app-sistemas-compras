import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, FileCheck2Icon, FileWarningIcon, ReceiptTextIcon } from "lucide-react";
import { FiltrosUrl } from "@/components/filtros-url";
import { PageHeader, Stat, Stats } from "@/components/page-header";
import { EstadoChip } from "@/components/pedidos/estado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requireUsuario } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { codigoPedido, fmtDate, fmtMoney } from "@/lib/format";
import { getOpciones, listarCompras } from "@/lib/queries";

export const metadata: Metadata = { title: "Compras efectuadas" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function ComprasPage(props: PageProps<"/compras">) {
  await requireUsuario();
  const sp = await props.searchParams;
  const filtros = {
    desde: str(sp.desde),
    hasta: str(sp.hasta),
    empresa: str(sp.empresa),
    medioPago: str(sp.medioPago),
    q: str(sp.q),
  };
  const [{ filas, totales }, opciones] = await Promise.all([listarCompras(filtros), getOpciones()]);
  const promedio = totales.conImporte ? totales.total / totales.conImporte : 0;
  const exportQs = new URLSearchParams(
    Object.entries({ tipo: "compras", ...filtros }).filter((e): e is [string, string] => !!e[1]),
  ).toString();

  return (
    <>
      <PageHeader
        title="Compras efectuadas"
        description="Todo lo que Compras ya compró: proveedor, forma de pago, factura e importe."
      >
        <Stats>
          <Stat valor={fmtMoney(totales.total)} label="Total comprado" mono />
          <Stat valor={totales.cantidad} label="Compras" />
          <Stat valor={fmtMoney(promedio)} label="Ticket promedio" mono />
          <Stat valor={totales.sinFactura} label="Sin factura" tono={totales.sinFactura ? "alerta" : undefined} />
        </Stats>
      </PageHeader>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-[15.5px] font-bold">
            Compras
            <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
              {totales.cantidad} · {totales.entregadas} entregadas
            </span>
          </h2>
          <Button variant="outline" size="sm" asChild>
            <a href={conBase(`/api/exportar?${exportQs}`)}>
              <DownloadIcon /> Exportar a Excel
            </a>
          </Button>
        </div>
        <FiltrosUrl
          className="border-b px-5 py-3"
          filtros={[
            { tipo: "busqueda", param: "q", placeholder: "Buscar producto, proveedor, CUIT o factura..." },
            { tipo: "fecha", param: "desde", label: "Desde" },
            { tipo: "fecha", param: "hasta", label: "Hasta" },
            {
              tipo: "select",
              param: "empresa",
              todos: "Todas las empresas",
              opciones: opciones.empresa.map((e) => ({ value: e, label: e })),
            },
            {
              tipo: "select",
              param: "medioPago",
              todos: "Todo medio de pago",
              opciones: opciones.medio_pago.map((e) => ({ value: e, label: e })),
            },
          ]}
        />

        {filas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
            <ReceiptTextIcon className="size-8 opacity-60" />
            {Object.values(filtros).some(Boolean)
              ? "No hay compras que coincidan con los filtros."
              : "Todavía no hay compras. Aparecen acá cuando un pedido pasa a «Comprando»."}
          </div>
        ) : (
          <>
            {/* Celular: tarjetas en vez de una tabla de 8 columnas con scroll horizontal. */}
            <ul className="divide-y md:hidden">
              {filas.map((c) => {
                const tieneFactura = !!(c.facturaNumero || c.facturaLink || c.facturas > 0);
                return (
                  <li key={c.id}>
                    <Link href={`/pedidos/${c.id}`} className="block px-4 py-3.5 active:bg-muted/60">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                        <span className="font-mono font-medium">{codigoPedido(c.id)}</span>
                        <span className="tabular">{fmtDate(c.fecha)}</span>
                      </div>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <span className="line-clamp-2 text-[14px] leading-snug font-semibold">{c.producto}</span>
                        <span className="shrink-0 font-mono text-[13px] font-semibold tabular">
                          {c.importe != null ? fmtMoney(c.importe) : <span className="font-sans text-[12px] font-normal text-muted-foreground">Sin importe</span>}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {[`${c.cantidad} u.`, c.facturarPor, c.proveedor, c.medioPago].filter(Boolean).join(" · ")}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <EstadoChip estado={c.estado} />
                        <span className="inline-flex items-center gap-1 text-[12px]">
                          {tieneFactura ? (
                            <FileCheck2Icon className="size-3.5 text-primary" />
                          ) : (
                            <FileWarningIcon className="size-3.5 text-gold" />
                          )}
                          {c.facturaNumero ? `Factura ${c.tipoFactura ?? ""} ${c.facturaNumero}` : tieneFactura ? "Factura adjunta" : "Falta factura"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
              <li className="flex items-center justify-between bg-muted/50 px-4 py-3 text-[13px] font-semibold">
                <span>Total {Object.values(filtros).some(Boolean) ? "filtrado" : ""}</span>
                <span className="font-mono tabular">{fmtMoney(totales.total)}</span>
              </li>
            </ul>
            <div className="max-md:hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="pr-5 text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.map((c) => {
                    const tieneFactura = !!(c.facturaNumero || c.facturaLink || c.facturas > 0);
                    return (
                      <TableRow key={c.id} className="relative">
                        <TableCell className="pl-5">
                          <div className="text-[12.5px] tabular">{fmtDate(c.fecha)}</div>
                          <Link
                            href={`/pedidos/${c.id}`}
                            className="font-mono text-[11.5px] text-muted-foreground after:absolute after:inset-0 hover:text-foreground"
                          >
                            {codigoPedido(c.id)}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="truncate font-semibold">{c.producto}</div>
                          <div className="text-[11.5px] text-muted-foreground">{c.cantidad} u.</div>
                        </TableCell>
                        <TableCell className="text-[12.5px]">{c.facturarPor}</TableCell>
                        <TableCell className="text-[12.5px]">
                          <div>{c.proveedor || <span className="text-muted-foreground">—</span>}</div>
                          <div className="text-[11.5px] text-muted-foreground">
                            {[c.medioCompra, c.cuit].filter(Boolean).join(" · ")}
                          </div>
                        </TableCell>
                        <TableCell className="text-[12.5px]">
                          {c.medioPago ?? <span className="text-muted-foreground">—</span>}
                          {c.cuotas && c.cuotas > 1 && <div className="text-[11.5px] text-muted-foreground">{c.cuotas} cuotas</div>}
                        </TableCell>
                        <TableCell className="text-[12.5px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="relative z-10 inline-flex items-center gap-1.5">
                                {tieneFactura ? (
                                  <FileCheck2Icon className="size-4 text-primary" />
                                ) : (
                                  <FileWarningIcon className="size-4 text-gold" />
                                )}
                                {c.facturaNumero ? `${c.tipoFactura ?? ""} ${c.facturaNumero}` : tieneFactura ? "Adjunta" : "Falta"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {tieneFactura
                                ? `${c.facturas} archivo(s)${c.facturaLink ? " + link" : ""}`
                                : "Todavía no se cargó la factura"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <EstadoChip estado={c.estado} />
                        </TableCell>
                        <TableCell className="pr-5 text-right font-mono text-[12.5px] tabular">
                          {c.importe != null ? fmtMoney(c.importe) : <span className="text-muted-foreground">Sin importe</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="pl-5 text-[12.5px] font-semibold">
                      Total {Object.values(filtros).some(Boolean) ? "filtrado" : ""}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono text-[13px] font-semibold tabular">
                      {fmtMoney(totales.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

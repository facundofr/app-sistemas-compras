import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, ChevronRightIcon, DownloadIcon, InboxIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { FiltrosUrl } from "@/components/filtros-url";
import { PageHeader } from "@/components/page-header";
import { ESTADO_CLASES, EstadoChip, PrioridadChip } from "@/components/pedidos/estado";
import { StatsGenerales } from "@/components/stats-generales";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUsuario } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { ESTADO_INFO, ESTADOS, PRIORIDADES } from "@/lib/constants";
import { codigoPedido, diasDesde, fmtDate, fmtMoney } from "@/lib/format";
import { gestionaCompras } from "@/lib/permisos";
import { contarPorEstado, getAlertas, getOpciones, listarPedidos } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos" };

const LIMITE = 500;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function PedidosPage(props: PageProps<"/pedidos">) {
  const usuario = await requireUsuario();
  const sp = await props.searchParams;
  const filtros = {
    q: str(sp.q),
    estado: str(sp.estado),
    empresa: str(sp.empresa),
    prioridad: str(sp.prioridad),
    mios: sp.mios === "1",
    usuarioId: usuario.id,
  };
  const [lista, conteo, alertas, opciones] = await Promise.all([
    listarPedidos(filtros, LIMITE),
    contarPorEstado(),
    getAlertas(),
    getOpciones(),
  ]);
  const compras = gestionaCompras(usuario.rol);
  const max = Math.max(1, ...Object.values(conteo));
  const exportQs = new URLSearchParams(
    Object.entries({ tipo: "pedidos", q: filtros.q, estado: filtros.estado, empresa: filtros.empresa, prioridad: filtros.prioridad }).filter(
      (e): e is [string, string] => !!e[1],
    ),
  ).toString();

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title={compras ? "Pedidos" : "Estado de pedidos"}
        description={compras ? "Seguimiento completo del circuito de compra." : "Consultá en qué etapa está cada pedido."}
      >
        <StatsGenerales />
      </PageHeader>

      {alertas.length > 0 && (
        <section className="mb-5 rounded-xl border border-destructive/25 bg-rust-soft px-5 py-4">
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-destructive">
            <AlertTriangleIcon className="size-4" />
            {alertas.length === 1 ? "1 pedido necesita atención" : `${alertas.length} pedidos necesitan atención`}
          </h2>
          <ul className="divide-y divide-destructive/15">
            {alertas.map((a) => {
              const dias = diasDesde(a.estadoDesde);
              return (
                <li key={a.id}>
                  <Link
                    href={`/pedidos/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-md py-2 text-[13px] hover:bg-destructive/5"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-semibold">{codigoPedido(a.id)}</span> —{" "}
                      <span className="truncate">{a.producto}</span>
                      <div className="text-[11.5px] text-destructive/90">
                        {a.prioridad} · sigue en «{a.estado}»
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 font-mono text-[11.5px] font-semibold text-destructive">
                      {dias} {dias === 1 ? "día" : "días"} sin avanzar
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Pedidos por etapa" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ESTADOS.map((e) => {
          const activo = filtros.estado === e;
          return (
            <Link
              key={e}
              href={activo ? "/pedidos" : `/pedidos?estado=${e}`}
              scroll={false}
              className={cn(
                "group rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20",
                activo && "border-primary ring-3 ring-primary/15",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn("font-heading text-2xl font-bold tabular", ESTADO_CLASES[e].text)}>{conteo[e]}</span>
                <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
                  {ESTADO_INFO[e].equipo === "compras" ? "Compras" : "Sistemas"}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-muted-foreground">{e}</div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", ESTADO_CLASES[e].bg)}
                  style={{ width: `${Math.max(4, (conteo[e] / max) * 100)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </section>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-[15.5px] font-bold">
            {filtros.mios ? "Mis pedidos" : "Todos los pedidos"}
            <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{lista.length}</span>
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={conBase(`/api/exportar?${exportQs}`)}>
                <DownloadIcon /> Exportar a Excel
              </a>
            </Button>
            <Button size="sm" asChild>
              <Link href="/pedidos/nuevo">
                <PlusIcon /> Nuevo pedido
              </Link>
            </Button>
          </div>
        </div>
        <FiltrosUrl
          className="border-b px-5 py-3"
          filtros={[
            { tipo: "busqueda", param: "q", placeholder: "Buscar producto, proveedor, solicitante..." },
            {
              tipo: "select",
              param: "estado",
              todos: "Todos los estados",
              opciones: [
                ...ESTADOS.map((e) => ({ value: e, label: e })),
                { value: "Atencion", label: "Necesitan atención" },
                { value: "Cancelado", label: "Cancelados" },
              ],
            },
            {
              tipo: "select",
              param: "empresa",
              todos: "Todas las empresas",
              opciones: opciones.empresa.map((e) => ({ value: e, label: e })),
            },
            {
              tipo: "select",
              param: "prioridad",
              todos: "Toda prioridad",
              opciones: [...PRIORIDADES].reverse().map((p) => ({ value: p, label: p })),
            },
            { tipo: "check", param: "mios", label: "Solo los que cargué yo" },
          ]}
        />

        {lista.length >= LIMITE && (
          <p className="border-b bg-gold-soft px-5 py-2 text-[12.5px] text-gold-foreground">
            Se muestran los {LIMITE} pedidos más recientes. Usá la búsqueda o los filtros para encontrar los anteriores;
            «Exportar a Excel» incluye todos.
          </p>
        )}
        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
            <InboxIcon className="size-8 opacity-60" />
            {Object.values(sp).some(Boolean) ? (
              "No hay pedidos que coincidan con los filtros."
            ) : (
              <>
                Todavía no hay pedidos cargados.
                <Button size="sm" className="mt-2" asChild>
                  <Link href="/pedidos/nuevo">
                    <PlusIcon /> Cargar el primero
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Pedido</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead className="w-8 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((p) => (
                <TableRow key={p.id} className="relative cursor-pointer">
                  <TableCell className="pl-5">
                    <Link
                      href={`/pedidos/${p.id}`}
                      className="font-mono text-[12px] font-medium text-muted-foreground after:absolute after:inset-0 hover:text-foreground focus-visible:outline-none after:focus-visible:ring-2 after:focus-visible:ring-ring after:focus-visible:ring-inset"
                    >
                      {codigoPedido(p.id)}
                    </Link>
                    <div className="text-[11.5px] text-muted-foreground">{fmtDate(p.fechaPedido)}</div>
                  </TableCell>
                  <TableCell className="max-w-[340px]">
                    <div
                      className={cn(
                        "flex items-center gap-1.5 truncate font-semibold",
                        p.cancelado && "text-muted-foreground line-through",
                      )}
                    >
                      <span className="truncate">{p.producto}</span>
                      {p.adjuntos > 0 && <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {p.cantidad} u. · {p.solicitante} · {p.sector}
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px]">{p.facturarPor}</TableCell>
                  <TableCell>
                    <PrioridadChip prioridad={p.prioridad} />
                  </TableCell>
                  <TableCell>
                    <EstadoChip estado={p.estado} cancelado={p.cancelado} />
                  </TableCell>
                  <TableCell className="text-[12.5px]">{p.proveedor || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-mono text-[12.5px] tabular">
                    {p.importe != null ? fmtMoney(p.importe) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="pr-5 text-muted-foreground">
                    <ChevronRightIcon className="size-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}

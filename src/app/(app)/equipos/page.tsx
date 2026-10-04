import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, DownloadIcon, MonitorIcon, PlusIcon, ShieldAlertIcon } from "lucide-react";
import { EstadoEquipoChip } from "@/components/equipos/estado-equipo";
import { FiltrosUrl } from "@/components/filtros-url";
import { PageHeader, Stat, Stats } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUsuario } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { codigoEquipo, ESTADOS_EQUIPO, estadoGarantia } from "@/lib/equipos";
import { fmtDate, hoyISO } from "@/lib/format";
import { puedeGestionarInventario } from "@/lib/permisos";
import { contarEquiposPorEstado, listarEquipos, sectoresDeEquipos } from "@/lib/queries";

export const metadata: Metadata = { title: "Inventario" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function Garantia({ hasta }: { hasta: string | null }) {
  const g = estadoGarantia(hasta, hoyISO());
  if (!g || g === "vigente") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-gold-foreground">
      <ShieldAlertIcon className="size-3.5" />
      {g === "vencida" ? "Garantía vencida" : `Garantía vence el ${fmtDate(hasta)}`}
    </span>
  );
}

export default async function EquiposPage(props: PageProps<"/equipos">) {
  const usuario = await requireUsuario();
  const sp = await props.searchParams;
  const filtros = { q: str(sp.q), estado: str(sp.estado), sector: str(sp.sector) };
  const [lista, conteo, sectores] = await Promise.all([listarEquipos(filtros), contarEquiposPorEstado(), sectoresDeEquipos()]);
  const gestiona = puedeGestionarInventario(usuario.rol);
  const total = Object.values(conteo).reduce((s, n) => s + n, 0);
  const exportQs = new URLSearchParams(
    Object.entries({ tipo: "equipos", ...filtros }).filter((e): e is [string, string] => !!e[1]),
  ).toString();

  return (
    <>
      <PageHeader title="Inventario" description="Los equipos de Sistemas: a quién se le dio cada uno, dónde está y de qué compra vino.">
        <Stats>
          <Stat valor={total} label="Equipos" />
          <Stat valor={conteo.en_uso} label="En uso" />
          <Stat valor={conteo.en_deposito} label="En depósito" />
          <Stat valor={conteo.en_reparacion} label="En reparación" tono={conteo.en_reparacion ? "alerta" : undefined} />
        </Stats>
      </PageHeader>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-[15.5px] font-bold">
            Equipos
            <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{lista.length}</span>
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={conBase(`/api/exportar?${exportQs}`)}>
                <DownloadIcon /> Exportar a Excel
              </a>
            </Button>
            {gestiona && (
              <Button size="sm" asChild>
                <Link href="/equipos/nuevo">
                  <PlusIcon /> Cargar equipo
                </Link>
              </Button>
            )}
          </div>
        </div>
        <FiltrosUrl
          className="border-b px-5 py-3"
          filtros={[
            { tipo: "busqueda", param: "q", placeholder: "Buscar equipo, n° de serie, persona o EQ-..." },
            {
              tipo: "select",
              param: "estado",
              todos: "Todos los estados",
              chip: "Estado",
              opciones: Object.entries(ESTADOS_EQUIPO).map(([value, e]) => ({ value, label: e.nombre })),
            },
            {
              tipo: "select",
              param: "sector",
              todos: "Todos los sectores",
              chip: "Sector",
              opciones: sectores.map((s) => ({ value: s, label: s })),
            },
          ]}
        />

        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
            <MonitorIcon className="size-8 opacity-60" />
            {Object.values(filtros).some(Boolean)
              ? "No hay equipos que coincidan con los filtros."
              : "Todavía no hay equipos. Se cargan al recibir un pedido, o a mano con «Cargar equipo»."}
          </div>
        ) : (
          <>
            <ul className="divide-y md:hidden">
              {lista.map((e) => (
                <li key={e.id}>
                  <Link href={`/equipos/${e.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-muted/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                        <span className="font-mono font-medium">{codigoEquipo(e.id)}</span>
                        {e.numeroSerie && <span className="truncate font-mono">S/N {e.numeroSerie}</span>}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[14px] leading-snug font-semibold">{e.descripcion}</div>
                      <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {[e.asignadoA, e.sector].filter(Boolean).join(" · ") || "Sin asignar"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <EstadoEquipoChip estado={e.estado} />
                        <Garantia hasta={e.garantiaHasta} />
                      </div>
                    </div>
                    <ChevronRightIcon className="mt-6 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="max-md:hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Equipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>N° de serie</TableHead>
                    <TableHead>Asignado a</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-8 pr-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((e) => (
                    <TableRow key={e.id} className="relative cursor-pointer">
                      <TableCell className="pl-5">
                        <Link
                          href={`/equipos/${e.id}`}
                          className="font-mono text-[12px] font-medium text-muted-foreground after:absolute after:inset-0 hover:text-foreground"
                        >
                          {codigoEquipo(e.id)}
                        </Link>
                        <div className="text-[11.5px] text-muted-foreground">{fmtDate(e.fechaAlta)}</div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="truncate font-semibold">{e.descripcion}</div>
                        <Garantia hasta={e.garantiaHasta} />
                      </TableCell>
                      <TableCell className="font-mono text-[12px]">{e.numeroSerie || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-[12.5px]">
                        {e.asignadoA || <span className="text-muted-foreground">Sin asignar</span>}
                        {e.sector && <div className="text-[11.5px] text-muted-foreground">{e.sector}</div>}
                      </TableCell>
                      <TableCell className="text-[12.5px]">{e.ubicacion || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <EstadoEquipoChip estado={e.estado} />
                      </TableCell>
                      <TableCell className="pr-5 text-muted-foreground">
                        <ChevronRightIcon className="size-4" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

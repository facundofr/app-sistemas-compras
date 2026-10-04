import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { EquipoForm } from "@/components/equipos/equipo-form";
import { EstadoEquipoChip } from "@/components/equipos/estado-equipo";
import { Etiqueta } from "@/components/etiqueta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { codigoEquipo, estadoGarantia, rutaEquipo } from "@/lib/equipos";
import { codigoPedido, fmtDate, fmtDateTime, hoyISO } from "@/lib/format";
import { puedeGestionarInventario } from "@/lib/permisos";
import { getEquipo } from "@/lib/queries";
import { cn } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/equipos/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: /^\d+$/.test(id) ? codigoEquipo(Number(id)) : "Equipo" };
}

const ACCION: Record<string, string> = {
  alta: "Lo cargó al inventario",
  asignacion: "Cambió la asignación",
  estado: "Cambió el estado",
  edicion: "Editó los datos",
};

function Dato({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{k}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default async function EquipoPage(props: PageProps<"/equipos/[id]">) {
  const usuario = await requireUsuario();
  const { id: idParam } = await props.params;
  if (!/^\d+$/.test(idParam)) notFound();
  const e = await getEquipo(Number(idParam));
  if (!e) notFound();
  const gestiona = puedeGestionarInventario(usuario.rol);
  const garantia = estadoGarantia(e.garantiaHasta, hoyISO());

  return (
    <>
      <Link href="/equipos" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" /> Inventario
      </Link>
      <div className="mb-5">
        <h1 className={cn("text-[22px] leading-tight font-bold tracking-tight md:text-2xl", e.estado === "baja" && "text-muted-foreground")}>
          {e.descripcion}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{codigoEquipo(e.id)}</span>
          {e.numeroSerie && <span className="font-mono">· S/N {e.numeroSerie}</span>}
          <EstadoEquipoChip estado={e.estado} />
          {garantia && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                garantia === "vigente" ? "text-primary" : "text-gold-foreground",
              )}
            >
              {garantia === "vigente" ? <ShieldCheckIcon className="size-3.5" /> : <ShieldAlertIcon className="size-3.5" />}
              {garantia === "vencida" ? "Garantía vencida" : `Garantía hasta el ${fmtDate(e.garantiaHasta)}`}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Datos del equipo</CardTitle>
            </CardHeader>
            <CardContent>
              {gestiona ? (
                <EquipoForm equipo={e} />
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <Dato k="Asignado a">{e.asignadoA}</Dato>
                  <Dato k="Sector">{e.sector}</Dato>
                  <Dato k="Ubicación">{e.ubicacion}</Dato>
                  <Dato k="Alta">{fmtDate(e.fechaAlta)}</Dato>
                  <Dato k="Notas">{e.notas && <span className="font-normal whitespace-pre-line">{e.notas}</span>}</Dato>
                </dl>
              )}
            </CardContent>
          </Card>

          {e.pedido && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[15.5px] font-bold">De qué compra vino</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/pedidos/${e.pedido.id}`} className="group block rounded-lg border px-4 py-3 hover:border-foreground/20">
                  <div className="font-mono text-[12px] text-muted-foreground">{codigoPedido(e.pedido.id)}</div>
                  <div className="font-semibold group-hover:underline">{e.pedido.producto}</div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {[e.pedido.proveedor, e.pedido.fechaCompra && `comprado el ${fmtDate(e.pedido.fechaCompra)}`].filter(Boolean).join(" · ")}
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Etiqueta
            titulo="Etiqueta del equipo"
            descripcion="Pegala en el equipo: al escanearla con el botón QR se abre esta ficha."
            ruta={rutaEquipo(e.id)}
            codigo={codigoEquipo(e.id)}
            nombre={e.descripcion}
            lineas={[e.numeroSerie && `S/N ${e.numeroSerie}`, e.sector, "Propiedad de Grupo Cober · Sistemas"]}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {e.historial.map((h) => (
                  <li key={h.id} className="relative">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1.5 -left-[25px] size-2 rounded-full ring-4 ring-card",
                        h.accion === "asignacion" || h.accion === "alta" ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                    />
                    <div className="text-[13px] font-medium">{ACCION[h.accion] ?? h.accion}</div>
                    {h.detalle && <div className="text-[12.5px] text-muted-foreground">{h.detalle}</div>}
                    <div className="text-[11.5px] text-muted-foreground">
                      {h.usuario ?? "Usuario eliminado"} · {fmtDateTime(h.createdAt)}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

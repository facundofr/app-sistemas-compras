import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BanIcon, CircleCheckBigIcon, ClockIcon, ScanLineIcon } from "lucide-react";
import { ConfirmarEntrega } from "@/components/pedidos/confirmar-entrega";
import { EstadoChip, PrioridadChip } from "@/components/pedidos/estado";
import { FraseEstado } from "@/components/pedidos/frase-estado";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { esIdPedido } from "@/lib/constants";
import { codigoPedido, fmtDate, fmtDateTime } from "@/lib/format";
import { puedeCambiarEstado } from "@/lib/permisos";
import { getPedido } from "@/lib/queries";

export const metadata: Metadata = { title: "Confirmar entrega" };

/**
 * Pantalla que abre el QR de la etiqueta. Abrirla no cambia nada: hace falta tocar el botón
 * (las vistas previas de links de WhatsApp o del celular no pueden confirmar una entrega solas).
 */
export default async function RecibirPage(props: PageProps<"/pedidos/[id]/recibir">) {
  const usuario = await requireUsuario();
  const { id: idParam } = await props.params;
  const seguido = (await props.searchParams).seguido === "1";
  if (!/^\d+$/.test(idParam) || !esIdPedido(Number(idParam))) notFound();
  const p = await getPedido(Number(idParam));
  if (!p) notFound();

  // Desde el QR solo se confirma lo que ya se compró, aunque Compras pueda saltear etapas desde el detalle.
  const confirmable = p.estado === "Comprando" && puedeCambiarEstado(usuario, p, "Entregado");
  const entrega = p.historial.find((h) => h.accion === "estado" && h.detalle?.endsWith("→ Entregado"));

  return (
    <div className="mx-auto max-w-md">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="border-b bg-muted/40 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[13px] font-semibold">{codigoPedido(p.id)}</span>
            <EstadoChip estado={p.estado} cancelado={p.cancelado} />
          </div>
          <h1 className="mt-2 text-xl leading-snug font-bold tracking-tight">{p.producto}</h1>
          <FraseEstado pedido={p} className="mt-1.5 max-w-full text-[13px]" />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span>
              {p.cantidad} {p.cantidad === 1 ? "unidad" : "unidades"}
            </span>
            <PrioridadChip prioridad={p.prioridad} />
          </div>
        </div>

        <CardContent className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Solicitante</dt>
              <dd className="mt-0.5 font-medium break-words">{p.solicitante}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sector</dt>
              <dd className="mt-0.5 font-medium break-words">{p.sector}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Entregar en</dt>
              <dd className="mt-0.5 font-medium break-words">{p.domicilioEntrega}</dd>
            </div>
            {p.proveedor && (
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Proveedor</dt>
                <dd className="mt-0.5 font-medium break-words">{p.proveedor}</dd>
              </div>
            )}
            {p.fechaCompra && (
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Comprado el</dt>
                <dd className="mt-0.5 font-medium">{fmtDate(p.fechaCompra)}</dd>
              </div>
            )}
          </dl>
        </CardContent>

        <div className="border-t px-5 py-5">
          {p.cancelado ? (
            <Aviso icono={<BanIcon />} tono="error" titulo="Este pedido está cancelado">
              No se puede confirmar la entrega. Si llegó igual, avisale a Compras.
            </Aviso>
          ) : p.estado === "Entregado" ? (
            <Aviso icono={<CircleCheckBigIcon />} tono="ok" titulo="Entrega confirmada">
              {entrega
                ? `${entrega.usuario ?? "Alguien"} la confirmó el ${fmtDateTime(entrega.createdAt)}.`
                : `Recibido el ${fmtDate(p.fechaEntrega)}.`}
            </Aviso>
          ) : confirmable ? (
            <ConfirmarEntrega id={p.id} seguido={seguido} />
          ) : (
            <Aviso icono={<ClockIcon />} tono="info" titulo={`Todavía está en «${p.estado}»`}>
              Compras aún no marcó la compra como hecha. La entrega se puede confirmar cuando el pedido esté en
              «Comprando».
            </Aviso>
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" asChild>
          <Link href={`/pedidos/${p.id}`}>Ver el pedido</Link>
        </Button>
        <Button variant={seguido ? "default" : "outline"} asChild>
          <Link href={seguido ? "/escanear?seguido=1" : "/escanear"}>
            <ScanLineIcon /> {seguido ? "Siguiente paquete" : "Escanear otro"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

const TONOS = {
  ok: "bg-gold-soft text-gold-foreground",
  info: "bg-muted text-muted-foreground",
  error: "bg-rust-soft text-destructive",
};

function Aviso({
  icono,
  tono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  tono: keyof typeof TONOS;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-3 rounded-lg px-4 py-3 text-[13px] [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:shrink-0 ${TONOS[tono]}`}>
      {icono}
      <div>
        <div className="font-semibold">{titulo}</div>
        <div className="mt-0.5 opacity-90">{children}</div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, BanIcon, ExternalLinkIcon, InfoIcon, LockIcon } from "lucide-react";
import { AccionesPedido } from "@/components/pedidos/acciones";
import { Adjuntos, SubirReferencias, type AdjuntoVista } from "@/components/pedidos/adjuntos";
import { CompraForm } from "@/components/pedidos/compra-form";
import { EditarPedidoForm } from "@/components/pedidos/editar-pedido-form";
import { EstadoChip, PrioridadChip } from "@/components/pedidos/estado";
import { EstadoRail } from "@/components/pedidos/estado-rail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { esIdPedido, ESTADOS } from "@/lib/constants";
import { codigoPedido, diasDesde, fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import {
  gestionaCompras,
  puedeAdjuntarReferencia,
  puedeBorrarAdjunto,
  puedeCambiarEstado,
  puedeCancelar,
  puedeEditarPedido,
  puedeEliminar,
  puedeReactivar,
} from "@/lib/permisos";
import { getOpciones, getPedido } from "@/lib/queries";
import { cn } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/pedidos/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: /^\d+$/.test(id) ? codigoPedido(Number(id)) : "Pedido" };
}

function Dato({ k, children, className }: { k: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{k}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Enlace({ href }: { href: string | null }) {
  if (!href) return null;
  // El formulario acepta texto libre en «Link»: solo se vuelve enlace si es una URL.
  if (!/^https?:\/\//i.test(href)) return <span className="font-normal">{href}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
      <span className="truncate">{href.replace(/^https?:\/\//, "").slice(0, 60)}</span>
      <ExternalLinkIcon className="size-3.5 shrink-0" />
    </a>
  );
}

const ACCION_TEXTO: Record<string, string> = {
  creado: "Cargó el pedido",
  estado: "Cambió la etapa",
  edicion: "Editó los datos del pedido",
  compra: "Actualizó la compra",
  cancelado: "Canceló el pedido",
  reactivado: "Reactivó el pedido",
  adjunto: "Adjuntó archivos",
  adjunto_borrado: "Quitó un archivo",
};

export default async function PedidoPage(props: PageProps<"/pedidos/[id]">) {
  const usuario = await requireUsuario();
  const { id: idParam } = await props.params;
  if (!/^\d+$/.test(idParam) || !esIdPedido(Number(idParam))) notFound();
  const [p, opciones] = await Promise.all([getPedido(Number(idParam)), getOpciones()]);
  if (!p) notFound();

  const compras = gestionaCompras(usuario.rol);
  const editable = puedeEditarPedido(usuario, p);
  const habilitados = ESTADOS.filter((e) => puedeCambiarEstado(usuario, p, e));
  const siguiente = ESTADOS[ESTADOS.indexOf(p.estado) + 1];
  const vista = (a: (typeof p.adjuntos)[number]): AdjuntoVista => ({
    ...a,
    borrable: puedeBorrarAdjunto(usuario, p, a.subidoPorId),
  });
  const referencias = p.adjuntos.filter((a) => a.tipo === "referencia").map(vista);
  const facturas = p.adjuntos.filter((a) => a.tipo === "factura").map(vista);
  const dias = diasDesde(p.estadoDesde);

  return (
    <>
      <Link
        href="/pedidos"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> Pedidos
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className={cn("text-[22px] leading-tight font-bold tracking-tight md:text-2xl", p.cancelado && "text-muted-foreground line-through")}>
            {p.producto}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{codigoPedido(p.id)}</span>
            <span>·</span>
            <span>
              Pedido del {fmtDate(p.fechaPedido)}
              {p.creadoPor && ` · cargado por ${p.creadoPor}`}
            </span>
            <EstadoChip estado={p.estado} cancelado={p.cancelado} />
            <PrioridadChip prioridad={p.prioridad} />
          </div>
        </div>
        <AccionesPedido
          id={p.id}
          estado={p.estado}
          siguientePermitido={!!siguiente && puedeCambiarEstado(usuario, p, siguiente)}
          puedeCancelar={puedeCancelar(usuario, p)}
          puedeReactivar={puedeReactivar(usuario, p)}
          puedeEliminar={puedeEliminar(usuario)}
        />
      </div>

      {p.cancelado ? (
        <div className="mb-5 flex gap-2.5 rounded-lg bg-rust-soft px-4 py-3 text-[13px] text-destructive">
          <BanIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Pedido cancelado el {fmtDate(p.canceladoEn)}
            {p.canceladoMotivo && <> — Motivo: {p.canceladoMotivo}</>}
          </span>
        </div>
      ) : !compras ? (
        <div className="mb-5 flex gap-2.5 rounded-lg bg-gold-soft px-4 py-3 text-[13px] text-gold-foreground">
          {editable ? <InfoIcon className="mt-0.5 size-4 shrink-0" /> : <LockIcon className="mt-0.5 size-4 shrink-0" />}
          <span>
            {editable
              ? "Podés modificar los datos mientras el pedido siga en «Solicitado». Cuando Compras empiece a gestionarlo, ya no se va a poder editar."
              : p.estado === "Comprando"
                ? "Compras ya hizo la compra. Cuando recibas el producto, confirmá la entrega."
                : p.creadoPorId === usuario.id
                  ? "Este pedido ya está en gestión de Compras: los datos no se pueden modificar. Si hace falta, podés cancelarlo."
                  : "Solo quien cargó el pedido o Compras pueden modificarlo."}
          </span>
        </div>
      ) : null}

      <Card className="mb-5 py-5">
        <CardContent className="px-4 sm:px-8">
          <EstadoRail pedidoId={p.id} estado={p.estado} cancelado={p.cancelado} habilitados={habilitados} />
          {!p.cancelado && p.estado !== "Entregado" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              En «{p.estado}» desde hace {dias === 0 ? "menos de un día" : dias === 1 ? "1 día" : `${dias} días`}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Datos del pedido</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <EditarPedidoForm
                  id={p.id}
                  opciones={opciones}
                  valores={{
                    fechaPedido: p.fechaPedido,
                    solicitanteSector: p.solicitanteSector,
                    sector: p.sector,
                    solicitante: p.solicitante,
                    facturarPor: p.facturarPor,
                    domicilioEntrega: p.domicilioEntrega,
                    prioridad: p.prioridad,
                    producto: p.producto,
                    cantidad: p.cantidad,
                    link: p.link,
                    comentarios: p.comentarios,
                  }}
                />
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Dato k="Fecha de pedido">{fmtDate(p.fechaPedido)}</Dato>
                  <Dato k="Solicitante del sector">{p.solicitanteSector}</Dato>
                  <Dato k="Sector que solicitó la compra">{p.sector}</Dato>
                  <Dato k="Nombre y apellido del solicitante">{p.solicitante}</Dato>
                  <Dato k="Facturar por">{p.facturarPor}</Dato>
                  <Dato k="Cantidad">{p.cantidad}</Dato>
                  <Dato k="Domicilio de entrega">{p.domicilioEntrega}</Dato>
                  <Dato k="Link" className="sm:col-span-2 lg:col-span-3">
                    <Enlace href={p.link} />
                  </Dato>
                  <Dato k="Comentarios" className="sm:col-span-2 lg:col-span-3">
                    {p.comentarios && <span className="font-normal whitespace-pre-line">{p.comentarios}</span>}
                  </Dato>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Datos de compra</CardTitle>
              {compras && !p.cancelado && (
                <CardDescription>Se ven en «Compras efectuadas» cuando el pedido pasa a «Comprando».</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {compras && !p.cancelado ? (
                <CompraForm pedido={p} opciones={opciones} />
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Dato k="Medio de compra">{p.medioCompra}</Dato>
                  <Dato k="Proveedor">{p.proveedor}</Dato>
                  <Dato k="Importe">{p.importe != null && <span className="font-mono">{fmtMoney(p.importe)}</span>}</Dato>
                  <Dato k="Fecha de compra">{p.fechaCompra && fmtDate(p.fechaCompra)}</Dato>
                  <Dato k="Fecha de entrega">{p.fechaEntrega && fmtDate(p.fechaEntrega)}</Dato>
                  <Dato k="Seguimiento">{p.codigoSeguimiento}</Dato>
                  {compras && (
                    <>
                      <Dato k="CUIT">{p.cuit}</Dato>
                      <Dato k="Medio de pago">{p.medioPago && `${p.medioPago}${p.cuotas ? ` · ${p.cuotas} cuota(s)` : ""}`}</Dato>
                      <Dato k="Factura">{p.facturaNumero && `${p.tipoFactura ?? ""} ${p.facturaNumero}`}</Dato>
                      <Dato k="Notas de Compras" className="sm:col-span-2 lg:col-span-3">
                        {p.notasCompras && <span className="font-normal whitespace-pre-line">{p.notasCompras}</span>}
                      </Dato>
                    </>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Presupuesto del sector</CardTitle>
              <CardDescription>Presupuestos, fotos o capturas que mandó el sector.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Adjuntos items={referencias} vacio="El sector no adjuntó presupuesto ni archivos." />
              {puedeAdjuntarReferencia(usuario, p) && <SubirReferencias pedidoId={p.id} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Factura</CardTitle>
              {p.facturaNumero && (
                <CardDescription>
                  {p.tipoFactura && `Factura ${p.tipoFactura} · `}N° {p.facturaNumero}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Adjuntos items={facturas} vacio={p.facturaLink ? "" : "Todavía no se cargó la factura."} />
              {p.facturaLink && (
                <div className="text-[13px]">
                  <Enlace href={p.facturaLink} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-5">
                {p.historial.map((h) => (
                  <li key={h.id} className="relative">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1.5 -left-[25px] size-2 rounded-full ring-4 ring-card",
                        h.accion === "estado" ? "bg-primary" : h.accion === "cancelado" ? "bg-destructive" : "bg-muted-foreground/50",
                      )}
                    />
                    <div className="text-[13px] font-medium">
                      {ACCION_TEXTO[h.accion] ?? h.accion}
                      {h.accion === "estado" && h.detalle && (
                        <span className="ml-1 font-normal text-muted-foreground">{h.detalle}</span>
                      )}
                    </div>
                    {h.accion !== "estado" && h.detalle && (
                      <div className="text-[12.5px] text-muted-foreground">{h.detalle}</div>
                    )}
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

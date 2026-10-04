import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RepeatIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NuevoPedidoForm } from "@/components/pedidos/nuevo-pedido-form";
import { StatsGenerales } from "@/components/stats-generales";
import { requireUsuario } from "@/lib/auth";
import { esIdPedido } from "@/lib/constants";
import { codigoPedido, hoyISO } from "@/lib/format";
import { puedeCargarPedidos } from "@/lib/permisos";
import { getOpciones, getPedido, getUltimoPedidoDe, productosFrecuentes } from "@/lib/queries";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NuevoPedidoPage(props: PageProps<"/pedidos/nuevo">) {
  const usuario = await requireUsuario();
  if (!puedeCargarPedidos(usuario.rol)) redirect("/pedidos");
  // «Volver a pedir»: ?desde=<id> precarga todo el pedido original (salvo fecha y prioridad).
  const desde = Number((await props.searchParams).desde);
  const [opciones, ultimo, original, sugerencias] = await Promise.all([
    getOpciones(),
    getUltimoPedidoDe(usuario.id),
    esIdPedido(desde) ? getPedido(desde) : null,
    productosFrecuentes(),
  ]);
  const base = original ?? ultimo;

  return (
    <>
      <PageHeader
        title={original ? "Volver a pedir" : "Nuevo pedido"}
        description={
          original ? (
            <span className="inline-flex items-center gap-1.5">
              <RepeatIcon className="size-3.5" /> Copia de {codigoPedido(original.id)}. Revisá la cantidad antes de enviar.
            </span>
          ) : (
            "Cargá lo que necesitás pedir. El equipo de Compras se encarga del resto."
          )
        }
      >
        <StatsGenerales />
      </PageHeader>
      <NuevoPedidoForm
        key={original?.id ?? "nuevo"}
        opciones={opciones}
        sugerencias={sugerencias}
        // Lo que casi nunca cambia se precarga del último pedido del usuario (o del pedido que se repite).
        valores={{
          fechaPedido: hoyISO(),
          solicitanteSector: base?.solicitanteSector,
          sector: base?.sector,
          solicitante: base?.solicitante ?? usuario.nombre,
          facturarPor: base?.facturarPor,
          domicilioEntrega: base?.domicilioEntrega ?? opciones.domicilio[0],
          prioridad: "Media",
          ...(original && { items: original.items, comentarios: original.comentarios }),
        }}
      />
    </>
  );
}

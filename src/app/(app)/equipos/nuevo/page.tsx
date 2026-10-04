import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { AltaEquiposForm, type FilaEquipo } from "@/components/equipos/alta-equipos-form";
import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/lib/auth";
import { esIdPedido } from "@/lib/constants";
import { codigoPedido } from "@/lib/format";
import { puedeGestionarInventario } from "@/lib/permisos";
import { equiposDePedido, getPedido } from "@/lib/queries";

export const metadata: Metadata = { title: "Cargar equipos" };

/** Máximo de filas precargadas desde un pedido (el resto se agrega a mano). */
const MAX_PRECARGA = 20;

export default async function NuevoEquipoPage(props: PageProps<"/equipos/nuevo">) {
  const usuario = await requireUsuario();
  if (!puedeGestionarInventario(usuario.rol)) redirect("/equipos");
  const pedidoId = Number((await props.searchParams).pedido);
  const pedido = esIdPedido(pedidoId) ? await getPedido(pedidoId) : null;

  // Desde un pedido: una fila por cada unidad recibida que todavía no está en el inventario.
  let filas: FilaEquipo[] = [];
  if (pedido) {
    const yaCargados = await equiposDePedido(pedido.id);
    const porItem = new Map<number, number>();
    for (const e of yaCargados) if (e.pedidoItemId) porItem.set(e.pedidoItemId, (porItem.get(e.pedidoItemId) ?? 0) + 1);
    filas = pedido.items.flatMap((it) => {
      const unidades = (pedido.estado === "Entregado" ? it.cantidad : it.cantidadRecibida) - (porItem.get(it.id) ?? 0);
      return Array.from({ length: Math.max(0, unidades) }, () => ({
        descripcion: it.producto,
        pedidoItemId: it.id,
        asignadoA: pedido.solicitante,
        sector: pedido.sector,
        ubicacion: pedido.domicilioEntrega,
      }));
    });
    filas = filas.slice(0, MAX_PRECARGA);
  }
  const volverA = pedido ? `/pedidos/${pedido.id}` : "/equipos";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={volverA} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" /> {pedido ? codigoPedido(pedido.id) : "Inventario"}
      </Link>
      <PageHeader
        title={pedido ? "Registrar equipos recibidos" : "Cargar equipo"}
        description={
          pedido
            ? filas.length
              ? `${filas.length === 1 ? "Un equipo" : `${filas.length} equipos`} de ${codigoPedido(pedido.id)}. Completá el número de serie y, si cambia, a quién se le da.`
              : `Todo lo recibido de ${codigoPedido(pedido.id)} ya está en el inventario. Podés cargar otro igual.`
            : "Para equipos que ya estaban o que no vinieron por un pedido."
        }
      />
      <AltaEquiposForm
        key={pedido?.id ?? "manual"}
        iniciales={filas.length ? filas : pedido ? [{ sector: pedido.sector, ubicacion: pedido.domicilioEntrega }] : []}
        pedidoId={pedido?.id}
        volverA={volverA}
      />
    </div>
  );
}

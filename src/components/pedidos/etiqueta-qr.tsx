import { Etiqueta } from "@/components/etiqueta";
import { codigoPedido } from "@/lib/format";
import { rutaRecibir } from "@/lib/qr-texto";

/** Etiqueta para pegar en el paquete: al escanearla se abre la confirmación de entrega del pedido. */
export function EtiquetaQr({
  pedido,
}: {
  pedido: { id: number; producto: string; cantidad: number; sector: string; solicitante: string; domicilioEntrega: string };
}) {
  return (
    <Etiqueta
      titulo="Etiqueta de entrega"
      descripcion="Imprimila y pegala en el paquete. Al escanearla se confirma la recepción."
      ruta={rutaRecibir(pedido.id)}
      codigo={codigoPedido(pedido.id)}
      nombre={pedido.producto}
      lineas={[`${pedido.cantidad} u. · ${pedido.sector}`, pedido.solicitante, pedido.domicilioEntrega]}
    />
  );
}

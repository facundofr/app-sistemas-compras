import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { codigoPedido } from "@/lib/format";
import { qrSvg, urlRecibir } from "@/lib/qr";
import { ImprimirEtiqueta } from "./imprimir-etiqueta";

/** Etiqueta para pegar en el paquete: al escanearla se abre la confirmación de entrega del pedido. */
export async function EtiquetaQr({
  pedido,
}: {
  pedido: { id: number; producto: string; cantidad: number; sector: string; solicitante: string; domicilioEntrega: string };
}) {
  const svg = await qrSvg(await urlRecibir(pedido.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15.5px] font-bold">Etiqueta de entrega</CardTitle>
        <CardDescription>Imprimila y pegala en el paquete. Al escanearla se confirma la recepción.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Siempre negro sobre blanco, también en modo oscuro: es lo que mejor leen las cámaras. */}
        <div className="etiqueta-qr mx-auto flex max-w-[340px] items-center gap-4 rounded-lg border bg-white p-4 text-[#12181f]">
          <div
            className="size-[120px] shrink-0 [&>svg]:size-full"
            role="img"
            aria-label={`Código QR de ${codigoPedido(pedido.id)}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="min-w-0 space-y-1">
            <div className="font-mono text-[15px] font-bold">{codigoPedido(pedido.id)}</div>
            <div className="line-clamp-3 text-[12.5px] leading-snug font-semibold">{pedido.producto}</div>
            <div className="text-[11px] leading-snug text-[#5f6874]">
              {pedido.cantidad} u. · {pedido.sector}
              <br />
              {pedido.solicitante}
              <br />
              {pedido.domicilioEntrega}
            </div>
          </div>
        </div>
        <ImprimirEtiqueta />
      </CardContent>
    </Card>
  );
}

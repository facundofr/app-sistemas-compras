import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { qrSvg, urlAbsoluta } from "@/lib/qr";
import { ImprimirEtiqueta } from "./pedidos/imprimir-etiqueta";

/**
 * Tarjeta con una etiqueta QR imprimible (tamaño sticker). La usan los pedidos (para el paquete)
 * y los equipos del inventario (para pegar en el equipo).
 */
export async function Etiqueta({
  titulo,
  descripcion,
  ruta,
  codigo,
  nombre,
  lineas,
}: {
  titulo: string;
  descripcion: string;
  /** Ruta de la app (sin basePath) que abre el QR. */
  ruta: string;
  codigo: string;
  nombre: string;
  lineas: (string | null | undefined)[];
}) {
  const svg = await qrSvg(await urlAbsoluta(ruta));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15.5px] font-bold">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Siempre negro sobre blanco, también en modo oscuro: es lo que mejor leen las cámaras. */}
        <div className="etiqueta-qr mx-auto flex max-w-[340px] items-center gap-4 rounded-lg border bg-white p-4 text-[#12181f]">
          <div
            className="size-[120px] shrink-0 [&>svg]:size-full"
            role="img"
            aria-label={`Código QR de ${codigo}`}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="min-w-0 space-y-1">
            <div className="font-mono text-[15px] font-bold">{codigo}</div>
            <div className="line-clamp-3 text-[12.5px] leading-snug font-semibold">{nombre}</div>
            <div className="text-[11px] leading-snug text-[#5f6874]">
              {lineas.filter(Boolean).map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>
        <ImprimirEtiqueta />
      </CardContent>
    </Card>
  );
}

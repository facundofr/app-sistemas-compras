import type { Metadata } from "next";
import { EscanerQr } from "@/components/escaner-qr";
import { PageHeader } from "@/components/page-header";
import { requireUsuario } from "@/lib/auth";

export const metadata: Metadata = { title: "Escanear QR" };

export default async function EscanearPage(props: PageProps<"/escanear">) {
  await requireUsuario();
  const seguido = (await props.searchParams).seguido === "1";
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Escanear etiqueta" description="Leé el QR del paquete para confirmar que llegó." />
      <EscanerQr seguidoInicial={seguido} />
    </div>
  );
}

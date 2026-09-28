import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NuevoPedidoForm } from "@/components/pedidos/nuevo-pedido-form";
import { StatsGenerales } from "@/components/stats-generales";
import { requireUsuario } from "@/lib/auth";
import { hoyISO } from "@/lib/format";
import { getOpciones, getUltimoPedidoDe } from "@/lib/queries";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NuevoPedidoPage() {
  const usuario = await requireUsuario();
  const [opciones, ultimo] = await Promise.all([getOpciones(), getUltimoPedidoDe(usuario.id)]);

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        description="Cargá lo que necesitás pedir. El equipo de Compras se encarga del resto."
      >
        <StatsGenerales />
      </PageHeader>
      <NuevoPedidoForm
        opciones={opciones}
        // Lo que casi nunca cambia se precarga del último pedido del usuario.
        valores={{
          fechaPedido: hoyISO(),
          solicitanteSector: ultimo?.solicitanteSector,
          sector: ultimo?.sector,
          solicitante: ultimo?.solicitante ?? usuario.nombre,
          facturarPor: ultimo?.facturarPor,
          domicilioEntrega: ultimo?.domicilioEntrega ?? opciones.domicilio[0],
          prioridad: "Media",
        }}
      />
    </>
  );
}

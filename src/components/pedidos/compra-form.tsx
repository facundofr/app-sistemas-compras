"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { actualizarCompra, type FormState } from "@/actions/pedidos";
import { ArchivosInput } from "@/components/form/archivos-input";
import { Campo } from "@/components/form/campo";
import { SelectSimple } from "@/components/form/select-simple";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Pedido } from "@/db/schema";

type Opciones = { medio_compra: string[]; medio_pago: string[]; tipo_factura: string[] };

export function CompraForm({ pedido, opciones }: { pedido: Pedido; opciones: Opciones }) {
  const [state, action, pending] = useActionState<FormState & { enviados?: number }, FormData>(
    async (prev, fd) => {
      const r = await actualizarCompra(prev, fd);
      return { ...r, enviados: (prev.enviados ?? 0) + (r.ok ? 1 : 0) };
    },
    {},
  );
  const e = state.errores ?? {};

  useEffect(() => {
    if (!state.stamp) return;
    if (state.ok) toast.success(state.mensaje);
    else if (state.error && !state.errores) toast.error(state.error);
  }, [state]);

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={pedido.id} />
      {state.error && state.errores && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo id="medioCompra" label="Medio de compra" error={e.medioCompra}>
          <SelectSimple
            id="medioCompra"
            name="medioCompra"
            opciones={opciones.medio_compra}
            defaultValue={pedido.medioCompra}
            permitirVacio
            placeholder="Sin definir"
          />
        </Campo>
        <Campo id="proveedor" label="Proveedor" error={e.proveedor}>
          <Input id="proveedor" name="proveedor" maxLength={200} defaultValue={pedido.proveedor ?? ""} />
        </Campo>
        <Campo id="cuit" label="CUIT del proveedor" error={e.cuit}>
          <Input id="cuit" name="cuit" maxLength={20} defaultValue={pedido.cuit ?? ""} placeholder="30-12345678-9" />
        </Campo>
        <Campo id="fechaCompra" label="Fecha de compra" error={e.fechaCompra}>
          <Input id="fechaCompra" name="fechaCompra" type="date" defaultValue={pedido.fechaCompra ?? ""} />
        </Campo>
        <Campo
          id="fechaEstimada"
          label="Llega aprox. el"
          error={e.fechaEstimada}
          ayuda="Se le avisa a quien lo pidió y, si pasa sin entregarse, el pedido pide atención."
        >
          <Input id="fechaEstimada" name="fechaEstimada" type="date" defaultValue={pedido.fechaEstimada ?? ""} />
        </Campo>
        <Campo id="fechaEntrega" label="Fecha de entrega" error={e.fechaEntrega}>
          <Input id="fechaEntrega" name="fechaEntrega" type="date" defaultValue={pedido.fechaEntrega ?? ""} />
        </Campo>
        <Campo id="codigoSeguimiento" label="Código de seguimiento / palabra clave" error={e.codigoSeguimiento}>
          <Input
            id="codigoSeguimiento"
            name="codigoSeguimiento"
            maxLength={200}
            defaultValue={pedido.codigoSeguimiento ?? ""}
          />
        </Campo>
        <Campo
          id="mlOrden"
          label="N° de orden de Mercado Libre"
          error={e.mlOrden}
          ayuda="Si se compró en Mercado Libre: con la cuenta conectada, la fecha estimada y el seguimiento se completan solos."
        >
          <Input id="mlOrden" name="mlOrden" inputMode="numeric" maxLength={30} defaultValue={pedido.mlOrden ?? ""} placeholder="Ej: 2000012345678901" />
        </Campo>
        <Campo id="medioPago" label="Tarjeta / medio de pago" error={e.medioPago}>
          <SelectSimple
            id="medioPago"
            name="medioPago"
            opciones={opciones.medio_pago}
            defaultValue={pedido.medioPago}
            permitirVacio
            placeholder="Sin definir"
          />
        </Campo>
        <Campo id="cuotas" label="Cuotas" error={e.cuotas}>
          <Input id="cuotas" name="cuotas" type="number" min={1} max={60} step={1} defaultValue={pedido.cuotas ?? ""} placeholder="1" />
        </Campo>
        <Campo id="importe" label="Importe total" error={e.importe}>
          <Input
            id="importe"
            name="importe"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={pedido.importe ?? ""}
            placeholder="$"
            className="font-mono"
          />
        </Campo>
      </div>

      <Separator className="my-5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo id="facturaNumero" label="N° de factura" error={e.facturaNumero}>
          <Input id="facturaNumero" name="facturaNumero" maxLength={60} defaultValue={pedido.facturaNumero ?? ""} placeholder="0001-00012345" />
        </Campo>
        <Campo id="tipoFactura" label="Tipo de factura" error={e.tipoFactura}>
          <SelectSimple
            id="tipoFactura"
            name="tipoFactura"
            opciones={opciones.tipo_factura}
            defaultValue={pedido.tipoFactura}
            permitirVacio
            placeholder="Sin definir"
          />
        </Campo>
        <Campo id="facturaLink" label="Link de factura (Drive, etc.)" error={e.facturaLink}>
          <Input
            id="facturaLink"
            name="facturaLink"
            type="url"
            maxLength={2000}
            defaultValue={pedido.facturaLink ?? ""}
            placeholder="https://drive.google.com/..."
          />
        </Campo>
        <Campo id="facturas" label="Adjuntar factura" className="sm:col-span-2 lg:col-span-3">
          {/* Tras guardar bien se remonta vacía: la factura ya quedó en la lista de archivos. */}
          <ArchivosInput key={state.enviados ?? 0} id="facturas" name="facturas" texto="Arrastrá la factura (PDF o foto) o hacé clic para elegirla" />
        </Campo>
        <Campo id="notasCompras" label="Notas de Compras" error={e.notasCompras} className="sm:col-span-2 lg:col-span-3">
          <Textarea id="notasCompras" name="notasCompras" rows={3} maxLength={2000} defaultValue={pedido.notasCompras ?? ""} />
        </Campo>
      </div>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Guardar datos de compra
        </Button>
      </div>
    </form>
  );
}

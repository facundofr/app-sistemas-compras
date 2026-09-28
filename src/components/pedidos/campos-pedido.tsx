"use client";

import { Campo } from "@/components/form/campo";
import { SelectSimple } from "@/components/form/select-simple";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORIDADES } from "@/lib/constants";
import { DomicilioEntrega } from "./domicilio-entrega";

export type ValoresPedido = {
  fechaPedido?: string;
  solicitanteSector?: string | null;
  sector?: string;
  solicitante?: string;
  facturarPor?: string;
  domicilioEntrega?: string;
  prioridad?: string;
  producto?: string;
  cantidad?: number | string;
  link?: string | null;
  comentarios?: string | null;
};

export type OpcionesPedido = {
  solicitante_sector: string[];
  empresa: string[];
  domicilio: string[];
};

/** Los campos del formulario de Google, en el mismo orden, sobre la grilla de 3 columnas. */
export function CamposPedido({
  valores,
  errores = {},
  opciones,
  archivos,
}: {
  valores: ValoresPedido;
  errores?: Record<string, string>;
  opciones: OpcionesPedido;
  /** Zona de «Presupuesto pedido por el sector» (solo al cargar un pedido nuevo). */
  archivos?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      <Campo id="fechaPedido" label="Fecha de pedido" requerido error={errores.fechaPedido}>
        <Input
          id="fechaPedido"
          name="fechaPedido"
          type="date"
          required
          defaultValue={valores.fechaPedido}
          aria-invalid={!!errores.fechaPedido || undefined}
        />
      </Campo>
      <Campo id="solicitanteSector" label="Solicitante del sector" requerido error={errores.solicitanteSector}>
        <SelectSimple
          id="solicitanteSector"
          name="solicitanteSector"
          opciones={opciones.solicitante_sector}
          defaultValue={valores.solicitanteSector}
          placeholder="Elegí quién lo solicita"
          required
          invalid={!!errores.solicitanteSector}
        />
      </Campo>
      <Campo id="sector" label="¿Qué sector solicitó la compra?" requerido error={errores.sector}>
        <Input
          id="sector"
          name="sector"
          required
          maxLength={120}
          defaultValue={valores.sector}
          placeholder="Ej: IT, Powerbi, Suc. Ramos Mejía"
          aria-invalid={!!errores.sector || undefined}
        />
      </Campo>

      <Campo id="solicitante" label="Nombre y apellido del solicitante" requerido error={errores.solicitante}>
        <Input
          id="solicitante"
          name="solicitante"
          required
          maxLength={120}
          defaultValue={valores.solicitante}
          placeholder="Nombre y apellido"
          autoComplete="name"
          aria-invalid={!!errores.solicitante || undefined}
        />
      </Campo>
      <Campo
        id="facturarPor"
        label="Facturar por"
        requerido
        error={errores.facturarPor}
        ayuda="Si no sabés a qué empresa facturar, elegí NA y queda a criterio del sector."
      >
        <SelectSimple
          id="facturarPor"
          name="facturarPor"
          opciones={opciones.empresa}
          defaultValue={valores.facturarPor}
          placeholder="Elegí la empresa"
          required
          invalid={!!errores.facturarPor}
        />
      </Campo>
      <Campo id="prioridad" label="Prioridad" requerido error={errores.prioridad}>
        <SelectSimple
          id="prioridad"
          name="prioridad"
          opciones={PRIORIDADES}
          defaultValue={valores.prioridad ?? "Media"}
          required
        />
      </Campo>

      <Campo
        id="domicilioEntrega"
        label="Domicilio de entrega"
        requerido
        error={errores.domicilioEntrega}
        className="sm:col-span-2 lg:col-span-3"
      >
        <DomicilioEntrega
          opciones={opciones.domicilio}
          defaultValue={valores.domicilioEntrega}
          invalid={!!errores.domicilioEntrega}
        />
      </Campo>

      <Campo id="producto" label="Producto solicitado" requerido error={errores.producto} className="lg:col-span-2">
        <Input
          id="producto"
          name="producto"
          required
          maxLength={500}
          defaultValue={valores.producto}
          placeholder="Ej: Monitor Full HD 22'' con HDMI y VGA"
          aria-invalid={!!errores.producto || undefined}
        />
      </Campo>
      <Campo id="cantidad" label="Cantidad" requerido error={errores.cantidad}>
        <Input
          id="cantidad"
          name="cantidad"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          defaultValue={valores.cantidad}
          placeholder="Ej: 2"
          aria-invalid={!!errores.cantidad || undefined}
        />
      </Campo>

      <Campo id="link" label="Link" requerido error={errores.link} className="sm:col-span-2 lg:col-span-3">
        <Input
          id="link"
          name="link"
          inputMode="url"
          required
          maxLength={2000}
          defaultValue={valores.link ?? ""}
          placeholder="https://..."
          aria-invalid={!!errores.link || undefined}
        />
      </Campo>

      {archivos && <div className="sm:col-span-2 lg:col-span-3">{archivos}</div>}

      <Campo
        id="comentarios"
        label="Comentarios adicionales"
        error={errores.comentarios}
        className="sm:col-span-2 lg:col-span-3"
      >
        <Textarea
          id="comentarios"
          name="comentarios"
          rows={3}
          maxLength={2000}
          defaultValue={valores.comentarios ?? ""}
          placeholder="Marca, modelo, urgencia, aclaraciones..."
        />
      </Campo>
    </div>
  );
}

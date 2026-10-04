"use client";

import { useActionState, useEffect } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { actualizarEquipo } from "@/actions/equipos";
import type { FormState } from "@/actions/pedidos";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Equipo } from "@/db/schema";
import { ESTADOS_EQUIPO } from "@/lib/equipos";
import { claseSelect } from "./alta-equipos-form";

/** Edición de un equipo. Reasignarlo o cambiarle el estado queda registrado en su historial. */
export function EquipoForm({ equipo }: { equipo: Equipo }) {
  const [state, action, pending] = useActionState<FormState, FormData>(actualizarEquipo, {});
  const e = state.errores ?? {};

  useEffect(() => {
    if (state.ok && state.stamp) toast.success(state.mensaje);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={equipo.id} />
      <Campo id="descripcion" label="Equipo" requerido error={e.descripcion} className="sm:col-span-2">
        <Input id="descripcion" name="descripcion" required maxLength={300} defaultValue={equipo.descripcion} />
      </Campo>
      <Campo id="numeroSerie" label="N° de serie" error={e.numeroSerie}>
        <Input id="numeroSerie" name="numeroSerie" maxLength={120} defaultValue={equipo.numeroSerie ?? ""} className="font-mono" />
      </Campo>
      <Campo id="estado" label="Estado" error={e.estado}>
        <select id="estado" name="estado" defaultValue={equipo.estado} className={claseSelect}>
          {Object.entries(ESTADOS_EQUIPO).map(([v, x]) => (
            <option key={v} value={v}>
              {x.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="asignadoA" label="Asignado a" error={e.asignadoA}>
        <Input id="asignadoA" name="asignadoA" maxLength={120} defaultValue={equipo.asignadoA ?? ""} />
      </Campo>
      <Campo id="sector" label="Sector" error={e.sector}>
        <Input id="sector" name="sector" maxLength={120} defaultValue={equipo.sector ?? ""} />
      </Campo>
      <Campo id="ubicacion" label="Ubicación" error={e.ubicacion}>
        <Input id="ubicacion" name="ubicacion" maxLength={200} defaultValue={equipo.ubicacion ?? ""} />
      </Campo>
      <Campo id="garantiaHasta" label="Garantía hasta" error={e.garantiaHasta}>
        <Input id="garantiaHasta" name="garantiaHasta" type="date" defaultValue={equipo.garantiaHasta ?? ""} />
      </Campo>
      <Campo id="notas" label="Notas" error={e.notas} className="sm:col-span-2">
        <Textarea id="notas" name="notas" rows={3} maxLength={2000} defaultValue={equipo.notas ?? ""} />
      </Campo>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Guardar cambios
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { crearEquipos } from "@/actions/equipos";
import type { FormState } from "@/actions/pedidos";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EstadoEquipo } from "@/db/schema";
import { ESTADOS_EQUIPO } from "@/lib/equipos";

export type FilaEquipo = {
  descripcion?: string;
  pedidoItemId?: number | null;
  asignadoA?: string | null;
  sector?: string | null;
  ubicacion?: string | null;
  estado?: EstadoEquipo;
};

export const claseSelect =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-[13.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Alta de equipos al inventario: una fila por equipo. Desde un pedido llega precargada con una fila
 * por unidad recibida; solo falta el número de serie y, si cambia, a quién se le da.
 */
export function AltaEquiposForm({
  iniciales,
  pedidoId,
  volverA,
}: {
  iniciales: FilaEquipo[];
  pedidoId?: number;
  volverA: string;
}) {
  const router = useRouter();
  const base = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(crearEquipos, {});
  const [filas, setFilas] = useState(() => (iniciales.length ? iniciales : [{}]).map((f, clave) => ({ ...f, clave })));
  const contador = useRef(filas.length);
  const e = state.errores ?? {};

  useEffect(() => {
    if (state.ok && state.stamp) {
      toast.success(state.mensaje);
      router.push(volverA);
    } else if (state.error) toast.error(state.error);
  }, [state, router, volverA]);

  return (
    <form action={action} className="space-y-4">
      {pedidoId && <input type="hidden" name="pedidoId" value={pedidoId} />}
      {filas.map((f, i) => {
        const err = (c: string) => e[`eq.${i}.${c}`];
        const id = (c: string) => `${base}-${c}-${f.clave}`;
        return (
          <fieldset key={f.clave} className="rounded-xl border bg-card p-4" aria-label={`Equipo ${i + 1}`}>
            <input type="hidden" name="eq_item" value={f.pedidoItemId ?? ""} />
            <div className="mb-2 flex items-center justify-between">
              <legend className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">Equipo {i + 1}</legend>
              {filas.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar el equipo ${i + 1}`}
                  onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo id={id("descripcion")} label="Equipo" requerido error={err("descripcion")} className="sm:col-span-2 lg:col-span-1">
                <Input
                  id={id("descripcion")}
                  name="eq_descripcion"
                  required
                  maxLength={300}
                  defaultValue={f.descripcion}
                  placeholder="Ej: Notebook Lenovo ThinkPad E14"
                />
              </Campo>
              <Campo id={id("numeroSerie")} label="N° de serie" error={err("numeroSerie")}>
                <Input
                  id={id("numeroSerie")}
                  name="eq_numeroSerie"
                  maxLength={120}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="Está en la etiqueta del equipo"
                  className="font-mono"
                />
              </Campo>
              <Campo id={id("estado")} label="Estado" error={err("estado")}>
                <select id={id("estado")} name="eq_estado" defaultValue={f.estado ?? "en_uso"} className={claseSelect}>
                  {Object.entries(ESTADOS_EQUIPO).map(([v, x]) => (
                    <option key={v} value={v}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id={id("asignadoA")} label="Asignado a" error={err("asignadoA")}>
                <Input id={id("asignadoA")} name="eq_asignadoA" maxLength={120} defaultValue={f.asignadoA ?? ""} placeholder="Nombre y apellido" />
              </Campo>
              <Campo id={id("sector")} label="Sector" error={err("sector")}>
                <Input id={id("sector")} name="eq_sector" maxLength={120} defaultValue={f.sector ?? ""} />
              </Campo>
              <Campo id={id("ubicacion")} label="Ubicación" error={err("ubicacion")}>
                <Input id={id("ubicacion")} name="eq_ubicacion" maxLength={200} defaultValue={f.ubicacion ?? ""} placeholder="Ej: Cramer 1652, 2° piso" />
              </Campo>
              <Campo id={id("garantiaHasta")} label="Garantía hasta" error={err("garantiaHasta")}>
                <Input id={id("garantiaHasta")} name="eq_garantiaHasta" type="date" />
              </Campo>
              <Campo id={id("notas")} label="Notas" error={err("notas")} className="sm:col-span-2">
                <Input id={id("notas")} name="eq_notas" maxLength={2000} placeholder="Accesorios, cargador, licencia..." />
              </Campo>
            </div>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const ultimo = filas[filas.length - 1];
            // Arranca con los datos precargados del anterior (mismo equipo y sector): lo común al cargar varios.
            setFilas((fs) => [...fs, { ...ultimo, pedidoItemId: ultimo?.pedidoItemId, clave: contador.current++ }]);
          }}
        >
          <PlusIcon /> Agregar otro equipo
        </Button>
        <Button type="submit" disabled={pending} className="min-w-40">
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {filas.length === 1 ? "Registrar equipo" : `Registrar ${filas.length} equipos`}
        </Button>
      </div>
    </form>
  );
}

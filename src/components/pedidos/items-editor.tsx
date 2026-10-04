"use client";

import { useId, useRef, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ITEMS_MAX } from "@/lib/items";

export type ItemValor = { producto?: string; cantidad?: number | string; link?: string | null };
type Fila = ItemValor & { clave: number };

/**
 * Los productos del pedido, como un carrito: una fila por producto y «Agregar otro producto».
 * Viajan en el form como columnas repetidas (item_producto, item_cantidad, item_link).
 */
export function ItemsEditor({
  iniciales,
  errores = {},
  sugerencias,
}: {
  iniciales?: ItemValor[];
  errores?: Record<string, string>;
  /** Productos ya pedidos: el navegador los sugiere mientras se escribe. */
  sugerencias?: string[];
}) {
  // Claves estables entre servidor y navegador: las iniciales por posición, las nuevas siguen contando.
  const base = useId();
  const [filas, setFilas] = useState<Fila[]>(() =>
    (iniciales?.length ? iniciales : [{}]).map((v, clave) => ({ ...v, clave })),
  );
  const contador = useRef(filas.length);
  const varios = filas.length > 1;
  const err = (i: number, campo: string) => errores[`items.${i}.${campo}`];

  return (
    <div className="space-y-3">
      {filas.map((f, i) => (
        <div
          key={f.clave}
          className={varios ? "relative rounded-xl border bg-muted/30 p-3 pt-2.5" : undefined}
          aria-label={varios ? `Producto ${i + 1}` : undefined}
          role={varios ? "group" : undefined}
        >
          {varios && (
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">Producto {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label={`Quitar el producto ${i + 1}`}
                onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
              >
                <Trash2Icon />
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,1fr)_120px] lg:grid-cols-[minmax(0,2fr)_140px_minmax(0,1.4fr)]">
            <Campo id={`${base}-producto-${f.clave}`} label="Producto solicitado" requerido error={err(i, "producto")}>
              <Input
                id={`${base}-producto-${f.clave}`}
                name="item_producto"
                list={sugerencias?.length ? `${base}-sugerencias` : undefined}
                autoComplete="off"
                required
                maxLength={500}
                defaultValue={f.producto}
                placeholder="Ej: Monitor Full HD 22'' con HDMI y VGA"
                aria-invalid={!!err(i, "producto") || undefined}
              />
            </Campo>
            <Campo id={`${base}-cantidad-${f.clave}`} label="Cantidad" requerido error={err(i, "cantidad")}>
              <Input
                id={`${base}-cantidad-${f.clave}`}
                name="item_cantidad"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                defaultValue={f.cantidad}
                placeholder="Ej: 2"
                aria-invalid={!!err(i, "cantidad") || undefined}
              />
            </Campo>
            <Campo id={`${base}-link-${f.clave}`} label="Link" requerido error={err(i, "link")} className="sm:col-span-2 lg:col-span-1">
              <Input
                id={`${base}-link-${f.clave}`}
                name="item_link"
                inputMode="url"
                required
                maxLength={2000}
                defaultValue={f.link ?? ""}
                placeholder="https://..."
                aria-invalid={!!err(i, "link") || undefined}
              />
            </Campo>
          </div>
        </div>
      ))}
      {!!sugerencias?.length && (
        <datalist id={`${base}-sugerencias`}>
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {errores.items && <p className="text-[12.5px] text-destructive">{errores.items}</p>}
      {filas.length < ITEMS_MAX && (
        <Button type="button" variant="outline" size="sm" onClick={() => setFilas((fs) => [...fs, { clave: contador.current++ }])}>
          <PlusIcon /> Agregar otro producto
        </Button>
      )}
    </div>
  );
}

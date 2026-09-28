"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SELECT_VACIO } from "@/lib/constants";
import { cn } from "@/lib/utils";

const VACIO = SELECT_VACIO;

/**
 * Select de shadcn que viaja en un <form> como un campo nativo.
 * Si el valor actual ya no está en la lista (opción desactivada), se sigue mostrando.
 */
export function SelectSimple({
  id,
  name,
  opciones,
  defaultValue,
  placeholder = "Elegí una opción",
  permitirVacio,
  required,
  invalid,
  className,
  onValueChange,
  etiquetas,
}: {
  id: string;
  name: string;
  opciones: readonly string[];
  /** Texto a mostrar por valor, cuando no es el valor mismo. */
  etiquetas?: Record<string, string>;
  defaultValue?: string | null;
  placeholder?: string;
  permitirVacio?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  onValueChange?: (v: string) => void;
}) {
  const lista = defaultValue && !opciones.includes(defaultValue) ? [defaultValue, ...opciones] : opciones;
  return (
    <Select
      name={name}
      defaultValue={defaultValue || (permitirVacio ? VACIO : undefined)}
      required={required}
      onValueChange={(v) => onValueChange?.(v === VACIO ? "" : v)}
    >
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-72">
        {permitirVacio && (
          <SelectItem value={VACIO} className="text-muted-foreground">
            Sin definir
          </SelectItem>
        )}
        {lista.map((o) => (
          <SelectItem key={o} value={o}>
            {etiquetas?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


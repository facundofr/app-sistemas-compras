"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TODOS = "__todos__";

export type FiltroDef =
  | { tipo: "busqueda"; param: string; placeholder: string }
  | { tipo: "select"; param: string; todos: string; opciones: { value: string; label: string }[] }
  | { tipo: "fecha"; param: string; label: string }
  | { tipo: "check"; param: string; label: string };

/** Barra de filtros que vive en la URL: se puede compartir el link con los filtros aplicados. */
export function FiltrosUrl({ filtros, className }: { filtros: FiltroDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const busqueda = filtros.find((f) => f.tipo === "busqueda");
  const [texto, setTexto] = useState(busqueda ? (sp.get(busqueda.param) ?? "") : "");

  function aplicar(cambios: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Búsqueda con una pequeña espera para no pedir en cada tecla.
  useEffect(() => {
    if (!busqueda) return;
    if ((sp.get(busqueda.param) ?? "") === texto) return;
    const t = setTimeout(() => aplicar({ [busqueda.param]: texto.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const hayFiltros = filtros.some((f) => sp.get(f.param));

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      {filtros.map((f) => {
        if (f.tipo === "busqueda")
          return (
            <div key={f.param} className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={f.placeholder}
                className="pl-8"
                aria-label={f.placeholder}
              />
            </div>
          );
        if (f.tipo === "select")
          return (
            <Select
              key={f.param}
              value={sp.get(f.param) ?? TODOS}
              onValueChange={(v) => aplicar({ [f.param]: v === TODOS ? null : v })}
            >
              <SelectTrigger className="w-full sm:w-auto sm:min-w-40" aria-label={f.todos}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={TODOS}>{f.todos}</SelectItem>
                {f.opciones.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        if (f.tipo === "fecha")
          return (
            <label key={f.param} className="flex items-center gap-2 text-xs text-muted-foreground">
              {f.label}
              <Input
                type="date"
                value={sp.get(f.param) ?? ""}
                onChange={(e) => aplicar({ [f.param]: e.target.value || null })}
                className="w-40"
              />
            </label>
          );
        return (
          <div key={f.param} className="flex items-center gap-2 px-1">
            <Checkbox
              id={`f-${f.param}`}
              checked={sp.get(f.param) === "1"}
              onCheckedChange={(c) => aplicar({ [f.param]: c ? "1" : null })}
            />
            <Label htmlFor={`f-${f.param}`} className="text-[13px] font-normal">
              {f.label}
            </Label>
          </div>
        );
      })}
      {hayFiltros && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexto("");
            start(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <XIcon /> Quitar filtros
        </Button>
      )}
      {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

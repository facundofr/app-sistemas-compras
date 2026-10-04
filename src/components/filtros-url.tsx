"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TODOS = "__todos__";
/** Parámetro de «Ver más»: se reinicia cada vez que cambian los filtros. */
export const PARAM_VER = "ver";

export type FiltroDef =
  | { tipo: "busqueda"; param: string; placeholder: string }
  | { tipo: "select"; param: string; todos: string; opciones: { value: string; label: string }[]; chip?: string }
  | { tipo: "fecha"; param: string; label: string }
  | { tipo: "check"; param: string; label: string };

/**
 * Filtros que viven en la URL (se puede compartir el link con los filtros aplicados).
 * Como en Mercado Libre: los activos se ven como chips que se quitan con un toque, y en el celular
 * los filtros se abren en un panel desde abajo en vez de ocupar media pantalla.
 */
export function FiltrosUrl({ filtros, className }: { filtros: FiltroDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState(false);

  const busqueda = filtros.find((f) => f.tipo === "busqueda");
  const otros = filtros.filter((f) => f.tipo !== "busqueda");
  const [texto, setTexto] = useState(busqueda ? (sp.get(busqueda.param) ?? "") : "");

  function aplicar(cambios: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    next.delete(PARAM_VER);
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

  const chips = filtros.flatMap((f) => {
    const v = sp.get(f.param);
    if (!v) return [];
    const texto =
      f.tipo === "busqueda"
        ? `«${v}»`
        : f.tipo === "select"
          ? `${f.chip ? `${f.chip}: ` : ""}${f.opciones.find((o) => o.value === v)?.label ?? v}`
          : f.tipo === "fecha"
            ? `${f.label} ${fmtDate(v)}`
            : f.label;
    return [{ param: f.param, texto }];
  });
  const activosEnPanel = otros.filter((f) => sp.get(f.param)).length;

  const controles = (apilado: boolean) =>
    otros.map((f) => {
      if (f.tipo === "select")
        return (
          <Select key={f.param} value={sp.get(f.param) ?? TODOS} onValueChange={(v) => aplicar({ [f.param]: v === TODOS ? null : v })}>
            <SelectTrigger className={cn("w-full", !apilado && "sm:w-auto sm:min-w-40")} aria-label={f.todos}>
              {/* Con el texto explícito, el valor se ve desde el primer render y no recién al abrir el menú. */}
              <SelectValue>{f.opciones.find((o) => o.value === sp.get(f.param))?.label ?? f.todos}</SelectValue>
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
          <label key={f.param} className={cn("flex items-center gap-2 text-xs text-muted-foreground", apilado && "justify-between")}>
            {f.label}
            <Input
              type="date"
              value={sp.get(f.param) ?? ""}
              onChange={(e) => aplicar({ [f.param]: e.target.value || null })}
              className={apilado ? "w-44" : "w-40"}
            />
          </label>
        );
      if (f.tipo === "check")
        return (
          <div key={f.param} className={cn("flex items-center gap-2 px-1", apilado && "py-1")}>
            <Checkbox
              id={`f-${f.param}${apilado ? "-m" : ""}`}
              checked={sp.get(f.param) === "1"}
              onCheckedChange={(c) => aplicar({ [f.param]: c ? "1" : null })}
            />
            <Label htmlFor={`f-${f.param}${apilado ? "-m" : ""}`} className="text-[13px] font-normal">
              {f.label}
            </Label>
          </div>
        );
      return null;
    });

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center gap-2.5">
        {busqueda && (
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={busqueda.placeholder}
              className="pl-8"
              aria-label={busqueda.placeholder}
            />
          </div>
        )}

        {/* Celular: un botón «Filtros» que abre el panel. */}
        {otros.length > 0 && (
          <Sheet open={panel} onOpenChange={setPanel}>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">
                <SlidersHorizontalIcon /> Filtros
                {activosEnPanel > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-bold text-primary-foreground">
                    {activosEnPanel}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85svh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="grid gap-3 overflow-y-auto px-4">{controles(true)}</div>
              <SheetFooter className="flex-row">
                {activosEnPanel > 0 && (
                  <Button variant="outline" className="flex-1" onClick={() => aplicar(Object.fromEntries(otros.map((f) => [f.param, null])))}>
                    Limpiar
                  </Button>
                )}
                <Button className="flex-1" onClick={() => setPanel(false)}>
                  Ver resultados
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}

        {/* Escritorio: los filtros en línea. */}
        <div className="contents max-md:hidden">{controles(false)}</div>
        {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros aplicados">
          {chips.map((c) => (
            <button
              key={c.param}
              type="button"
              onClick={() => {
                if (c.param === busqueda?.param) setTexto("");
                aplicar({ [c.param]: null });
              }}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-foreground hover:border-primary/60"
              aria-label={`Quitar filtro ${c.texto}`}
            >
              <span className="truncate">{c.texto}</span>
              <XIcon className="size-3.5 shrink-0" />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                start(() => router.replace(pathname, { scroll: false }));
              }}
              className="px-1.5 text-[12px] font-medium text-primary hover:underline"
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

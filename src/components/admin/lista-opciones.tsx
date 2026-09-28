"use client";

import { startTransition, useActionState, useEffect, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { agregarOpcion, alternarOpcion, moverOpcion } from "@/actions/opciones";
import type { FormState } from "@/actions/pedidos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Lista } from "@/db/schema";
import { cn } from "@/lib/utils";

type Opcion = { id: number; valor: string; activo: boolean };

function Fila({ o, primera, ultima }: { o: Opcion; primera: boolean; ultima: boolean }) {
  const [pending, start] = useTransition();
  const correr = (fn: () => Promise<FormState>) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
    });
  return (
    <li className={cn("flex items-center gap-2 py-1.5", pending && "opacity-60")}>
      <Switch
        checked={o.activo}
        onCheckedChange={(c) => correr(() => alternarOpcion(o.id, c))}
        aria-label={o.activo ? `Ocultar ${o.valor}` : `Mostrar ${o.valor}`}
        size="sm"
      />
      <span className={cn("flex-1 truncate text-[13px]", !o.activo && "text-muted-foreground line-through")}>{o.valor}</span>
      <Button variant="ghost" size="icon-xs" disabled={primera || pending} onClick={() => correr(() => moverOpcion(o.id, -1))} aria-label="Subir">
        <ArrowUpIcon />
      </Button>
      <Button variant="ghost" size="icon-xs" disabled={ultima || pending} onClick={() => correr(() => moverOpcion(o.id, 1))} aria-label="Bajar">
        <ArrowDownIcon />
      </Button>
    </li>
  );
}

export function ListaOpciones({ lista, singular, opciones }: { lista: Lista; singular: string; opciones: Opcion[] }) {
  const [state, action, pending] = useActionState<FormState & { enviados?: number }, FormData>(
    async (prev, fd) => {
      const r = await agregarOpcion(prev, fd);
      return { ...r, enviados: (prev.enviados ?? 0) + (r.ok ? 1 : 0) };
    },
    {},
  );
  useEffect(() => {
    if (state.ok && state.stamp) toast.success(state.mensaje);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {opciones.map((o, i) => (
          <Fila key={o.id} o={o} primera={i === 0} ultima={i === opciones.length - 1} />
        ))}
      </ul>
      <form
        key={state.enviados ?? 0}
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        <input type="hidden" name="lista" value={lista} />
        <Input name="valor" placeholder={`Agregar ${singular}`} maxLength={120} required className="h-8" aria-label={`Agregar ${singular}`} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Agregar
        </Button>
      </form>
    </div>
  );
}

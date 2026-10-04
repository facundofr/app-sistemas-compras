"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { crearPedido, type FormState } from "@/actions/pedidos";
import { ArchivosInput } from "@/components/form/archivos-input";
import { Campo } from "@/components/form/campo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { codigoPedido } from "@/lib/format";
import { CamposPedido, type OpcionesPedido, type ValoresPedido } from "./campos-pedido";

export function NuevoPedidoForm({
  valores,
  opciones,
  sugerencias,
}: {
  valores: ValoresPedido;
  opciones: OpcionesPedido;
  sugerencias?: string[];
}) {
  const [state, action, pending] = useActionState<FormState & { enviados?: number }, FormData>(
    async (prev, fd) => {
      const r = await crearPedido(prev, fd);
      return { ...r, enviados: (prev.enviados ?? 0) + (r.ok ? 1 : 0) };
    },
    {},
  );
  const [limpiezas, setLimpiezas] = useState(0);
  // La key cambia al enviar bien (o al limpiar) para montar un form vacío, incluidos selects y archivos.
  // Si hay errores de validación la key no cambia y se conserva lo cargado.
  const formKey = `${state.enviados ?? 0}-${limpiezas}`;
  const confirmado = state.ok && state.id ? state : null;

  useEffect(() => {
    if (state.ok && state.stamp) {
      toast.success(state.mensaje);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [state]);

  return (
    <div className="space-y-4">
      {confirmado?.id && (
        <Alert className="border-primary/40 bg-teal-soft text-foreground">
          <CheckCircle2Icon className="text-primary" />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground">
            <span>
              <strong className="font-semibold text-primary">Pedido enviado.</strong> Código{" "}
              <span className="font-mono font-medium">{codigoPedido(confirmado.id)}</span> — el equipo de Compras ya lo
              puede ver y empezar a gestionar.
            </span>
            <Link href={`/pedidos/${confirmado.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
              Ver pedido
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-6 py-4 [.border-b]:pb-4">
          <CardTitle className="font-heading text-[15.5px] font-bold">Datos del pedido</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => action(fd));
            }}
            noValidate={false}
          >
            {state.error && !state.ok && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <CamposPedido
              valores={valores}
              errores={state.ok ? {} : state.errores}
              opciones={opciones}
              sugerencias={sugerencias}
              archivos={
                <Campo
                  id="archivos"
                  label="Presupuesto pedido por el sector"
                  ayuda="Opcional. El presupuesto que consiguió el sector, fotos del producto o capturas."
                >
                  <ArchivosInput id="archivos" name="archivos" texto="Arrastrá el presupuesto o hacé clic para elegir archivos" />
                </Campo>
              }
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2.5 border-t pt-5">
              <Button type="button" variant="outline" onClick={() => setLimpiezas((n) => n + 1)} disabled={pending}>
                Limpiar
              </Button>
              <Button type="submit" disabled={pending} className="min-w-36">
                {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                Enviar pedido
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

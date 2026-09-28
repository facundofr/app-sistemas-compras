"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { actualizarPedido, type FormState } from "@/actions/pedidos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CamposPedido, type OpcionesPedido, type ValoresPedido } from "./campos-pedido";

export function EditarPedidoForm({
  id,
  valores,
  opciones,
}: {
  id: number;
  valores: ValoresPedido;
  opciones: OpcionesPedido;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(actualizarPedido, {});

  useEffect(() => {
    if (state.ok && state.stamp) toast.success(state.mensaje);
  }, [state]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <CamposPedido valores={valores} errores={state.errores} opciones={opciones} />
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

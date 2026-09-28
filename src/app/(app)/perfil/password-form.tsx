"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { FormState } from "@/actions/pedidos";
import { cambiarMiPassword } from "@/actions/usuarios";
import { Campo } from "@/components/form/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CambiarPasswordForm() {
  const [state, action, pending] = useActionState<FormState & { enviados?: number }, FormData>(
    async (prev, fd) => {
      const r = await cambiarMiPassword(prev, fd);
      return { ...r, enviados: (prev.enviados ?? 0) + (r.ok ? 1 : 0) };
    },
    {},
  );
  const e = state.errores ?? {};
  useEffect(() => {
    if (state.ok && state.stamp) toast.success(state.mensaje);
    else if (state.error && !state.errores) toast.error(state.error);
  }, [state]);

  return (
    <form
      key={state.enviados ?? 0}
      className="grid gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <Campo id="actual" label="Contraseña actual" requerido error={e.actual}>
        <Input id="actual" name="actual" type="password" required autoComplete="current-password" />
      </Campo>
      <Campo id="nueva" label="Contraseña nueva" requerido error={e.nueva}>
        <Input id="nueva" name="nueva" type="password" required minLength={8} autoComplete="new-password" />
      </Campo>
      <Campo id="repetir" label="Repetí la contraseña nueva" requerido error={e.repetir}>
        <Input id="repetir" name="repetir" type="password" required minLength={8} autoComplete="new-password" />
      </Campo>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { Resultado } from "@/actions/integraciones";
import { Button } from "@/components/ui/button";

/** Botón que corre una acción del servidor y muestra el resultado en un aviso. */
export function BotonAccion({
  accion,
  children,
  variant = "outline",
}: {
  accion: () => Promise<Resultado>;
  children: React.ReactNode;
  variant?: "outline" | "default" | "ghost";
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await accion();
          if (r.error) toast.error(r.error);
          else if (r.mensaje) toast.success(r.mensaje);
        })
      }
    >
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}

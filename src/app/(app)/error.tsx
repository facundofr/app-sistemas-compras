"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { conBase } from "@/lib/base-path";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Los errores con digest vienen del servidor y ya se registraron allá; los del navegador se informan acá.
  useEffect(() => {
    if (error.digest) return;
    try {
      navigator.sendBeacon(
        conBase("/api/errores"),
        new Blob(
          [JSON.stringify({ mensaje: error.message, stack: error.stack?.slice(0, 4000), url: location.pathname })],
          { type: "application/json" },
        ),
      );
    } catch {}
  }, [error]);

  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-bold tracking-tight">Algo falló al cargar esta pantalla</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Probá de nuevo. Si vuelve a pasar, avisale al administrador
        {error.digest && (
          <>
            {" "}
            con este código: <span className="font-mono">{error.digest}</span>
          </>
        )}
        .
      </p>
      <Button onClick={reset} className="mt-2">
        Reintentar
      </Button>
    </div>
  );
}

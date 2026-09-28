"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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

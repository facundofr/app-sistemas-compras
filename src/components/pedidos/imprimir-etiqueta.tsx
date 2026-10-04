"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Imprime solo la etiqueta: el resto de la página se oculta con las reglas de @media print de globals.css. */
export function ImprimirEtiqueta() {
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => {
        const html = document.documentElement;
        html.classList.add("imprimiendo-etiqueta");
        // En los celulares print() no bloquea: la clase se quita recién cuando termina el diálogo.
        window.addEventListener("afterprint", () => html.classList.remove("imprimiendo-etiqueta"), { once: true });
        window.print();
      }}
    >
      <PrinterIcon /> Imprimir etiqueta
    </Button>
  );
}

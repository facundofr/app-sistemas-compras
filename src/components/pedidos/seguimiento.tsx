"use client";

import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { seguimientoDe } from "@/lib/seguimiento";

/** Código de seguimiento con acceso directo al envío (o para copiar si no hay link). */
export function Seguimiento({ codigo, medioCompra }: { codigo: string | null; medioCompra: string | null }) {
  const s = seguimientoDe(codigo, medioCompra);
  if (!s) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {!s.url?.startsWith(s.codigo) && <span className="font-mono text-[12.5px] break-all">{s.codigo}</span>}
      {s.url ? (
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Seguir {s.empresa ? `en ${s.empresa}` : "envío"} <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(s.codigo);
              toast.success(`Código copiado${s.empresa ? `: buscalo en ${s.empresa}` : ""}.`);
            } catch {
              toast.error("No se pudo copiar el código.");
            }
          }}
        >
          <CopyIcon className="size-3.5" /> Copiar{s.empresa ? ` (${s.empresa})` : ""}
        </button>
      )}
    </span>
  );
}

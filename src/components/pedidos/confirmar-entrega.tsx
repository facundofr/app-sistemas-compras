"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon, PackageCheckIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { confirmarEntrega, type FormState } from "@/actions/pedidos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ESTRELLAS = ["Llegó mal", "Con problemas", "Regular", "Bien", "Perfecto"];

/**
 * Confirmación de entrega desde la etiqueta QR: un toque alcanza, y opcionalmente se califica
 * cómo llegó y se saca una foto del paquete (queda como comprobante en el pedido).
 * `seguido`: modo «recibir varios»; al confirmar vuelve solo al lector para el próximo paquete.
 */
export function ConfirmarEntrega({ id, seguido }: { id: number; seguido?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(confirmarEntrega, {});
  const [estrellas, setEstrellas] = useState(0);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    if (!state.stamp && !state.error) return;
    if (state.error) toast.error(state.error);
    else if (state.mensaje) toast.success(state.mensaje);
    if (seguido && state.ok) {
      const t = setTimeout(() => router.push("/escanear?seguido=1"), 900);
      return () => clearTimeout(t);
    }
    router.refresh();
  }, [state, seguido, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="calificacion" value={estrellas || ""} />

      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium text-muted-foreground">¿Cómo llegó? (opcional)</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEstrellas(n === estrellas ? 0 : n)}
              aria-label={`${n} de 5: ${ESTRELLAS[n - 1]}`}
              aria-pressed={n <= estrellas}
              className="rounded-md p-1 active:scale-90"
            >
              <StarIcon className={cn("size-8", n <= estrellas ? "fill-gold text-gold" : "text-muted-foreground/40")} />
            </button>
          ))}
          {estrellas > 0 && <span className="ml-2 text-[13px] font-medium">{ESTRELLAS[estrellas - 1]}</span>}
        </div>
      </fieldset>

      {estrellas > 0 && estrellas < 4 && (
        <Textarea
          name="comentarioRecepcion"
          placeholder="¿Qué pasó? (caja dañada, faltaba algo, llegó tarde...)"
          maxLength={500}
          rows={2}
        />
      )}

      <div className="flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[13px] font-medium text-muted-foreground hover:border-primary hover:text-primary">
          <CameraIcon className="size-4" />
          {foto ? "Cambiar foto" : "Sacar foto del paquete"}
          <input
            type="file"
            name="fotos"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFoto((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return f ? URL.createObjectURL(f) : null;
              });
            }}
          />
        </label>
        {foto && (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
          <img src={foto} alt="Foto del paquete" className="size-14 rounded-md object-cover" />
        )}
      </div>

      <Button type="submit" size="lg" className="h-14 w-full text-base font-semibold" disabled={pending}>
        {pending ? <Loader2Icon className="size-5 animate-spin" /> : <PackageCheckIcon className="size-5" />}
        Confirmar entrega
      </Button>
      <p className="text-center text-[12px] text-muted-foreground">Confirmalo cuando tengas el producto en la mano.</p>
    </form>
  );
}

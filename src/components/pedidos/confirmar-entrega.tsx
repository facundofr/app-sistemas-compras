"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, CheckIcon, Loader2Icon, MinusIcon, PackageCheckIcon, PlusIcon, StarIcon } from "lucide-react";
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
export function ConfirmarEntrega({
  id,
  seguido,
  items,
}: {
  id: number;
  seguido?: boolean;
  /** Productos del pedido con lo ya recibido: si hay más de una unidad, se puede marcar qué llegó. */
  items: { id: number; producto: string; cantidad: number; cantidadRecibida: number }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(confirmarEntrega, {});
  const [estrellas, setEstrellas] = useState(0);
  const [foto, setFoto] = useState<string | null>(null);

  const pendientes = items
    .map((i) => ({ ...i, pendiente: Math.max(0, i.cantidad - i.cantidadRecibida) }))
    .filter((i) => i.pendiente > 0);
  // Una sola unidad pendiente: alcanza con un toque. Si hay más, se elige qué llegó (por defecto, todo).
  const conDetalle = pendientes.reduce((s, i) => s + i.pendiente, 0) > 1;
  const porDefecto = () => Object.fromEntries(pendientes.map((i) => [i.id, i.pendiente]));
  const [llegan, setLlegan] = useState<Record<number, number>>(porDefecto);
  // Después de registrar una parte llegan los datos nuevos: la selección vuelve a «todo lo que falta».
  const firma = items.map((i) => `${i.id}:${i.cantidadRecibida}`).join(",");
  const [firmaVista, setFirmaVista] = useState(firma);
  if (firma !== firmaVista) {
    setFirmaVista(firma);
    setLlegan(porDefecto());
  }
  const completa = pendientes.every((i) => (llegan[i.id] ?? 0) >= i.pendiente);
  const algo = pendientes.some((i) => (llegan[i.id] ?? 0) > 0);

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
      <input type="hidden" name="calificacion" value={completa ? estrellas || "" : ""} />

      {conDetalle && (
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-muted-foreground">¿Qué llegó?</legend>
          <ul className="divide-y rounded-lg border">
            {pendientes.map((i) => {
              const n = llegan[i.id] ?? 0;
              const fijar = (v: number) => setLlegan((l) => ({ ...l, [i.id]: Math.max(0, Math.min(i.pendiente, v)) }));
              return (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                  <input type="hidden" name={`llego_${i.id}`} value={n} />
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={n >= i.pendiente ? true : n > 0 ? "mixed" : false}
                    aria-label={`Llegó ${i.producto}`}
                    onClick={() => fijar(n >= i.pendiente ? 0 : i.pendiente)}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      n >= i.pendiente
                        ? "border-primary bg-primary text-primary-foreground"
                        : n > 0
                          ? "border-primary text-primary"
                          : "border-input",
                    )}
                  >
                    {n >= i.pendiente ? (
                      <CheckIcon className="size-4" />
                    ) : n > 0 ? (
                      <MinusIcon className="size-4" />
                    ) : null}
                  </button>
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                    <span className={cn("font-medium", n === 0 && "text-muted-foreground")}>{i.producto}</span>
                    {i.cantidadRecibida > 0 && (
                      <span className="block text-[11.5px] text-muted-foreground">
                        Ya llegaron {i.cantidadRecibida} de {i.cantidad}
                      </span>
                    )}
                  </span>
                  {i.pendiente > 1 ? (
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Una menos de ${i.producto}`}
                        onClick={() => fijar(n - 1)}
                      >
                        <MinusIcon />
                      </Button>
                      <span className="w-10 text-center font-mono text-[13px] font-semibold tabular" aria-live="polite">
                        {n}/{i.pendiente}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Una más de ${i.producto}`}
                        onClick={() => fijar(n + 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </span>
                  ) : (
                    <span className="font-mono text-[12.5px] text-muted-foreground tabular">1 u.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {completa && (
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
                <StarIcon
                  className={cn("size-8", n <= estrellas ? "fill-gold text-gold" : "text-muted-foreground/40")}
                />
              </button>
            ))}
            {estrellas > 0 && <span className="ml-2 text-[13px] font-medium">{ESTRELLAS[estrellas - 1]}</span>}
          </div>
        </fieldset>
      )}

      {completa && estrellas > 0 && estrellas < 4 && (
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

      <Button type="submit" size="lg" className="h-14 w-full text-base font-semibold" disabled={pending || !algo}>
        {pending ? <Loader2Icon className="size-5 animate-spin" /> : <PackageCheckIcon className="size-5" />}
        {completa ? "Confirmar entrega" : "Registrar lo que llegó"}
      </Button>
      <p className="text-center text-[12px] text-muted-foreground">
        {completa
          ? "Confirmalo cuando tengas el producto en la mano."
          : "El pedido sigue abierto hasta que llegue lo que falta."}
      </p>
    </form>
  );
}

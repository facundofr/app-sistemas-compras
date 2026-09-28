"use client";

import { useState, useTransition } from "react";
import { ArrowRightIcon, BanIcon, Loader2Icon, PackageCheckIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cambiarEstado, cancelarPedido, eliminarPedido, reactivarPedido } from "@/actions/pedidos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Estado } from "@/db/schema";

const PASO: Partial<Record<Estado, { destino: Estado; texto: string }>> = {
  Solicitado: { destino: "Cotizando", texto: "Empezar a cotizar" },
  Cotizando: { destino: "Comprando", texto: "Marcar como comprado" },
  Comprando: { destino: "Entregado", texto: "Confirmar entrega" },
};

export function AccionesPedido({
  id,
  estado,
  siguientePermitido,
  puedeCancelar,
  puedeReactivar,
  puedeEliminar,
}: {
  id: number;
  estado: Estado;
  siguientePermitido: boolean;
  puedeCancelar: boolean;
  puedeReactivar: boolean;
  puedeEliminar: boolean;
}) {
  const [pending, start] = useTransition();
  const [motivo, setMotivo] = useState("");
  const paso = PASO[estado];

  function correr(fn: () => Promise<{ ok?: boolean; error?: string; mensaje?: string } | void>) {
    start(async () => {
      const r = await fn();
      if (!r) return;
      if (r.error) toast.error(r.error);
      else if (r.mensaje) toast.success(r.mensaje);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {puedeReactivar && (
        <Button variant="outline" disabled={pending} onClick={() => correr(() => reactivarPedido(id))}>
          <RotateCcwIcon /> Reactivar
        </Button>
      )}

      {puedeCancelar && (
        <AlertDialog onOpenChange={(o) => !o && setMotivo("")}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={pending} className="text-destructive hover:text-destructive">
              <BanIcon /> Cancelar pedido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
              <AlertDialogDescription>
                Queda registrado como cancelado y deja de contar en el seguimiento. Se puede reactivar después.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="motivo" className="text-xs text-muted-foreground">
                Motivo (opcional)
              </Label>
              <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => correr(() => cancelarPedido(id, motivo))}
              >
                Cancelar pedido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {puedeEliminar && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" disabled={pending} aria-label="Eliminar pedido" className="text-destructive">
              <Trash2Icon />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar el pedido definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borran el pedido, su historial y todos sus archivos. No se puede deshacer. Si solo no se va a comprar,
                es mejor cancelarlo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => correr(() => eliminarPedido(id))}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {paso && siguientePermitido && (
        <Button disabled={pending} onClick={() => correr(() => cambiarEstado(id, paso.destino))}>
          {pending ? (
            <Loader2Icon className="animate-spin" />
          ) : paso.destino === "Entregado" ? (
            <PackageCheckIcon />
          ) : (
            <ArrowRightIcon />
          )}
          {paso.texto}
        </Button>
      )}
    </div>
  );
}

"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { DownloadIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { borrarAdjunto, subirReferencias, type FormState } from "@/actions/pedidos";
import { ArchivosInput } from "@/components/form/archivos-input";
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { conBase } from "@/lib/base-path";
import { fmtBytes, fmtDateTime } from "@/lib/format";

export type AdjuntoVista = {
  id: string;
  nombre: string;
  mime: string;
  tamano: number;
  subidoPor: string | null;
  createdAt: Date;
  borrable: boolean;
};

function BorrarAdjunto({ a }: { a: AdjuntoVista }) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Quitar ${a.nombre}`} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitar «{a.nombre}»?</AlertDialogTitle>
          <AlertDialogDescription>El archivo se borra del servidor y no se puede recuperar.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Conservar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              start(async () => {
                const r = await borrarAdjunto(a.id);
                if (r.error) toast.error(r.error);
                else toast.success(r.mensaje);
              })
            }
          >
            Quitar archivo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Imágenes como miniaturas (se amplían al hacer clic) y PDF como filas. */
export function Adjuntos({ items, vacio }: { items: AdjuntoVista[]; vacio: string }) {
  const [abierta, setAbierta] = useState<AdjuntoVista | null>(null);
  const imagenes = items.filter((a) => a.mime.startsWith("image/"));
  const otros = items.filter((a) => !a.mime.startsWith("image/"));

  if (!items.length) return vacio ? <p className="text-[13px] text-muted-foreground">{vacio}</p> : null;

  return (
    <div className="space-y-3">
      {imagenes.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {imagenes.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-lg border bg-muted/40">
              <button
                type="button"
                onClick={() => setAbierta(a)}
                className="block w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Ver ${a.nombre}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={conBase(`/api/archivos/${a.id}`)}
                  alt={a.nombre}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
              {a.borrable && (
                <div className="absolute top-1 right-1 rounded-md bg-background/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <BorrarAdjunto a={a} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {otros.length > 0 && (
        <ul className="space-y-1.5">
          {otros.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-[13px]">
              <FileTextIcon className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <a
                  href={conBase(`/api/archivos/${a.id}`)}
                  target="_blank"
                  rel="noopener"
                  className="block truncate font-medium hover:text-primary hover:underline"
                >
                  {a.nombre}
                </a>
                <div className="text-[11px] text-muted-foreground">
                  {fmtBytes(a.tamano)} · {a.subidoPor ?? "—"} · {fmtDateTime(a.createdAt)}
                </div>
              </div>
              <Button variant="ghost" size="icon-xs" asChild>
                <a href={conBase(`/api/archivos/${a.id}?descargar=1`)} aria-label={`Descargar ${a.nombre}`}>
                  <DownloadIcon />
                </a>
              </Button>
              {a.borrable && <BorrarAdjunto a={a} />}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!abierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="max-w-[min(92vw,960px)] gap-3 p-3 sm:max-w-[min(92vw,960px)]">
          {abierta && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={conBase(`/api/archivos/${abierta.id}`)}
                alt={abierta.nombre}
                className="max-h-[75vh] w-full rounded-md object-contain"
              />
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-sm">{abierta.nombre}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {fmtBytes(abierta.tamano)} · subido por {abierta.subidoPor ?? "—"} el {fmtDateTime(abierta.createdAt)}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="outline" size="sm" asChild>
                    <a href={conBase(`/api/archivos/${abierta.id}`)} target="_blank" rel="noopener">
                      <ExternalLinkIcon /> Abrir
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={conBase(`/api/archivos/${abierta.id}?descargar=1`)}>
                      <DownloadIcon /> Descargar
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SubirReferencias({ pedidoId }: { pedidoId: number }) {
  const [state, action, pending] = useActionState<FormState & { enviados?: number }, FormData>(
    async (prev, fd) => {
      const r = await subirReferencias(prev, fd);
      return { ...r, enviados: (prev.enviados ?? 0) + (r.ok ? 1 : 0) };
    },
    {},
  );
  useEffect(() => {
    if (!state.stamp && !state.error) return;
    if (state.ok) toast.success(state.mensaje);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      key={state.enviados ?? 0}
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="id" value={pedidoId} />
      <ArchivosInput id="archivos-ref" name="archivos" texto="Sumá presupuestos, fotos o archivos" />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          Subir archivos
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPT_ARCHIVOS,
  ARCHIVO_MAX_MB,
  ARCHIVOS_MAX_POR_ENVIO,
  MIME_PERMITIDOS,
  TIPOS_ARCHIVO_TEXTO,
} from "@/lib/constants";
import { fmtBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const EXTENSIONES = Object.values(MIME_PERMITIDOS);
const permitido = (f: File) =>
  f.type in MIME_PERMITIDOS || EXTENSIONES.some((ext) => f.name.toLowerCase().endsWith(ext));

type Item = { file: File; url: string | null };

/** Zona para arrastrar o elegir imágenes y PDF. Mantiene el <input type=file> sincronizado para el envío del form. */
export function ArchivosInput({
  name,
  id,
  texto = "Arrastrá archivos o hacé clic para elegirlos",
}: {
  name: string;
  id: string;
  texto?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [arrastrando, setArrastrando] = useState(false);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
    const dt = new DataTransfer();
    items.forEach((i) => dt.items.add(i.file));
    if (inputRef.current) inputRef.current.files = dt.files;
  }, [items]);

  useEffect(() => () => itemsRef.current.forEach((i) => i.url && URL.revokeObjectURL(i.url)), []);

  function quitar(i: number) {
    const it = items[i];
    if (it?.url) URL.revokeObjectURL(it.url);
    setItems((prev) => prev.filter((_, j) => j !== i));
  }

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const nuevos: Item[] = [];
    for (const f of Array.from(lista)) {
      if (!permitido(f)) {
        toast.error(`«${f.name}» no es una imagen, un PDF ni un Excel o Word.`);
        continue;
      }
      if (f.size > ARCHIVO_MAX_MB * 1024 * 1024) {
        toast.error(`«${f.name}» pesa más de ${ARCHIVO_MAX_MB} MB.`);
        continue;
      }
      nuevos.push({ file: f, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    }
    setItems((prev) => {
      const todos = [...prev, ...nuevos];
      if (todos.length > ARCHIVOS_MAX_POR_ENVIO) {
        toast.error(`Podés adjuntar hasta ${ARCHIVOS_MAX_POR_ENVIO} archivos por vez.`);
        return todos.slice(0, ARCHIVOS_MAX_POR_ENVIO);
      }
      return todos;
    });
  }

  return (
    <div className="space-y-2.5">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-input px-4 py-5 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary hover:bg-accent/60 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          arrastrando && "border-primary bg-accent/60",
        )}
      >
        <UploadIcon className="size-5 text-primary" />
        <span>{texto}</span>
        <span className="text-[11px]">
          {TIPOS_ARCHIVO_TEXTO} · hasta {ARCHIVOS_MAX_POR_ENVIO} archivos de {ARCHIVO_MAX_MB} MB
        </span>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          multiple
          accept={ACCEPT_ARCHIVOS}
          className="sr-only"
          onChange={(e) => {
            const lista = e.target.files;
            // Se copian antes de que el efecto reemplace input.files con la lista acumulada.
            const copia = lista ? Array.from(lista) : [];
            const dt = new DataTransfer();
            copia.forEach((f) => dt.items.add(f));
            agregar(dt.files);
          }}
        />
      </label>

      {items.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
          {items.map((it, i) => (
            <li key={i} className="group relative overflow-hidden rounded-lg border bg-muted/40">
              {it.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt={it.file.name} className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center">
                  <FileTextIcon className="size-7 text-muted-foreground" />
                </div>
              )}
              <div className="truncate px-2 py-1 text-[11px]" title={it.file.name}>
                {it.file.name}
                <span className="ml-1 text-muted-foreground">{fmtBytes(it.file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => quitar(i)}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-destructive hover:text-white"
                aria-label={`Quitar ${it.file.name}`}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

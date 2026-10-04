"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { conBase } from "@/lib/base-path";

const editando = () => {
  const el = document.activeElement;
  return !!el?.closest("form") && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

/**
 * Recarga los datos cuando el servidor avisa que algo cambió (/api/eventos), en vez de cada 30 s.
 * Si la persona está escribiendo en un formulario, espera a que salga del campo para no molestarla.
 * Como respaldo, recarga al volver a la pestaña y cada 5 minutos.
 */
export function EnVivo() {
  const router = useRouter();

  useEffect(() => {
    let pendiente = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refrescar = () => {
      if (document.visibilityState !== "visible" || editando()) {
        pendiente = true;
        return;
      }
      pendiente = false;
      router.refresh();
    };
    // Varios cambios seguidos (por ejemplo, datos + adjuntos) se juntan en una sola recarga.
    const pronto = () => {
      clearTimeout(timer);
      timer = setTimeout(refrescar, 400);
    };

    const fuente = new EventSource(conBase("/api/eventos"));
    fuente.addEventListener("pedidos", pronto);
    fuente.addEventListener("notificacion", pronto);

    const alSalirDeCampo = () => pendiente && setTimeout(() => !editando() && refrescar(), 50);
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("focusout", alSalirDeCampo);
    document.addEventListener("visibilitychange", alVolver);
    const respaldo = setInterval(refrescar, 5 * 60_000);

    return () => {
      fuente.close();
      clearTimeout(timer);
      clearInterval(respaldo);
      document.removeEventListener("focusout", alSalirDeCampo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Vuelve a pedir los datos al servidor cada tanto, para ver lo que carga el resto del equipo. */
export function AutoRefresh({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    const alVolver = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [router, segundos]);
  return null;
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOffIcon, BellRingIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { borrarSuscripcion, guardarSuscripcion } from "@/actions/notificaciones";
import { Button } from "@/components/ui/button";
import { BASE_PATH, conBase } from "@/lib/base-path";

type Estado = "cargando" | "no-soportado" | "bloqueado" | "inactivo" | "activo";

function claveBytes(base64: string) {
  const b64 = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registro() {
  return navigator.serviceWorker.register(conBase("/sw.js"), { scope: `${BASE_PATH}/` });
}

/**
 * Activa los avisos push en este dispositivo. En iPhone solo funciona con la app instalada
 * («Agregar a pantalla de inicio»), es una limitación de Apple.
 */
export function ActivarPush({ clavePublica }: { clavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setEstado("no-soportado");
      }
      if (Notification.permission === "denied") return setEstado("bloqueado");
      const sub = await (await registro()).pushManager.getSubscription();
      setEstado(sub ? "activo" : "inactivo");
    })().catch(() => setEstado("no-soportado"));
  }, []);

  const activar = () =>
    start(async () => {
      try {
        if ((await Notification.requestPermission()) !== "granted") return setEstado("bloqueado");
        const reg = await registro();
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(clavePublica) });
        const r = await guardarSuscripcion(sub.toJSON());
        if (r.error) throw new Error(r.error);
        setEstado("activo");
        toast.success("Listo: vas a recibir los avisos en este dispositivo.");
      } catch {
        toast.error("No se pudieron activar los avisos en este dispositivo.");
      }
    });

  const desactivar = () =>
    start(async () => {
      const sub = await (await registro()).pushManager.getSubscription();
      if (sub) {
        await borrarSuscripcion(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("inactivo");
    });

  if (estado === "cargando") return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0 text-[13px]">
        <div className="font-semibold">Avisos en este dispositivo</div>
        <div className="text-muted-foreground">
          {estado === "activo" && "Activados: te llegan aunque la app esté cerrada."}
          {estado === "inactivo" && "Recibí un aviso en el celular cuando cambie uno de tus pedidos."}
          {estado === "bloqueado" && "Están bloqueados para este sitio. Habilitalos en la configuración del navegador."}
          {estado === "no-soportado" &&
            "Este navegador no los admite. En iPhone, primero agregá la app a la pantalla de inicio y abrila desde ahí."}
        </div>
      </div>
      {estado === "inactivo" && (
        <Button size="sm" onClick={activar} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <BellRingIcon />} Activar
        </Button>
      )}
      {estado === "activo" && (
        <Button size="sm" variant="outline" onClick={desactivar} disabled={pending}>
          <BellOffIcon /> Desactivar
        </Button>
      )}
    </div>
  );
}

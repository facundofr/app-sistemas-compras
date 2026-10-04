import type { Metadata } from "next";
import {
  AlertTriangleIcon,
  BanIcon,
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  CircleCheckBigIcon,
  PackageOpenIcon,
  PlusIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react";
import { marcarTodasLeidas } from "@/actions/notificaciones";
import { ActivarPush } from "@/components/activar-push";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { fmtDateTime } from "@/lib/format";
import { listarNotificaciones } from "@/lib/notificaciones";
import { pushConfigurado } from "@/lib/push";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificaciones" };

const ICONO: Record<string, React.ComponentType<{ className?: string }>> = {
  nuevo: PlusIcon,
  estado_comprando: ShoppingCartIcon,
  estado_entregado: CircleCheckBigIcon,
  fecha_estimada: CalendarClockIcon,
  trabado: AlertTriangleIcon,
  atrasado: AlertTriangleIcon,
  cancelado: BanIcon,
  recepcion_parcial: PackageOpenIcon,
  ml_envio: TruckIcon,
  ml_entregado: CircleCheckBigIcon,
};

export default async function NotificacionesPage() {
  const usuario = await requireUsuario();
  const lista = await listarNotificaciones(usuario.id);
  const noLeidas = lista.filter((n) => !n.leidaEn).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notificaciones" description="Lo que pasó con tus pedidos y lo que necesita tu atención.">
        {noLeidas > 0 && (
          <form action={marcarTodasLeidas}>
            <Button variant="outline" size="sm">
              <CheckCheckIcon /> Marcar todas como leídas
            </Button>
          </form>
        )}
      </PageHeader>

      {pushConfigurado() && (
        <div className="mb-4">
          <ActivarPush clavePublica={process.env.VAPID_PUBLIC_KEY!} />
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
            <BellIcon className="size-8 opacity-60" />
            Todavía no tenés notificaciones.
          </div>
        ) : (
          <ul className="divide-y">
            {lista.map((n) => {
              const Icono = ICONO[n.tipo] ?? BellIcon;
              const alerta = n.tipo === "trabado" || n.tipo === "atrasado";
              return (
                <li key={n.id}>
                  {/* <a> y no <Link>: abrir marca como leída, y eso no se tiene que disparar con el prefetch. */}
                  <a
                    href={conBase(`/notificaciones/${n.id}`)}
                    className={cn("flex gap-3 px-4 py-3.5 hover:bg-muted/50 active:bg-muted/70", !n.leidaEn && "bg-accent/40")}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        alerta ? "bg-rust-soft text-destructive" : "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icono className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[13.5px] leading-snug", !n.leidaEn ? "font-semibold" : "font-medium")}>
                        {n.titulo}
                      </span>
                      {n.cuerpo && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{n.cuerpo}</span>}
                      <span className="mt-1 block text-[11.5px] text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
                    </span>
                    {!n.leidaEn && <span aria-label="Sin leer" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

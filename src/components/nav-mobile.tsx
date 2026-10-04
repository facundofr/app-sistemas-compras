"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon, HouseIcon, MenuIcon, PackageOpenIcon, PlusIcon, QrCodeIcon } from "lucide-react";
import type { Rol } from "@/db/schema";
import { puedeCargarPedidos } from "@/lib/permisos";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number };

/**
 * Barra inferior para celulares (en escritorio se usa la barra lateral): dos accesos a cada lado
 * y en el medio el botón grande para escanear la etiqueta QR de un paquete. «Más» abre la barra lateral completa.
 */
export function NavMobile({ alertas, rol }: { alertas: number; rol: Rol }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const izquierda: Item[] = [
    { href: "/inicio", label: "Inicio", icon: HouseIcon },
    { href: "/pedidos", label: "Pedidos", icon: ClipboardListIcon, badge: alertas },
  ];
  // Recepción no carga pedidos: en su lugar, lo que está por llegar.
  const derecha: Item[] = [
    puedeCargarPedidos(rol)
      ? { href: "/pedidos/nuevo", label: "Nuevo", icon: PlusIcon }
      : { href: "/pedidos?estado=Comprando", label: "Por recibir", icon: PackageOpenIcon },
  ];

  const activo = (href: string) => {
    if (href.includes("?")) return false;
    if (href === "/pedidos") {
      return pathname === "/pedidos" || (/^\/pedidos\/\d+/.test(pathname) && !pathname.endsWith("/recibir"));
    }
    return pathname === href || pathname.startsWith(href + "/");
  };
  const escaneando = pathname === "/escanear" || pathname.endsWith("/recibir");

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgb(18_24_31/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden print:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-stretch">
        {izquierda.map((it) => (
          <Boton key={it.href} item={it} activo={activo(it.href)} />
        ))}

        <div className="relative flex justify-center">
          <Link
            href="/escanear"
            aria-current={escaneando ? "page" : undefined}
            className="group absolute -top-6 flex flex-col items-center gap-1 focus-visible:outline-none"
          >
            <span
              className={cn(
                "flex size-[62px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--primary)_60%,transparent)] ring-[5px] ring-card transition-transform group-active:scale-95 group-focus-visible:ring-ring",
                escaneando && "bg-gold text-[#12181f]",
              )}
            >
              <QrCodeIcon className="size-7" />
            </span>
            <span className={cn("text-[11px] font-bold tracking-wide", escaneando ? "text-gold-foreground" : "text-primary")}>QR</span>
          </Link>
        </div>

        {derecha.map((it) => (
          <Boton key={it.href} item={it} activo={activo(it.href)} />
        ))}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground active:bg-muted/60"
        >
          <MenuIcon className="size-[22px]" />
          Más
        </button>
      </div>
    </nav>
  );
}

function Boton({ item, activo }: { item: Item; activo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground active:bg-muted/60",
        activo && "font-semibold text-primary",
      )}
    >
      <span className="relative">
        <item.icon className="size-[22px]" />
        {!!item.badge && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] leading-[18px] font-bold text-white ring-2 ring-card">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </span>
      {item.label}
      {activo && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" />}
    </Link>
  );
}

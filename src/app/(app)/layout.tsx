import { cookies } from "next/headers";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { EnVivo } from "@/components/en-vivo";
import { NavMobile } from "@/components/nav-mobile";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUsuario } from "@/lib/auth";
import { contarNoLeidas } from "@/lib/notificaciones";
import { getStats } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  const [stats, store, noLeidas] = await Promise.all([getStats(), cookies(), contarNoLeidas(usuario.id)]);
  const abierto = store.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={abierto}>
      <AppSidebar usuario={usuario} alertas={stats.alertas} noLeidas={noLeidas} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6 print:hidden">
          {/* En el celular la barra lateral se abre desde «Más» del menú inferior. */}
          <SidebarTrigger className="-ml-1.5 max-md:hidden" />
          <Separator orientation="vertical" className="mr-1 self-center data-[orientation=vertical]:h-4 max-md:hidden" />
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-gold shadow-[0_0_0_3px_color-mix(in_oklab,var(--gold)_28%,transparent)] md:hidden"
          />
          <span className="truncate font-heading text-sm font-bold md:hidden">Pedidos Sistemas</span>
          <span className="truncate text-xs text-muted-foreground max-md:hidden">Grupo Cober · Pedidos de Sistemas</span>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/notificaciones"
              className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
            >
              <BellIcon className="size-[18px]" />
              {noLeidas > 0 && (
                <span className="absolute top-1 right-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-bold text-white">
                  {noLeidas > 99 ? "99+" : noLeidas}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-16">
          {children}
        </main>
      </SidebarInset>
      <NavMobile alertas={stats.alertas} rol={usuario.rol} />
      <EnVivo />
    </SidebarProvider>
  );
}

import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUsuario } from "@/lib/auth";
import { getStats } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  const [stats, store] = await Promise.all([getStats(), cookies()]);
  const abierto = store.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={abierto}>
      <AppSidebar usuario={usuario} alertas={stats.alertas} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
          <SidebarTrigger className="-ml-1.5" />
          <Separator orientation="vertical" className="mr-1 self-center data-[orientation=vertical]:h-4" />
          <span className="truncate text-xs text-muted-foreground">Grupo Cober · Pedidos de Sistemas</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-16 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

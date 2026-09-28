import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUsuarioActual } from "@/lib/auth";
import { ESTADO_INFO, ESTADOS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getUsuarioActual()) redirect("/");
  const { next } = await props.searchParams;

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Brand />
        <div className="max-w-md">
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-white">
            Cada compra de Sistemas, de la solicitud a la factura.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/80">
            Sistemas carga el pedido, Compras lo cotiza y lo compra, y todos ven en qué etapa está.
          </p>
          <ol className="mt-10 space-y-0">
            {ESTADOS.map((e, i) => (
              <li key={e} className="relative flex gap-4 pb-6 last:pb-0">
                {i < ESTADOS.length - 1 && (
                  <span aria-hidden className="absolute top-4 left-[7px] h-full w-0.5 bg-sidebar-border" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-0.5 size-4 shrink-0 rounded-full border-2",
                    e === "Entregado" ? "border-gold bg-gold" : "border-sidebar-primary bg-sidebar-primary",
                    i === 1 && "bg-sidebar",
                    i === 2 && "bg-sidebar",
                  )}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {e}
                    <span className="ml-2 text-[11px] font-medium tracking-wide text-sidebar-foreground/60 uppercase">
                      {ESTADO_INFO[e].equipo === "compras" ? "Compras" : "Sistemas"}
                    </span>
                  </div>
                  <div className="text-[13px] text-sidebar-foreground/70">{ESTADO_INFO[e].descripcion}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Grupo Cober · Uso interno</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 rounded-xl bg-sidebar px-4 py-3 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ingresar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usá el email y la contraseña que te dio el administrador.
          </p>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </main>
    </div>
  );
}

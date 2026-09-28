"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  KeyRoundIcon,
  ListChecksIcon,
  LogOutIcon,
  PlusIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";
import { logout } from "@/actions/auth";
import type { UsuarioSesion } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { gestionaCompras } from "@/lib/permisos";
import { Brand } from "@/components/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Item = { href: string; label: string; icon: React.ComponentType; badge?: number; exact?: boolean };

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AppSidebar({ usuario, alertas }: { usuario: UsuarioSesion; alertas: number }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const compras = gestionaCompras(usuario.rol);

  const grupos: { label: string; items: Item[] }[] = [
    {
      label: "Pedidos",
      items: [
        { href: "/pedidos/nuevo", label: "Nuevo pedido", icon: PlusIcon },
        {
          href: "/pedidos",
          label: compras ? "Pedidos" : "Estado de pedidos",
          icon: ClipboardListIcon,
          badge: alertas,
          exact: true,
        },
        { href: "/compras", label: "Compras efectuadas", icon: ReceiptTextIcon },
        ...(compras ? [{ href: "/reportes", label: "Reportes", icon: ChartColumnIcon }] : []),
      ],
    },
    ...(usuario.rol === "admin"
      ? [
          {
            label: "Administración",
            items: [
              { href: "/admin/usuarios", label: "Usuarios", icon: UsersIcon },
              { href: "/admin/listas", label: "Listas de opciones", icon: ListChecksIcon },
            ],
          },
        ]
      : []),
  ];

  const activo = (it: Item) =>
    it.exact
      ? pathname === it.href || (/^\/pedidos\/\d+/.test(pathname) && it.href === "/pedidos")
      : pathname === it.href || pathname.startsWith(it.href + "/");

  return (
    <Sidebar>
      <SidebarHeader className="gap-4 px-4 pt-5 pb-2">
        <Brand />
        <div className="flex rounded-full border border-sidebar-border bg-sidebar-accent p-[3px]">
          <span className="flex-1 rounded-full bg-sidebar-primary px-3 py-1.5 text-center text-[12px] font-semibold text-sidebar-primary-foreground">
            {ROLES[usuario.rol].nombre}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {grupos.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={activo(it)}
                      className="h-9 data-active:text-white data-active:shadow-[inset_3px_0_0_var(--gold)]"
                    >
                      <Link href={it.href} onClick={() => setOpenMobile(false)}>
                        <it.icon />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {!!it.badge && (
                      <SidebarMenuBadge className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white">
                        {it.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary/25 text-xs font-semibold text-white">
                      {iniciales(usuario.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-white">{usuario.nombre}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">{usuario.email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{usuario.nombre}</div>
                  <div className="text-xs text-muted-foreground">{ROLES[usuario.rol].nombre}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/perfil" onClick={() => setOpenMobile(false)}>
                    <KeyRoundIcon /> Cambiar contraseña
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logout}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOutIcon /> Cerrar sesión
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pt-1 text-[11px] leading-snug text-sidebar-foreground/45">
          Los datos se comparten con todo el equipo en tiempo real.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

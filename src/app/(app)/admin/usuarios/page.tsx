import type { Metadata } from "next";
import { UsuarioDialog } from "@/components/admin/usuario-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRol } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import { listarUsuarios } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const yo = await requireRol("admin");
  const usuarios = await listarUsuarios();

  return (
    <>
      <PageHeader title="Usuarios" description="Quién puede ingresar y qué puede hacer cada uno.">
        <UsuarioDialog />
      </PageHeader>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[13px] font-semibold">{r.nombre}</div>
            <div className="text-xs text-muted-foreground">{r.descripcion}</div>
          </div>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último ingreso</TableHead>
              <TableHead className="text-right">Pedidos cargados</TableHead>
              <TableHead className="w-12 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id} className={cn(!u.activo && "text-muted-foreground")}>
                <TableCell className="pl-5">
                  <div className="font-medium">
                    {u.nombre}
                    {u.id === yo.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(vos)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.rol === "admin" ? "default" : "secondary"}>{ROLES[u.rol].nombre}</Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                    <span className={cn("size-1.5 rounded-full", u.activo ? "bg-primary" : "bg-muted-foreground/50")} />
                    {u.activo ? "Activo" : "Desactivado"}
                  </span>
                </TableCell>
                <TableCell className="text-[12.5px]">{u.ultimoIngreso ? fmtDateTime(u.ultimoIngreso) : "Nunca"}</TableCell>
                <TableCell className="text-right tabular">{u.pedidos}</TableCell>
                <TableCell className="pr-5 text-right">
                  <UsuarioDialog usuario={{ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

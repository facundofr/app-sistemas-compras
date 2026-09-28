import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { CambiarPasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function PerfilPage() {
  const u = await requireUsuario();
  return (
    <>
      <PageHeader title="Mi cuenta" description={`${u.nombre} · ${u.email} · ${ROLES[u.rol].nombre}`} />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-[15.5px] font-bold">Cambiar contraseña</CardTitle>
          <CardDescription>Usá al menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <CambiarPasswordForm />
        </CardContent>
      </Card>
    </>
  );
}

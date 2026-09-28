import type { Metadata } from "next";
import { ListaOpciones } from "@/components/admin/lista-opciones";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Lista } from "@/db/schema";
import { requireRol } from "@/lib/auth";
import { LISTAS } from "@/lib/constants";
import { getTodasLasOpciones } from "@/lib/queries";

export const metadata: Metadata = { title: "Listas de opciones" };

export default async function ListasPage() {
  await requireRol("admin");
  const todas = await getTodasLasOpciones();

  return (
    <>
      <PageHeader
        title="Listas de opciones"
        description="Las opciones de los desplegables. Si apagás una, deja de ofrecerse pero los pedidos que ya la usan la conservan."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {(Object.keys(LISTAS) as Lista[]).map((l) => (
          <Card key={l}>
            <CardHeader>
              <CardTitle className="text-[15.5px] font-bold">{LISTAS[l].nombre}</CardTitle>
              <CardDescription>{LISTAS[l].descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              <ListaOpciones
                lista={l}
                singular={LISTAS[l].singular}
                opciones={todas.filter((o) => o.lista === l).map(({ id, valor, activo }) => ({ id, valor, activo }))}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

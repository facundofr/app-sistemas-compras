import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";
import { gestionaCompras } from "@/lib/permisos";

export default async function Home() {
  const usuario = await requireUsuario();
  redirect(gestionaCompras(usuario.rol) ? "/pedidos" : "/pedidos/nuevo");
}

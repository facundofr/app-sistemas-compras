import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";

export default async function Home() {
  await requireUsuario();
  redirect("/inicio");
}

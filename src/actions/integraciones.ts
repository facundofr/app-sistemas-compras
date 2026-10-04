"use server";

import { revalidatePath } from "next/cache";
import { requireRol } from "@/lib/auth";
import { enviarEmail, emailConfigurado } from "@/lib/email";
import { desconectar } from "@/lib/mercadolibre";
import { revisarAtrasos, sincronizarMercadoLibre } from "@/lib/trabajos";

export type Resultado = { ok?: boolean; error?: string; mensaje?: string };

export async function desconectarMercadoLibre(): Promise<Resultado> {
  await requireRol("admin");
  await desconectar();
  revalidatePath("/admin/integraciones");
  return { ok: true, mensaje: "Cuenta de Mercado Libre desconectada." };
}

export async function sincronizarAhora(): Promise<Resultado> {
  await requireRol("admin");
  try {
    const r = await sincronizarMercadoLibre();
    if ("error" in r && r.error) return { error: r.error };
    return { ok: true, mensaje: `Listo: se revisaron ${r.revisados} pedido(s) de Mercado Libre.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo sincronizar." };
  }
}

export async function revisarAtrasosAhora(): Promise<Resultado> {
  await requireRol("admin");
  const r = await revisarAtrasos();
  return { ok: true, mensaje: `Revisado: ${r.trabados} trabado(s) y ${r.atrasados} atrasado(s). Se avisó lo que no se había avisado.` };
}

export async function emailDePrueba(): Promise<Resultado> {
  const usuario = await requireRol("admin");
  if (!emailConfigurado()) return { error: "Falta configurar SMTP_HOST en el .env." };
  try {
    await enviarEmail({ para: usuario.email, asunto: "Prueba de Pedidos Sistemas", texto: "Si te llegó este email, los avisos por correo funcionan." });
    return { ok: true, mensaje: `Email enviado a ${usuario.email}.` };
  } catch (err) {
    return { error: `No se pudo enviar: ${err instanceof Error ? err.message : err}` };
  }
}

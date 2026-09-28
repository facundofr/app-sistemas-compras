"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import {
  cerrarSesion,
  claveLimite,
  crearSesion,
  limiteExcedido,
  limpiarFallos,
  registrarFallo,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const clave = await claveLimite(parsed.data.email);
  if (limiteExcedido(clave)) {
    return { error: "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.", email };
  }

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, parsed.data.email)).limit(1);
  const ok = usuario ? await verifyPassword(parsed.data.password, usuario.passwordHash) : false;
  if (!usuario || !ok) {
    registrarFallo(clave);
    return { error: "El email o la contraseña no coinciden.", email };
  }
  if (!usuario.activo) {
    return { error: "Tu usuario está desactivado. Pedile al administrador que lo habilite.", email };
  }

  limpiarFallos(clave);
  await crearSesion(usuario.id);
  await db.update(usuarios).set({ ultimoIngreso: new Date() }).where(eq(usuarios.id, usuario.id));

  const destino = String(formData.get("next") ?? "");
  redirect(destino.startsWith("/") && !destino.startsWith("//") ? destino : "/");
}

export async function logout() {
  await cerrarSesion();
  redirect("/login");
}

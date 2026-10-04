"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { rolEnum, usuarios } from "@/db/schema";
import { cerrarSesionesDeUsuario, requireRol, requireUsuario } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { FormState } from "./pedidos";

const password = z
  .string()
  .min(8, "Mínimo 8 caracteres.")
  .max(200, "Demasiado larga.");

const base = z.object({
  nombre: z.string().trim().min(2, "Ingresá el nombre.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido."),
  rol: z.enum(rolEnum.enumValues, "Elegí un rol."),
});

function errores(error: z.ZodError): FormState {
  const e: Record<string, string> = {};
  for (const i of error.issues) e[String(i.path[0] ?? "form")] ??= i.message;
  return { error: "Revisá los campos marcados.", errores: e };
}

async function emailTomado(email: string, exceptoId?: number) {
  const [row] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(exceptoId ? and(eq(usuarios.email, email), ne(usuarios.id, exceptoId)) : eq(usuarios.email, email))
    .limit(1);
  return !!row;
}

async function adminsActivos() {
  const [{ n }] = await db
    .select({ n: count() })
    .from(usuarios)
    .where(and(eq(usuarios.rol, "admin"), eq(usuarios.activo, true)));
  return n;
}

export async function crearUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRol("admin");
  const parsed = base.extend({ password }).safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    rol: formData.get("rol"),
    password: formData.get("password"),
  });
  if (!parsed.success) return errores(parsed.error);
  if (await emailTomado(parsed.data.email)) {
    return { error: "Ya existe un usuario con ese email.", errores: { email: "Ya está en uso." } };
  }
  const { password: pw, ...datos } = parsed.data;
  await db.insert(usuarios).values({ ...datos, passwordHash: await hashPassword(pw) });
  revalidatePath("/admin/usuarios");
  return { ok: true, stamp: Date.now(), mensaje: `Usuario ${datos.email} creado.` };
}

export async function actualizarUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  const yo = await requireRol("admin");
  const id = Number(formData.get("id"));
  const parsed = base
    .extend({ activo: z.boolean(), password: password.optional().or(z.literal("")) })
    .safeParse({
      nombre: formData.get("nombre"),
      email: formData.get("email"),
      rol: formData.get("rol"),
      activo: formData.get("activo") === "on",
      password: formData.get("password") ?? "",
    });
  if (!parsed.success) return errores(parsed.error);
  const [actual] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  if (!actual) return { error: "El usuario no existe." };
  if (await emailTomado(parsed.data.email, id)) {
    return { error: "Ya existe un usuario con ese email.", errores: { email: "Ya está en uso." } };
  }

  const dejaDeSerAdmin = actual.rol === "admin" && actual.activo && (parsed.data.rol !== "admin" || !parsed.data.activo);
  if (dejaDeSerAdmin && (await adminsActivos()) <= 1) {
    return { error: "Tiene que quedar al menos un administrador activo." };
  }
  if (id === yo.id && !parsed.data.activo) return { error: "No podés desactivar tu propio usuario." };

  const { password: pw, ...datos } = parsed.data;
  await db
    .update(usuarios)
    .set({ ...datos, ...(pw ? { passwordHash: await hashPassword(pw) } : {}) })
    .where(eq(usuarios.id, id));
  // Si se desactivó o se le cambió la contraseña, se cierran sus sesiones abiertas.
  if (!datos.activo || (pw && id !== yo.id)) await cerrarSesionesDeUsuario(id);
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now(), mensaje: "Usuario actualizado." };
}

export async function cambiarMiPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const yo = await requireUsuario();
  const parsed = z
    .object({ actual: z.string().min(1, "Ingresá tu contraseña actual."), nueva: password, repetir: z.string() })
    .refine((d) => d.nueva === d.repetir, { message: "Las contraseñas no coinciden.", path: ["repetir"] })
    .safeParse({
      actual: formData.get("actual"),
      nueva: formData.get("nueva"),
      repetir: formData.get("repetir"),
    });
  if (!parsed.success) return errores(parsed.error);
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, yo.id)).limit(1);
  if (!u || !(await verifyPassword(parsed.data.actual, u.passwordHash))) {
    return { error: "La contraseña actual no es correcta.", errores: { actual: "No coincide." } };
  }
  await db.update(usuarios).set({ passwordHash: await hashPassword(parsed.data.nueva) }).where(eq(usuarios.id, yo.id));
  return { ok: true, stamp: Date.now(), mensaje: "Contraseña actualizada." };
}

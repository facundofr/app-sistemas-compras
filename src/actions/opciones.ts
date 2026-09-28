"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listaEnum, opciones } from "@/db/schema";
import { requireRol } from "@/lib/auth";
import type { FormState } from "./pedidos";

const lista = z.enum(listaEnum.enumValues);

export async function agregarOpcion(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRol("admin");
  const parsed = z
    .object({ lista, valor: z.string().trim().min(1, "Escribí un valor.").max(120, "Máximo 120 caracteres.") })
    .safeParse({ lista: formData.get("lista"), valor: formData.get("valor") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { lista: l, valor } = parsed.data;
  const [existe] = await db
    .select()
    .from(opciones)
    .where(and(eq(opciones.lista, l), eq(opciones.valor, valor)))
    .limit(1);
  if (existe) {
    if (existe.activo) return { error: `«${valor}» ya está en la lista.` };
    await db.update(opciones).set({ activo: true }).where(eq(opciones.id, existe.id));
  } else {
    const [{ m }] = await db.select({ m: max(opciones.orden) }).from(opciones).where(eq(opciones.lista, l));
    await db.insert(opciones).values({ lista: l, valor, orden: (m ?? -1) + 1 });
  }
  revalidatePath("/", "layout");
  return { ok: true, stamp: Date.now(), mensaje: `«${valor}» agregado.` };
}

export async function alternarOpcion(id: number, activo: boolean): Promise<FormState> {
  await requireRol("admin");
  await db.update(opciones).set({ activo }).where(eq(opciones.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moverOpcion(id: number, direccion: -1 | 1): Promise<FormState> {
  await requireRol("admin");
  const [actual] = await db.select().from(opciones).where(eq(opciones.id, id)).limit(1);
  if (!actual) return { error: "La opción no existe." };
  const hermanas = await db
    .select()
    .from(opciones)
    .where(eq(opciones.lista, actual.lista))
    .orderBy(opciones.orden, opciones.valor);
  const i = hermanas.findIndex((o) => o.id === id);
  const j = i + direccion;
  if (j < 0 || j >= hermanas.length) return { ok: true };
  [hermanas[i], hermanas[j]] = [hermanas[j], hermanas[i]];
  await db.transaction(async (tx) => {
    for (const [orden, o] of hermanas.entries()) {
      await tx.update(opciones).set({ orden }).where(eq(opciones.id, o.id));
    }
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

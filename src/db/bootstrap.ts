import path from "node:path";
import { randomBytes } from "node:crypto";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { OPCIONES_INICIALES } from "@/lib/constants";
import { hashPassword } from "@/lib/password";
import * as schema from "./schema";

async function esperarBase(pool: Pool) {
  for (let intento = 1; ; intento++) {
    try {
      await pool.query("select 1");
      return;
    } catch (err) {
      if (intento >= 30) throw err;
      console.log(`[bootstrap] Esperando la base de datos (${intento}/30)...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Aplica migraciones pendientes y crea el admin y las listas iniciales si la base está vacía. */
export async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    console.warn("[bootstrap] DATABASE_URL no está definida; se omite la inicialización.");
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await esperarBase(pool);
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

    const [{ n: usuarios }] = await db.select({ n: count() }).from(schema.usuarios);
    if (usuarios === 0) {
      const email = (process.env.ADMIN_EMAIL ?? "admin@pedidos.local").trim().toLowerCase();
      let password = process.env.ADMIN_PASSWORD;
      if (!password) {
        password = randomBytes(9).toString("base64url");
        console.log(`[bootstrap] ADMIN_PASSWORD no definida. Contraseña generada: ${password}`);
      }
      await db.insert(schema.usuarios).values({
        nombre: process.env.ADMIN_NOMBRE ?? "Administrador",
        email,
        passwordHash: await hashPassword(password),
        rol: "admin",
      });
      console.log(`[bootstrap] Usuario administrador creado: ${email}`);
    }

    // Cada lista vacía arranca con sus opciones iniciales (también las listas que se suman en versiones nuevas).
    const conDatos = await db
      .select({ lista: schema.opciones.lista, n: count() })
      .from(schema.opciones)
      .groupBy(schema.opciones.lista);
    const llenas = new Set(conDatos.map((r) => r.lista));
    for (const [lista, valores] of Object.entries(OPCIONES_INICIALES) as [schema.Lista, string[]][]) {
      if (llenas.has(lista) || !valores.length) continue;
      await db.insert(schema.opciones).values(valores.map((valor, orden) => ({ lista, valor, orden })));
      console.log(`[bootstrap] Lista «${lista}» cargada con ${valores.length} opciones.`);
    }
  } finally {
    await pool.end();
  }
}

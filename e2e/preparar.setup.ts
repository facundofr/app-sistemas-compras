import { test as setup } from "@playwright/test";
import pg from "pg";
import { hashPassword } from "../src/lib/password";
import { USUARIOS } from "./util";

/** Deja la base de los tests en un estado conocido: sin pedidos y con un usuario por rol. */
setup("preparar la base", async () => {
  const db = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgres://pedidos:pedidos@localhost:5433/pedidos_e2e" });
  await db.connect();
  try {
    await db.query("truncate pedidos, equipos, notificaciones, intentos_login, suscripciones_push restart identity cascade");
    for (const u of Object.values(USUARIOS)) {
      await db.query(
        `insert into usuarios (nombre, email, password_hash, rol) values ($1, $2, $3, $4)
         on conflict (email) do update set password_hash = excluded.password_hash, rol = excluded.rol, activo = true`,
        [u.nombre, u.email, await hashPassword(u.password), u.rol],
      );
    }
  } finally {
    await db.end();
  }
});

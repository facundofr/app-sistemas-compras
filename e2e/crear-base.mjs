// Crea la base de los tests de punta a punta si no existe (se corre antes de `playwright test`).
import pg from "pg";

const url = new URL(process.env.E2E_DATABASE_URL ?? "postgres://pedidos:pedidos@localhost:5433/pedidos_e2e");
const nombre = url.pathname.slice(1);
const admin = new URL(url);
admin.pathname = "/postgres";
const c = new pg.Client({ connectionString: admin.toString() });
await c.connect();
const { rowCount } = await c.query("select 1 from pg_database where datname = $1", [nombre]);
if (!rowCount) {
  await c.query(`create database "${nombre.replace(/"/g, "")}"`);
  console.log(`Base ${nombre} creada.`);
}
await c.end();

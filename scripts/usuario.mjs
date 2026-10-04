#!/usr/bin/env node
// Crea un usuario o le cambia la contraseña desde la terminal (por ejemplo, si el admin se olvidó la suya).
//
//   En el VPS:  docker compose exec app node scripts/usuario.mjs <email> <contraseña> [rol] [nombre]
//   En local:   DATABASE_URL=... node scripts/usuario.mjs <email> <contraseña> [rol] [nombre]
//
// Si el email ya existe, cambia la contraseña, lo reactiva y cierra sus sesiones.
// Si no existe, lo crea con el rol indicado (admin | compras | sistemas | recepcion; por defecto admin).

import { randomBytes, scrypt } from "node:crypto";
import pg from "pg";

const [email, password, rol = "admin", ...nombreParts] = process.argv.slice(2);
const nombre = nombreParts.join(" ") || "Administrador";

if (!email || !password) {
  console.error("Uso: node scripts/usuario.mjs <email> <contraseña> [rol] [nombre]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("La contraseña tiene que tener al menos 8 caracteres.");
  process.exit(1);
}
if (!["admin", "compras", "sistemas", "recepcion"].includes(rol)) {
  console.error("Rol inválido. Usá admin, compras, sistemas o recepcion.");
  process.exit(1);
}

// Mismo formato que src/lib/password.ts
function hash(pw) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(pw.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$")),
    ),
  );
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const mail = email.trim().toLowerCase();
  const passwordHash = await hash(password);
  const { rows } = await client.query("select id from usuarios where email = $1", [mail]);
  if (rows.length) {
    await client.query("update usuarios set password_hash = $1, activo = true, updated_at = now() where id = $2", [
      passwordHash,
      rows[0].id,
    ]);
    await client.query("delete from sesiones where usuario_id = $1", [rows[0].id]);
    console.log(`Contraseña actualizada para ${mail}.`);
  } else {
    await client.query("insert into usuarios (nombre, email, password_hash, rol) values ($1, $2, $3, $4)", [
      nombre,
      mail,
      passwordHash,
      rol,
    ]);
    console.log(`Usuario ${mail} creado con rol ${rol}.`);
  }
} finally {
  await client.end();
}

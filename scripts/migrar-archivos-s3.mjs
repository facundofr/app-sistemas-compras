#!/usr/bin/env node
// Copia los adjuntos que están en disco al almacenamiento S3 configurado (S3_BUCKET, S3_ENDPOINT, ...).
// No borra nada del disco: la app los sigue leyendo de ahí hasta que estén en S3.
//
//   En el VPS:  docker compose exec app node scripts/migrar-archivos-s3.mjs
//
// Se puede correr varias veces: saltea los que ya están en el bucket.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const dir = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
const Bucket = process.env.S3_BUCKET;
if (!Bucket) {
  console.error("Falta S3_BUCKET en el entorno.");
  process.exit(1);
}
const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
});

const TIPOS = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".doc": "application/msword",
};

let subidos = 0;
let salteados = 0;
for (const entrada of await readdir(dir, { recursive: true, withFileTypes: true })) {
  if (!entrada.isFile()) continue;
  const abs = path.join(entrada.parentPath, entrada.name);
  // La clave es la misma ruta relativa que guarda la base (ej: 2026/10/uuid.pdf).
  const Key = path.relative(dir, abs).split(path.sep).join("/");
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }));
    salteados++;
    continue;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode !== 404 && err?.name !== "NotFound") throw err;
  }
  const ContentType = TIPOS[path.extname(Key).toLowerCase()] ?? "application/octet-stream";
  await s3.send(new PutObjectCommand({ Bucket, Key, Body: await readFile(abs), ContentType }));
  subidos++;
  if (subidos % 50 === 0) console.log(`  ${subidos} subidos...`);
}
console.log(`Listo: ${subidos} archivo(s) subidos, ${salteados} ya estaban en el bucket.`);

import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ARCHIVO_MAX_MB, MIME_PERMITIDOS } from "./constants";

/**
 * Dónde se guardan los archivos: en disco (volumen de Docker) o, si está S3_BUCKET, en un almacenamiento
 * compatible con S3 (Cloudflare R2, Backblaze B2, AWS...), fuera del servidor y con su propio respaldo.
 * La ruta guardada en la base es la misma en los dos casos; al leer, si no está en S3 se busca en disco
 * (así los archivos viejos siguen andando mientras se migran con scripts/migrar-archivos-s3.mjs).
 */
export const s3Configurado = () => !!process.env.S3_BUCKET;

let s3: S3Client | null = null;
function getS3() {
  s3 ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  return s3;
}
const Bucket = () => process.env.S3_BUCKET!;

// turbopackIgnore: la ruta se resuelve en tiempo de ejecución; sin esto el build copia todo el proyecto al standalone.
const UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads"),
);

export class ArchivoInvalido extends Error {}

const OFFICE_ZIP: Record<string, string> = {
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const OFFICE_OLE: Record<string, string> = {
  ".xls": "application/vnd.ms-excel",
  ".doc": "application/msword",
};

/** Detecta el tipo real por los primeros bytes: no se confía en el MIME que manda el navegador. */
function sniff(buf: Buffer, nombre: string): string | null {
  if (buf.length < 12) return null;
  const ext = path.extname(nombre).toLowerCase();
  // Office moderno es un ZIP y el viejo un contenedor OLE: la firma confirma el formato, la extensión dice cuál es.
  if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return OFFICE_ZIP[ext] ?? null;
  if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return OFFICE_OLE[ext] ?? null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

function rutaAbsoluta(ruta: string) {
  const abs = path.resolve(UPLOAD_DIR, ruta);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new Error("Ruta de archivo inválida");
  return abs;
}

export function archivosDelForm(formData: FormData, campo: string) {
  return formData.getAll(campo).filter((f): f is File => f instanceof File && f.size > 0);
}

export async function guardarArchivo(file: File) {
  if (file.size > ARCHIVO_MAX_MB * 1024 * 1024) {
    throw new ArchivoInvalido(`«${file.name}» pesa más de ${ARCHIVO_MAX_MB} MB.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf, file.name);
  if (!mime || !(mime in MIME_PERMITIDOS)) {
    throw new ArchivoInvalido(`«${file.name}» no es una imagen, un PDF ni un Excel o Word.`);
  }
  const ahora = new Date();
  const carpeta = `${ahora.getFullYear()}/${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const ruta = `${carpeta}/${randomUUID()}${MIME_PERMITIDOS[mime]}`;
  if (s3Configurado()) {
    await getS3().send(new PutObjectCommand({ Bucket: Bucket(), Key: ruta, Body: buf, ContentType: mime }));
  } else {
    await mkdir(path.join(UPLOAD_DIR, carpeta), { recursive: true });
    await writeFile(rutaAbsoluta(ruta), buf);
  }
  const nombre = file.name.replace(/[\\/\r\n"]/g, "_").slice(0, 200) || `archivo${MIME_PERMITIDOS[mime]}`;
  return { ruta, mime, tamano: buf.length, nombre };
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  if (s3Configurado()) {
    try {
      const r = await getS3().send(new GetObjectCommand({ Bucket: Bucket(), Key: ruta }));
      return Buffer.from(await r.Body!.transformToByteArray());
    } catch (err) {
      if ((err as { name?: string }).name !== "NoSuchKey") throw err;
      // No está en S3: puede ser un archivo de antes de migrar.
    }
  }
  return readFile(rutaAbsoluta(ruta));
}

export async function borrarArchivo(ruta: string) {
  if (s3Configurado()) await getS3().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: ruta }));
  await rm(rutaAbsoluta(ruta), { force: true });
}

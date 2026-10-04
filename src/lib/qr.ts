import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { conBase } from "./base-path";
import { rutaRecibir } from "./qr-texto";

/** URL absoluta de una ruta de la app, con el dominio por el que se está entrando (detrás de Caddy llegan los x-forwarded-*). */
export async function urlAbsoluta(ruta: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${conBase(ruta)}`;
}

export const urlRecibir = (id: number) => urlAbsoluta(rutaRecibir(id));

/** SVG del QR, listo para incrustar. Corrección «M»: aguanta etiquetas algo gastadas o arrugadas. */
export function qrSvg(texto: string) {
  return QRCode.toString(texto, { type: "svg", errorCorrectionLevel: "M", margin: 0 });
}

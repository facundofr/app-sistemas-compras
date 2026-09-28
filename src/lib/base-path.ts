/** Prefijo de la app (basePath de next.config.ts). <Link>, redirect() y router ya lo agregan solos. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Para <a href> e <img src> que apuntan a rutas propias (/api/...): no pasan por el router de Next. */
export function conBase(ruta: string) {
  return `${BASE_PATH}${ruta}`;
}

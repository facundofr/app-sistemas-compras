import type { NextConfig } from "next";

// La app vive en https://miplancober.com/asistente-sistemas. Se fija al compilar (queda en el JS del navegador):
// si cambia, hay que volver a construir la imagen. Tiene que coincidir con la ruta del Caddyfile.
const basePath = "/asistente-sistemas";

const nextConfig: NextConfig = {
  basePath,
  // Para los enlaces que no pasan por <Link> (descargas, imágenes de adjuntos, exportar a Excel).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Genera .next/standalone: un server.js mínimo con solo las dependencias necesarias (imagen Docker chica).
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Hasta 5 archivos de 10 MB por envío, más el margen del multipart y del resto del formulario.
      bodySizeLimit: "90mb",
    },
  },
};

export default nextConfig;

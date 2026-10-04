import type { MetadataRoute } from "next";
import { conBase } from "@/lib/base-path";

/** Permite «Agregar a pantalla de inicio»: la app abre sola, sin barra del navegador y con la sesión iniciada. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pedidos Sistemas · Grupo Cober",
    short_name: "Pedidos",
    description: "Pedidos de compra del equipo de Sistemas",
    id: conBase("/"),
    start_url: conBase("/"),
    scope: conBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4f0",
    theme_color: "#12181f",
    lang: "es",
    icons: [
      { src: conBase("/icono/192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: conBase("/icono/512"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: conBase("/icono/512"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Escanear QR", short_name: "QR", url: conBase("/escanear") },
      { name: "Nuevo pedido", url: conBase("/pedidos/nuevo") },
    ],
  };
}

import { iconoApp } from "@/lib/icono-app";

// Ícono de «Agregar a pantalla de inicio» en iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconoApp(size.width);
}

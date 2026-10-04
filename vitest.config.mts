import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitarios de la lógica pura (permisos, formatos, lectura del QR...). Corren con `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});

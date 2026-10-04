import { expect, test } from "@playwright/test";
import { ingresar } from "./util";

test("en el celular: menú inferior con el botón QR y filtros en un panel", async ({ page }) => {
  await ingresar(page, "sistemas");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "QR" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Nuevo" })).toBeVisible();

  await page.goto("pedidos");
  await page.getByRole("button", { name: /Filtros/ }).click();
  await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
  await page.getByRole("button", { name: "Ver resultados" }).click();

  await nav.getByRole("link", { name: "QR" }).click();
  await expect(page.getByRole("heading", { name: "Escanear etiqueta" })).toBeVisible();
  await expect(page.getByLabel("Código del pedido")).toBeVisible();
});

test("Recepción ve «Por recibir» en lugar de «Nuevo»", async ({ page }) => {
  await ingresar(page, "recepcion");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.getByRole("link", { name: "Por recibir" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Nuevo" })).toHaveCount(0);
});

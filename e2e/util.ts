import { expect, type Browser, type Page } from "@playwright/test";

export const USUARIOS = {
  compras: { nombre: "Carla Compras", email: "compras@e2e.local", password: "prueba1234", rol: "compras" },
  sistemas: { nombre: "Ana Sistemas", email: "ana@e2e.local", password: "prueba1234", rol: "sistemas" },
  recepcion: { nombre: "Mesa de Entrada", email: "recepcion@e2e.local", password: "prueba1234", rol: "recepcion" },
} as const;

export async function ingresar(page: Page, quien: keyof typeof USUARIOS) {
  await page.goto("login");
  await page.getByLabel("Email").fill(USUARIOS[quien].email);
  await page.getByLabel("Contraseña").fill(USUARIOS[quien].password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

/** Una sesión nueva (otro navegador) ya ingresada con ese usuario. */
export async function sesion(browser: Browser, quien: keyof typeof USUARIOS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ingresar(page, quien);
  return page;
}

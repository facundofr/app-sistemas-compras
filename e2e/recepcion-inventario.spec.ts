import { expect, test, type Page } from "@playwright/test";
import { sesion } from "./util";

/** Recepción en dos partes y alta de los equipos recibidos en el inventario. */
test.describe.configure({ mode: "serial" });

let pedidoUrl = "";

async function elegir(page: Page, campo: string, opcion: string) {
  await page.getByLabel(campo).click();
  await page.getByRole("option", { name: opcion }).click();
}

test("Sistemas pide 2 notebooks y 1 mouse; Compras lo compra", async ({ browser }) => {
  const ana = await sesion(browser, "sistemas");
  await ana.goto("pedidos/nuevo");
  await elegir(ana, "Solicitante del sector", "Marcelo Engel");
  await ana.getByLabel("¿Qué sector solicitó la compra?").fill("Contaduría");
  await elegir(ana, "Facturar por", "Cemepro");
  await ana.getByLabel("Producto solicitado").fill("Notebook Lenovo E14");
  await ana.getByLabel("Cantidad").fill("2");
  await ana.getByLabel("Link").fill("https://ejemplo.com/notebook");
  await ana.getByRole("button", { name: "Agregar otro producto" }).click();
  await ana.getByLabel("Producto solicitado").nth(1).fill("Mouse inalámbrico");
  await ana.getByLabel("Cantidad").nth(1).fill("1");
  await ana.getByLabel("Link").nth(1).fill("https://ejemplo.com/mouse");
  await ana.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(ana.getByText(/PED-\d+ enviado/).first()).toBeVisible();
  await ana.goto("pedidos?q=Notebook");
  await ana.getByRole("link", { name: /PED-\d+/ }).first().click();
  await ana.waitForURL(/\/pedidos\/\d+$/);
  pedidoUrl = new URL(ana.url()).pathname.replace(/^\/asistente-sistemas\//, "");

  const carla = await sesion(browser, "compras");
  await carla.goto(pedidoUrl);
  await carla.getByRole("button", { name: "Empezar a cotizar" }).click();
  await expect(carla.getByText("pasó a «Cotizando»")).toBeVisible();
  await carla.getByRole("button", { name: "Marcar como comprado" }).click();
  await expect(carla.getByText("pasó a «Comprando»")).toBeVisible();
});

test("Recepción registra una parte y después el resto", async ({ browser }) => {
  const rec = await sesion(browser, "recepcion");
  await rec.goto(`${pedidoUrl}/recibir`);
  // Llega 1 de las 2 notebooks y todavía no el mouse.
  await rec.getByRole("button", { name: "Una menos de Notebook Lenovo E14" }).click();
  await rec.getByRole("checkbox", { name: "Llegó Mouse inalámbrico" }).click();
  await rec.getByRole("button", { name: "Registrar lo que llegó" }).click();
  await expect(rec.getByText(/Recepción parcial registrada/)).toBeVisible();
  await expect(rec.getByText("Llegó una parte: 1 de 3 unidades").first()).toBeVisible();

  // Lo que falta: ya viene marcado por defecto.
  await expect(rec.getByRole("button", { name: "Confirmar entrega" })).toBeVisible();
  await rec.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(rec.getByText("Entrega confirmada")).toBeVisible();

  const ana = await sesion(browser, "sistemas");
  await ana.goto("notificaciones");
  await expect(ana.getByText("Llegó una parte: Notebook Lenovo E14 y 1 producto más")).toBeVisible();
  await expect(ana.getByText("Se recibió: Notebook Lenovo E14 y 1 producto más")).toBeVisible();
});

test("Sistemas registra las notebooks en el inventario", async ({ browser }) => {
  const ana = await sesion(browser, "sistemas");
  await ana.goto(pedidoUrl);
  await ana.getByRole("link", { name: "Registrar equipos" }).click();
  await expect(ana.getByRole("heading", { name: "Registrar equipos recibidos" })).toBeVisible();
  // Una fila por unidad recibida: 2 notebooks y 1 mouse.
  await expect(ana.getByRole("group", { name: /Equipo \d/ })).toHaveCount(3);
  await ana.getByRole("button", { name: "Quitar el equipo 3" }).click();
  await ana.getByLabel("N° de serie").nth(0).fill("PF-111");
  await ana.getByLabel("N° de serie").nth(1).fill("PF-222");
  await ana.getByLabel("Asignado a").nth(1).fill("Juan Pérez");
  await ana.getByRole("button", { name: "Registrar 2 equipos" }).click();
  await ana.waitForURL(new RegExp(`${pedidoUrl}$`));
  await expect(ana.getByText("EQ-00001 · S/N PF-111")).toBeVisible();
  await expect(ana.getByText("Juan Pérez")).toBeVisible();
});

test("Reasignar un equipo queda en su historial; no se repiten números de serie", async ({ browser }) => {
  const ana = await sesion(browser, "sistemas");
  await ana.goto("equipos?q=PF-111");
  await ana.getByRole("link", { name: "EQ-00001" }).click();
  await ana.getByLabel("Asignado a").fill("María Gómez");
  await ana.getByLabel("Estado").selectOption("en_uso");
  await ana.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(ana.getByText("Equipo actualizado.")).toBeVisible();
  await expect(ana.getByText("Cambió la asignación")).toBeVisible();
  await expect(ana.getByText(/→ María Gómez/)).toBeVisible();

  await ana.goto("equipos/nuevo");
  await ana.getByRole("textbox", { name: /^Equipo/ }).fill("Notebook repetida");
  await ana.getByLabel("N° de serie").fill("PF-222");
  await ana.getByRole("button", { name: "Registrar equipo" }).click();
  await expect(ana.getByText("Alguno de esos números de serie ya está cargado en el inventario.")).toBeVisible();
});

test("El lector abre la ficha del equipo con su código", async ({ browser }) => {
  const rec = await sesion(browser, "recepcion");
  await rec.goto("escanear");
  await rec.getByLabel("Código de la etiqueta").fill("EQ-00002");
  await rec.getByRole("button", { name: "Ir" }).click();
  await expect(rec).toHaveURL(/\/equipos\/2$/);
  await expect(rec.getByText("PF-222").first()).toBeVisible();
  // Recepción puede consultar, pero no editar.
  await expect(rec.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
});

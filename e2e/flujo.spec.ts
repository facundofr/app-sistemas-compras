import { expect, test, type Page } from "@playwright/test";
import { sesion } from "./util";

/** El circuito completo de un pedido, con cada rol en su propio navegador. */
test.describe.configure({ mode: "serial" });

let pedidoUrl = "";

async function elegir(page: Page, campo: string, opcion: string) {
  await page.getByLabel(campo).click();
  await page.getByRole("option", { name: opcion }).click();
}

test("Sistemas carga un pedido con dos productos", async ({ browser }) => {
  const ana = await sesion(browser, "sistemas");
  await ana.goto("pedidos/nuevo");
  await elegir(ana, "Solicitante del sector", "Marcelo Engel");
  await ana.getByLabel("¿Qué sector solicitó la compra?").fill("IT");
  await elegir(ana, "Facturar por", "Cemepro");
  await ana.getByLabel("Producto solicitado").fill("Monitor 24 pulgadas");
  await ana.getByLabel("Cantidad").fill("2");
  await ana.getByLabel("Link").fill("https://ejemplo.com/monitor");
  await ana.getByRole("button", { name: "Agregar otro producto" }).click();
  await ana.getByLabel("Producto solicitado").nth(1).fill("Cable HDMI");
  await ana.getByLabel("Cantidad").nth(1).fill("2");
  await ana.getByLabel("Link").nth(1).fill("https://ejemplo.com/cable");
  await ana.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(ana.getByText(/PED-\d+ enviado/).first()).toBeVisible();

  await ana.goto("pedidos?mios=1");
  await ana.getByRole("link", { name: /PED-\d+/ }).first().click();
  await ana.waitForURL(/\/pedidos\/\d+$/);
  pedidoUrl = new URL(ana.url()).pathname.replace(/^\/asistente-sistemas\//, "");
  await expect(ana.getByRole("heading", { name: "Monitor 24 pulgadas y 1 producto más" })).toBeVisible();
  // Sigue en «Solicitado» y es de Ana: lo ve en el formulario de edición, con los dos productos.
  await expect(ana.getByLabel("Producto solicitado").nth(1)).toHaveValue("Cable HDMI");
});

test("Compras lo recibe, lo cotiza y lo compra; Sistemas se entera en vivo", async ({ browser }) => {
  const carla = await sesion(browser, "compras");
  await carla.goto("notificaciones");
  await expect(carla.getByText("Nuevo pedido: Monitor 24 pulgadas y 1 producto más")).toBeVisible();

  const ana = await sesion(browser, "sistemas");
  const campana = ana.locator("header a[href$='/notificaciones']");
  await expect(campana).toHaveAttribute("aria-label", "Notificaciones");

  await carla.goto(pedidoUrl);
  await carla.getByRole("button", { name: "Empezar a cotizar" }).click();
  await expect(carla.getByText("pasó a «Cotizando»")).toBeVisible();
  // Sin recargar: llega por /api/eventos.
  await expect(campana).toHaveAttribute("aria-label", "Notificaciones: 1 sin leer", { timeout: 15_000 });

  await carla.getByLabel("Proveedor", { exact: true }).fill("Mercado Libre");
  await carla.getByLabel("Llega aprox. el").fill("2030-01-15");
  await carla.getByRole("button", { name: "Guardar datos de compra" }).click();
  await expect(carla.getByText("Datos de compra guardados.")).toBeVisible();
  await carla.getByRole("button", { name: "Marcar como comprado" }).click();
  await expect(carla.getByText("pasó a «Comprando»")).toBeVisible();
  await expect(carla.locator(".etiqueta-qr")).toBeVisible();
  await expect(carla.getByText(/Llega aprox\. el 15\/01/).first()).toBeVisible();
});

test("Recepción confirma la entrega desde el QR, con calificación", async ({ browser }) => {
  const rec = await sesion(browser, "recepcion");
  await expect(rec.getByText("Hay 1 paquete por llegar.")).toBeVisible();
  await rec.goto(`${pedidoUrl}/recibir`);
  await rec.getByRole("button", { name: /^5 de 5/ }).click();
  await rec.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(rec.getByText("Entrega confirmada")).toBeVisible();

  const ana = await sesion(browser, "sistemas");
  await ana.goto("notificaciones");
  await expect(ana.getByText("Se recibió: Monitor 24 pulgadas y 1 producto más")).toBeVisible();
  await ana.goto(pedidoUrl);
  await expect(ana.getByRole("link", { name: "Volver a pedir" })).toBeVisible();
  await expect(ana.getByLabel("5 de 5")).toBeVisible();
});

test("Volver a pedir precarga los dos productos", async ({ browser }) => {
  const ana = await sesion(browser, "sistemas");
  await ana.goto(pedidoUrl);
  await ana.getByRole("link", { name: "Volver a pedir" }).click();
  await expect(ana.getByRole("heading", { name: "Volver a pedir" })).toBeVisible();
  await expect(ana.getByLabel("Producto solicitado").nth(0)).toHaveValue("Monitor 24 pulgadas");
  await expect(ana.getByLabel("Producto solicitado").nth(1)).toHaveValue("Cable HDMI");
});

test("Recepción no puede cargar pedidos", async ({ browser }) => {
  const rec = await sesion(browser, "recepcion");
  await rec.goto("pedidos/nuevo");
  await expect(rec).toHaveURL(/\/pedidos$/);
});

test("Sin sesión, el link del QR vuelve a la confirmación después del login", async ({ page }) => {
  await page.goto(`${pedidoUrl}/recibir`);
  await expect(page).toHaveURL(/login\?next=/);
  await page.getByLabel("Email").fill("ana@e2e.local");
  await page.getByLabel("Contraseña").fill("prueba1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`${pedidoUrl}/recibir$`));
});

test("Búsqueda tolerante a errores y chips de filtros", async ({ browser }) => {
  const carla = await sesion(browser, "compras");
  await carla.goto("pedidos?q=moniter");
  await expect(carla.locator("tbody tr")).toHaveCount(1);
  await carla.goto("pedidos?estado=Entregado");
  await expect(carla.getByRole("button", { name: "Quitar filtro Estado: Entregado" })).toBeVisible();
  await carla.getByRole("button", { name: "Quitar filtro Estado: Entregado" }).click();
  await expect(carla).toHaveURL(/\/pedidos$/);
});

// Service worker: muestra las notificaciones push y, al tocarlas, abre el pedido.
// Se registra desde «Notificaciones» (src/components/activar-push.tsx) con el scope de la app.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: event.data ? event.data.text() : "Pedidos Sistemas" };
  }
  const base = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(datos.titulo || "Pedidos Sistemas", {
      body: datos.cuerpo || "",
      icon: new URL("icono/192", base).href,
      badge: new URL("icono/192", base).href,
      data: { url: datos.url || base },
      lang: "es",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || self.registration.scope, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si la app ya está abierta, se reutiliza esa ventana.
      for (const v of ventanas) {
        if (v.url.startsWith(self.registration.scope) && "focus" in v) {
          await v.focus();
          return v.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

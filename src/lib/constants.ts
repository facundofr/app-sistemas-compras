import type { Estado, Lista, Prioridad, Rol } from "@/db/schema";

export const ESTADOS: readonly Estado[] = ["Solicitado", "Cotizando", "Comprando", "Entregado"];

export const ESTADO_INFO: Record<Estado, { equipo: "sistemas" | "compras"; descripcion: string }> = {
  Solicitado: { equipo: "sistemas", descripcion: "Sistemas cargó el pedido" },
  Cotizando: { equipo: "compras", descripcion: "Compras está pidiendo precios" },
  Comprando: { equipo: "compras", descripcion: "La compra está hecha, falta recibirla" },
  Entregado: { equipo: "sistemas", descripcion: "Sistemas recibió el producto" },
};

export const PRIORIDADES: readonly Prioridad[] = ["Baja", "Media", "Alta", "Urgente"];

// Días sin cambiar de estado a partir de los cuales un pedido pide atención.
export const DIAS_ALERTA: Record<Prioridad, number> = { Urgente: 1, Alta: 3, Media: 5, Baja: 7 };

export const ROLES: Record<Rol, { nombre: string; descripcion: string }> = {
  admin: { nombre: "Administrador", descripcion: "Acceso total, gestiona usuarios y listas" },
  compras: { nombre: "Compras", descripcion: "Gestiona cotizaciones, compras y facturas" },
  sistemas: { nombre: "Equipo Sistemas", descripcion: "Carga pedidos y confirma entregas" },
  recepcion: { nombre: "Recepción", descripcion: "Recibe los paquetes: ve los pedidos y confirma entregas, no carga pedidos" },
};

/** El orden de las claves es el orden en que se muestran en «Listas de opciones». */
export const LISTAS: Record<Lista, { nombre: string; singular: string; descripcion: string }> = {
  solicitante_sector: {
    nombre: "Solicitantes del sector",
    singular: "solicitante",
    descripcion: "Opciones de «Solicitante del sector» en el pedido.",
  },
  empresa: {
    nombre: "Empresas",
    singular: "empresa",
    descripcion: "Opciones de «Facturar por» en el pedido.",
  },
  domicilio: {
    nombre: "Domicilios de entrega",
    singular: "domicilio",
    descripcion: "Direcciones que se ofrecen en el pedido, además de «Otro».",
  },
  medio_compra: {
    nombre: "Medios de compra",
    singular: "medio de compra",
    descripcion: "Dónde se hizo la compra.",
  },
  medio_pago: {
    nombre: "Medios de pago",
    singular: "medio de pago",
    descripcion: "Tarjeta o forma de pago usada.",
  },
  tipo_factura: {
    nombre: "Tipos de factura",
    singular: "tipo de factura",
    descripcion: "Letra o tipo del comprobante.",
  },
};

/** Opciones con las que arranca cada lista vacía (tomadas del formulario de Google). */
export const OPCIONES_INICIALES: Record<Lista, string[]> = {
  solicitante_sector: [
    "Marcelo Engel",
    "Adrian Rodriguez",
    "Leandro Gasssman",
    "Mariano Santiago",
    "Solange Calle",
    "Lucas De Cabo",
    "Otro",
  ],
  empresa: [
    "Bristol Medicine",
    "Cemepro",
    "CM de la Mujer",
    "Cobensil",
    "Farmacia Nobel",
    "Reinsal",
    "Medicals",
    "Laboratorio Argil Srl",
    "Traumato SA",
    "Centro Médico Vilella",
    "NA",
  ],
  domicilio: ["Cramer 1652", "Av Los Incas 3536"],
  medio_compra: ["Mercado Libre", "Proveedor directo"],
  medio_pago: ["AMEX", "VISA", "Mercado Pago", "Transferencia", "Efectivo", "Otro"],
  tipo_factura: ["A", "B", "C", "X", "Otro"],
};

/** Los id de pedido son `serial` (integer de Postgres): un número mayor hace fallar la consulta en vez de no encontrar nada. */
export const esIdPedido = (n: number) => Number.isInteger(n) && n > 0 && n <= 2_147_483_647;

export const ARCHIVO_MAX_MB = 10;
export const ARCHIVOS_MAX_POR_ENVIO = 5;

/** Tipos de archivo aceptados → extensión con la que se guardan. */
export const MIME_PERMITIDOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/msword": ".doc",
};
/** Los que el navegador puede mostrar; el resto se descarga. */
export const MIME_EN_LINEA = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const ACCEPT_ARCHIVOS = [...Object.keys(MIME_PERMITIDOS), ...Object.values(MIME_PERMITIDOS)].join(",");
export const TIPOS_ARCHIVO_TEXTO = "Imágenes, PDF, Excel o Word";

/** Valor centinela de los selects opcionales (Radix no admite ítems con valor vacío). */
export const SELECT_VACIO = "__vacio__";

/** Valor del radio «Otro» en el domicilio de entrega. */
export const DOMICILIO_OTRO = "__otro__";

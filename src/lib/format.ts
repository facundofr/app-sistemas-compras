const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyCompact = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return money.format(n);
}

export function fmtMoneyCompact(n: number) {
  return moneyCompact.format(n);
}

const TZ = "America/Argentina/Buenos_Aires";

export function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  // Las columnas `date` llegan como "YYYY-MM-DD": se muestran tal cual, sin corrimiento de zona.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  });
}

export function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function fmtMes(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  return s.replace(".", "");
}

/** Fecha de hoy en Argentina como "YYYY-MM-DD". */
export function hoyISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function codigoPedido(id: number) {
  return `PED-${String(id).padStart(5, "0")}`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function diasDesde(fecha: Date | string) {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

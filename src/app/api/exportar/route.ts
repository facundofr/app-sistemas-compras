import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getUsuarioActual } from "@/lib/auth";
import { codigoPedido, hoyISO } from "@/lib/format";
import { codigoEquipo, ESTADOS_EQUIPO } from "@/lib/equipos";
import { itemsDePedidos, listarCompras, listarEquipos, pedidosParaExportar } from "@/lib/queries";

const MONEY = '"$"#,##0.00';
const FECHA = "dd/mm/yyyy";

function aFecha(v: string | null) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: Partial<ExcelJS.Column>[], filas: object[]) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas;
  ws.addRows(filas);
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B7A72" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  return ws;
}

function agrupar<T>(filas: T[], clave: (f: T) => string, monto: (f: T) => number | null) {
  const m = new Map<string, number>();
  for (const f of filas) {
    const v = monto(f);
    if (v == null) continue;
    m.set(clave(f), (m.get(clave(f)) ?? 0) + v);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([nombre, total]) => ({ nombre, total }));
}

export async function GET(req: NextRequest) {
  if (!(await getUsuarioActual())) return new Response("No autorizado", { status: 401 });
  const sp = req.nextUrl.searchParams;
  const t = sp.get("tipo");
  const tipo = t === "compras" || t === "equipos" ? t : "pedidos";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pedidos Sistemas";

  if (tipo === "equipos") {
    const filas = await listarEquipos(
      { q: sp.get("q") ?? undefined, estado: sp.get("estado") ?? undefined, sector: sp.get("sector") ?? undefined },
      100_000,
    );
    hoja(
      wb,
      "Inventario",
      [
        { header: "Código", key: "codigo", width: 11 },
        { header: "Equipo", key: "descripcion", width: 40 },
        { header: "N° de serie", key: "serie", width: 22 },
        { header: "Estado", key: "estado", width: 14 },
        { header: "Asignado a", key: "asignadoA", width: 24 },
        { header: "Sector", key: "sector", width: 18 },
        { header: "Ubicación", key: "ubicacion", width: 24 },
        { header: "Alta", key: "alta", width: 12, style: { numFmt: FECHA } },
        { header: "Garantía hasta", key: "garantia", width: 14, style: { numFmt: FECHA } },
        { header: "Pedido", key: "pedido", width: 12 },
        { header: "Notas", key: "notas", width: 30 },
      ],
      filas.map((e) => ({
        codigo: codigoEquipo(e.id),
        descripcion: e.descripcion,
        serie: e.numeroSerie,
        estado: ESTADOS_EQUIPO[e.estado].nombre,
        asignadoA: e.asignadoA,
        sector: e.sector,
        ubicacion: e.ubicacion,
        alta: aFecha(e.fechaAlta),
        garantia: aFecha(e.garantiaHasta),
        pedido: e.pedidoId ? codigoPedido(e.pedidoId) : null,
        notas: e.notas,
      })),
    );
  } else if (tipo === "pedidos") {
    const filas = await pedidosParaExportar({
      q: sp.get("q") ?? undefined,
      estado: sp.get("estado") ?? undefined,
      empresa: sp.get("empresa") ?? undefined,
      prioridad: sp.get("prioridad") ?? undefined,
    });
    hoja(
      wb,
      "Pedidos",
      [
        { header: "Código", key: "codigo", width: 12 },
        { header: "Fecha pedido", key: "fecha", width: 13, style: { numFmt: FECHA } },
        { header: "Solicitante del sector", key: "solicitanteSector", width: 22 },
        { header: "Estado", key: "estado", width: 12 },
        { header: "Prioridad", key: "prioridad", width: 10 },
        { header: "Nombre y apellido del solicitante", key: "solicitante", width: 26 },
        { header: "Sector que solicitó", key: "sector", width: 20 },
        { header: "Facturar por", key: "facturarPor", width: 22 },
        { header: "Domicilio entrega", key: "domicilio", width: 24 },
        { header: "Producto", key: "producto", width: 40 },
        { header: "Cantidad", key: "cantidad", width: 9 },
        { header: "Link", key: "link", width: 30 },
        { header: "Comentarios", key: "comentarios", width: 30 },
        { header: "Medio de compra", key: "medioCompra", width: 16 },
        { header: "Proveedor", key: "proveedor", width: 22 },
        { header: "CUIT", key: "cuit", width: 15 },
        { header: "Fecha compra", key: "fechaCompra", width: 13, style: { numFmt: FECHA } },
        { header: "Llega aprox.", key: "fechaEstimada", width: 13, style: { numFmt: FECHA } },
        { header: "Fecha entrega", key: "fechaEntrega", width: 13, style: { numFmt: FECHA } },
        { header: "Seguimiento", key: "seguimiento", width: 18 },
        { header: "Calificación recepción", key: "calificacion", width: 12 },
        { header: "Medio de pago", key: "medioPago", width: 14 },
        { header: "Cuotas", key: "cuotas", width: 8 },
        { header: "Importe", key: "importe", width: 15, style: { numFmt: MONEY } },
        { header: "N° factura", key: "facturaNumero", width: 16 },
        { header: "Tipo factura", key: "tipoFactura", width: 11 },
        { header: "Link factura", key: "facturaLink", width: 30 },
        { header: "Notas Compras", key: "notas", width: 30 },
        { header: "Cargado por", key: "creadoPor", width: 20 },
        { header: "Motivo cancelación", key: "motivo", width: 24 },
        { header: "Cargado el", key: "cargado", width: 13, style: { numFmt: FECHA } },
      ],
      filas.map(({ p, creadoPor }) => ({
        codigo: codigoPedido(p.id),
        fecha: aFecha(p.fechaPedido),
        solicitanteSector: p.solicitanteSector,
        estado: p.cancelado ? "Cancelado" : p.estado,
        prioridad: p.prioridad,
        solicitante: p.solicitante,
        sector: p.sector,
        facturarPor: p.facturarPor,
        domicilio: p.domicilioEntrega,
        producto: p.producto,
        cantidad: p.cantidad,
        link: p.link,
        comentarios: p.comentarios,
        medioCompra: p.medioCompra,
        proveedor: p.proveedor,
        cuit: p.cuit,
        fechaCompra: aFecha(p.fechaCompra),
        fechaEstimada: aFecha(p.fechaEstimada),
        fechaEntrega: aFecha(p.fechaEntrega),
        seguimiento: p.codigoSeguimiento,
        calificacion: p.calificacion,
        medioPago: p.medioPago,
        cuotas: p.cuotas,
        importe: p.importe,
        facturaNumero: p.facturaNumero,
        tipoFactura: p.tipoFactura,
        facturaLink: p.facturaLink,
        notas: p.notasCompras,
        creadoPor,
        motivo: p.canceladoMotivo,
        cargado: p.createdAt,
      })),
    );
    // Una fila por producto: los pedidos con varios ítems se ven completos.
    const estadoDe = new Map(filas.map(({ p }) => [p.id, p.cancelado ? "Cancelado" : p.estado]));
    hoja(
      wb,
      "Productos",
      [
        { header: "Código", key: "codigo", width: 12 },
        { header: "Estado", key: "estado", width: 12 },
        { header: "Producto", key: "producto", width: 44 },
        { header: "Cantidad", key: "cantidad", width: 9 },
        { header: "Link", key: "link", width: 40 },
      ],
      (await itemsDePedidos(filas.map((f) => f.p.id))).map((i) => ({
        codigo: codigoPedido(i.pedidoId),
        estado: estadoDe.get(i.pedidoId),
        producto: i.producto,
        cantidad: i.cantidad,
        link: i.link,
      })),
    );
    const activos = filas.map((f) => f.p).filter((p) => !p.cancelado);
    const resumen = [
      { header: "Nombre", key: "nombre", width: 32 },
      { header: "Importe", key: "total", width: 16, style: { numFmt: MONEY } },
    ];
    hoja(wb, "Por proveedor", resumen, agrupar(activos, (p) => p.proveedor || "Sin proveedor", (p) => p.importe));
    hoja(wb, "Por empresa", resumen, agrupar(activos, (p) => p.facturarPor, (p) => p.importe));
  } else {
    const { filas } = await listarCompras({
      desde: sp.get("desde") ?? undefined,
      hasta: sp.get("hasta") ?? undefined,
      empresa: sp.get("empresa") ?? undefined,
      medioPago: sp.get("medioPago") ?? undefined,
      q: sp.get("q") ?? undefined,
    });
    const ws = hoja(
      wb,
      "Compras",
      [
        { header: "Fecha compra", key: "fecha", width: 13, style: { numFmt: FECHA } },
        { header: "Código", key: "codigo", width: 12 },
        { header: "Producto", key: "producto", width: 40 },
        { header: "Cantidad", key: "cantidad", width: 9 },
        { header: "Facturar por", key: "facturarPor", width: 22 },
        { header: "Proveedor", key: "proveedor", width: 22 },
        { header: "CUIT", key: "cuit", width: 15 },
        { header: "Medio de compra", key: "medioCompra", width: 16 },
        { header: "Medio de pago", key: "medioPago", width: 14 },
        { header: "Cuotas", key: "cuotas", width: 8 },
        { header: "N° factura", key: "facturaNumero", width: 16 },
        { header: "Tipo", key: "tipoFactura", width: 8 },
        { header: "Importe", key: "importe", width: 15, style: { numFmt: MONEY } },
        { header: "Estado", key: "estado", width: 12 },
        { header: "Fecha entrega", key: "fechaEntrega", width: 13, style: { numFmt: FECHA } },
      ],
      filas.map((c) => ({
        ...c,
        fecha: aFecha(c.fecha),
        codigo: codigoPedido(c.id),
        fechaEntrega: aFecha(c.fechaEntrega),
      })),
    );
    const total = ws.addRow({ producto: "Total", importe: filas.reduce((a, c) => a + (c.importe ?? 0), 0) });
    total.font = { bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${tipo}_${hoyISO()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

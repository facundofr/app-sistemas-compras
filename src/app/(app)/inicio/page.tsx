import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CircleCheckBigIcon,
  FileWarningIcon,
  PackageCheckIcon,
  PlusIcon,
  QrCodeIcon,
  RepeatIcon,
  SearchIcon,
  ShoppingCartIcon,
  TruckIcon,
} from "lucide-react";
import { TarjetaPedido } from "@/components/pedidos/tarjeta-pedido";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUsuario } from "@/lib/auth";
import { gestionaCompras } from "@/lib/permisos";
import { inicioCompras, inicioRecepcion, inicioSistemas, type PedidoTarjeta } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

/** Primer nombre, para el saludo. */
const nombreCorto = (n: string) => n.trim().split(/\s+/)[0];

function saludo() {
  const h = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  return h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

/**
 * Como la home de Mercado Libre: primero lo que le importa a cada uno.
 * Sistemas ve sus pedidos en camino; Compras, una bandeja de lo que requiere acción; Recepción, lo que está por llegar.
 */
export default async function InicioPage() {
  const usuario = await requireUsuario();
  const titulo = `${saludo()}, ${nombreCorto(usuario.nombre)}`;

  if (gestionaCompras(usuario.rol)) {
    const d = await inicioCompras();
    const pendientes = d.atencion.total + d.porCotizar.total + d.porComprar.total;
    return (
      <>
        <Encabezado
          titulo={titulo}
          bajada={pendientes ? `Tenés ${pendientes} ${pendientes === 1 ? "pedido" : "pedidos"} para gestionar.` : "No hay nada pendiente. 🎉"}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Seccion
            icono={AlertTriangleIcon}
            tono="alerta"
            titulo="Necesitan atención"
            vacio="Ningún pedido trabado ni atrasado."
            datos={d.atencion}
            verTodos="/pedidos?estado=Atencion"
          />
          <Seccion icono={SearchIcon} titulo="Por cotizar" vacio="No hay pedidos nuevos." datos={d.porCotizar} verTodos="/pedidos?estado=Solicitado" />
          <Seccion icono={ShoppingCartIcon} titulo="Por comprar" vacio="Nada cotizándose." datos={d.porComprar} verTodos="/pedidos?estado=Cotizando" />
          <Seccion icono={TruckIcon} titulo="Llegan esta semana" vacio="No hay entregas previstas." datos={d.porLlegar} verTodos="/pedidos?estado=Comprando" />
          <Seccion
            icono={FileWarningIcon}
            titulo="Falta la factura"
            vacio="Todas las compras tienen factura."
            datos={d.facturasFaltantes}
            verTodos="/compras"
          />
        </div>
      </>
    );
  }

  if (usuario.rol === "recepcion") {
    const d = await inicioRecepcion();
    return (
      <>
        <Encabezado titulo={titulo} bajada={d.total ? `Hay ${d.total} ${d.total === 1 ? "paquete" : "paquetes"} por llegar.` : "No hay paquetes por llegar."}>
          <Button size="lg" asChild>
            <Link href="/escanear?seguido=1">
              <QrCodeIcon /> Recibir paquetes
            </Link>
          </Button>
        </Encabezado>
        <Seccion icono={TruckIcon} titulo="Por recibir" vacio="Cuando Compras haga una compra, aparece acá." datos={d} verTodos="/pedidos?estado=Comprando" />
      </>
    );
  }

  const d = await inicioSistemas(usuario.id);
  return (
    <>
      <Encabezado
        titulo={titulo}
        bajada={
          d.porConfirmar.total
            ? `Te ${d.porConfirmar.total === 1 ? "falta confirmar 1 entrega" : `faltan confirmar ${d.porConfirmar.total} entregas`}.`
            : "Así van tus pedidos."
        }
      >
        <Button asChild className="max-md:hidden">
          <Link href="/pedidos/nuevo">
            <PlusIcon /> Nuevo pedido
          </Link>
        </Button>
      </Encabezado>
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion
          icono={PackageCheckIcon}
          titulo="En camino"
          vacio="No tenés compras en camino."
          datos={d.porConfirmar}
          verTodos="/pedidos?estado=Comprando&mios=1"
          accion={(p) => (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/pedidos/${p.id}/recibir`}>Ya llegó</Link>
            </Button>
          )}
        />
        <Seccion icono={SearchIcon} titulo="En gestión de Compras" vacio="No tenés pedidos esperando." datos={d.enCurso} verTodos="/pedidos?mios=1" />
        {d.recibidos.length > 0 && (
          <Seccion
            icono={CircleCheckBigIcon}
            titulo="Recibidos hace poco"
            vacio=""
            datos={{ items: d.recibidos, total: d.recibidos.length }}
            accion={(p) => (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/pedidos/nuevo?desde=${p.id}`} aria-label={`Volver a pedir ${p.producto}`}>
                  <RepeatIcon /> <span className="max-sm:hidden">Volver a pedir</span>
                </Link>
              </Button>
            )}
          />
        )}
      </div>
    </>
  );
}

function Encabezado({ titulo, bajada, children }: { titulo: string; bajada: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight md:text-2xl">{titulo}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{bajada}</p>
      </div>
      {children}
    </div>
  );
}

function Seccion({
  icono: Icono,
  titulo,
  vacio,
  datos,
  verTodos,
  accion,
  tono,
}: {
  icono: React.ComponentType<{ className?: string }>;
  titulo: string;
  vacio: string;
  datos: { items: PedidoTarjeta[]; total: number };
  verTodos?: string;
  accion?: (p: PedidoTarjeta) => React.ReactNode;
  tono?: "alerta";
}) {
  return (
    <Card className={cn("gap-0 py-0", tono === "alerta" && datos.total > 0 && "border-destructive/30")}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className={cn("flex items-center gap-2 text-[14.5px] font-bold", tono === "alerta" && datos.total > 0 && "text-destructive")}>
          <Icono className="size-4" />
          {titulo}
          <span className="font-sans text-[13px] font-normal text-muted-foreground">{datos.total}</span>
        </h2>
        {verTodos && datos.total > datos.items.length && (
          <Link href={verTodos} className="text-[12.5px] font-medium text-primary hover:underline">
            Ver todos
          </Link>
        )}
      </div>
      {datos.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="divide-y">
          {datos.items.map((p) => (
            <TarjetaPedido key={p.id} p={p} accion={accion?.(p)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

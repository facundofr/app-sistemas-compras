import type { Metadata } from "next";
import { CircleCheckIcon, CircleDashedIcon, ExternalLinkIcon } from "lucide-react";
import { desconectarMercadoLibre, emailDePrueba, revisarAtrasosAhora, sincronizarAhora } from "@/actions/integraciones";
import { BotonAccion } from "@/components/admin/boton-accion";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRol } from "@/lib/auth";
import { conBase } from "@/lib/base-path";
import { emailConfigurado } from "@/lib/email";
import { fmtDateTime } from "@/lib/format";
import { estadoConexion, mlConfigurado, urlCallback } from "@/lib/mercadolibre";
import { pushConfigurado } from "@/lib/push";
import { s3Configurado } from "@/lib/storage";

export const metadata: Metadata = { title: "Integraciones" };

function Estado({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${ok ? "text-primary" : "text-muted-foreground"}`}>
      {ok ? <CircleCheckIcon className="size-4" /> : <CircleDashedIcon className="size-4" />}
      {ok ? si : no}
    </span>
  );
}

function Vars({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">{children}</code>;
}

const MENSAJES_ML: Record<string, { ok: boolean; texto: string }> = {
  conectado: { ok: true, texto: "Cuenta de Mercado Libre conectada." },
  error: { ok: false, texto: "No se pudo conectar la cuenta de Mercado Libre. Probá de nuevo." },
  "sin-configurar": { ok: false, texto: "Primero cargá ML_CLIENT_ID, ML_CLIENT_SECRET y APP_URL en el .env." },
};

export default async function IntegracionesPage(props: PageProps<"/admin/integraciones">) {
  await requireRol("admin");
  const ml = (await props.searchParams).ml;
  const aviso = typeof ml === "string" ? MENSAJES_ML[ml] : undefined;
  const conexion = mlConfigurado() ? await estadoConexion() : null;

  return (
    <>
      <PageHeader
        title="Integraciones"
        description="Servicios externos que usa la app. Se configuran en el .env del servidor; acá se ve su estado."
      />
      {aviso && (
        <Alert variant={aviso.ok ? "default" : "destructive"} className="mb-5">
          <AlertDescription>{aviso.texto}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Mercado Libre</CardTitle>
            <CardDescription>
              Con la cuenta de Compras conectada, los pedidos con N° de orden completan solos la fecha estimada y el
              seguimiento, y avisan cuando el envío sale y cuando llega.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            {!conexion ? (
              <>
                <Estado ok={false} si="" no="Sin configurar" />
                <p className="text-muted-foreground">
                  Creá una aplicación en{" "}
                  <a href="https://developers.mercadolibre.com.ar/devcenter" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    developers.mercadolibre.com.ar <ExternalLinkIcon className="inline size-3" />
                  </a>{" "}
                  y cargá <Vars>ML_CLIENT_ID</Vars>, <Vars>ML_CLIENT_SECRET</Vars> y <Vars>APP_URL</Vars>.
                </p>
              </>
            ) : conexion.conectado ? (
              <>
                <Estado ok si={`Conectada${conexion.nickname ? ` como ${conexion.nickname}` : ""}`} no="" />
                <p className="text-[12px] text-muted-foreground">Última actualización de credenciales: {fmtDateTime(conexion.desde)}</p>
                <div className="flex flex-wrap gap-2">
                  <BotonAccion accion={sincronizarAhora}>Sincronizar ahora</BotonAccion>
                  <BotonAccion accion={desconectarMercadoLibre} variant="ghost">
                    Desconectar
                  </BotonAccion>
                </div>
              </>
            ) : (
              <>
                <Estado ok={false} si="" no="Configurada, falta conectar la cuenta" />
                <p className="text-muted-foreground">
                  En la aplicación de Mercado Libre, la URL de redirección tiene que ser <Vars>{urlCallback()}</Vars>.
                </p>
                <Button size="sm" asChild>
                  <a href={conBase("/api/mercadolibre/conectar")}>Conectar cuenta de Mercado Libre</a>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Avisos</CardTitle>
            <CardDescription>
              Las notificaciones siempre se ven en la campanita. Además pueden llegar por email y al celular.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Email</span>
                <Estado ok={emailConfigurado()} si="Activo" no="Sin configurar" />
              </div>
              <p className="text-muted-foreground">
                <Vars>SMTP_HOST</Vars>, <Vars>SMTP_PORT</Vars>, <Vars>SMTP_USER</Vars>, <Vars>SMTP_PASSWORD</Vars>, <Vars>SMTP_FROM</Vars>
              </p>
              {emailConfigurado() && <BotonAccion accion={emailDePrueba}>Mandarme un email de prueba</BotonAccion>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Push al celular</span>
                <Estado ok={pushConfigurado()} si="Activo" no="Sin configurar" />
              </div>
              <p className="text-muted-foreground">
                <Vars>VAPID_PUBLIC_KEY</Vars>, <Vars>VAPID_PRIVATE_KEY</Vars>, <Vars>VAPID_SUBJECT</Vars> (se generan con{" "}
                <Vars>npx web-push generate-vapid-keys</Vars>). Cada persona lo activa en «Notificaciones».
              </p>
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <span className="font-semibold">Pedidos trabados y entregas atrasadas</span>
              <p className="text-muted-foreground">Se revisan solos cada hora, de lunes a viernes de 8 a 19.</p>
              <BotonAccion accion={revisarAtrasosAhora}>Revisar ahora</BotonAccion>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Archivos</CardTitle>
            <CardDescription>Dónde se guardan los adjuntos, facturas y fotos de recepción.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <Estado ok={s3Configurado()} si="En almacenamiento S3 (fuera del servidor)" no="En el disco del servidor" />
            <p className="text-muted-foreground">
              Para guardarlos en Cloudflare R2, Backblaze B2 o AWS: <Vars>S3_BUCKET</Vars>, <Vars>S3_ENDPOINT</Vars>,{" "}
              <Vars>S3_ACCESS_KEY_ID</Vars>, <Vars>S3_SECRET_ACCESS_KEY</Vars>. Los que ya están en disco se pasan con{" "}
              <Vars>node scripts/migrar-archivos-s3.mjs</Vars>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[15.5px] font-bold">Monitoreo de errores</CardTitle>
            <CardDescription>Para enterarse de los errores antes de que los reporte alguien.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <Estado ok={!!process.env.SENTRY_DSN} si="Sentry activo" no="Sin configurar" />
            <p className="text-muted-foreground">
              Creá un proyecto en sentry.io y cargá <Vars>SENTRY_DSN</Vars>. Sin eso, los errores quedan solo en los logs del contenedor.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

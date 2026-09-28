CREATE TYPE "public"."estado_pedido" AS ENUM('Solicitado', 'Cotizando', 'Comprando', 'Entregado');--> statement-breakpoint
CREATE TYPE "public"."lista_opciones" AS ENUM('empresa', 'medio_compra', 'medio_pago', 'tipo_factura');--> statement-breakpoint
CREATE TYPE "public"."prioridad" AS ENUM('Baja', 'Media', 'Alta', 'Urgente');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'compras', 'sistemas');--> statement-breakpoint
CREATE TYPE "public"."tipo_adjunto" AS ENUM('referencia', 'factura');--> statement-breakpoint
CREATE TABLE "adjuntos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pedido_id" integer NOT NULL,
	"tipo" "tipo_adjunto" NOT NULL,
	"nombre" text NOT NULL,
	"mime" text NOT NULL,
	"tamano" integer NOT NULL,
	"ruta" text NOT NULL,
	"subido_por_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historial" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"usuario_id" integer,
	"accion" text NOT NULL,
	"detalle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"lista" "lista_opciones" NOT NULL,
	"valor" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"creado_por_id" integer,
	"solicitante" text NOT NULL,
	"sector" text NOT NULL,
	"facturar_por" text NOT NULL,
	"domicilio_entrega" text NOT NULL,
	"prioridad" "prioridad" DEFAULT 'Media' NOT NULL,
	"cantidad" integer NOT NULL,
	"producto" text NOT NULL,
	"link" text,
	"comentarios" text,
	"presupuesto" numeric(14, 2),
	"estado" "estado_pedido" DEFAULT 'Solicitado' NOT NULL,
	"estado_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"medio_compra" text,
	"proveedor" text,
	"cuit" text,
	"fecha_compra" date,
	"fecha_entrega" date,
	"codigo_seguimiento" text,
	"medio_pago" text,
	"cuotas" integer,
	"importe" numeric(14, 2),
	"factura_numero" text,
	"tipo_factura" text,
	"factura_link" text,
	"notas_compras" text,
	"cancelado" boolean DEFAULT false NOT NULL,
	"cancelado_en" timestamp with time zone,
	"cancelado_motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'sistemas' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_ingreso" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_subido_por_id_usuarios_id_fk" FOREIGN KEY ("subido_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial" ADD CONSTRAINT "historial_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historial" ADD CONSTRAINT "historial_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjuntos_pedido_idx" ON "adjuntos" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "historial_pedido_idx" ON "historial" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opciones_lista_valor_idx" ON "opciones" USING btree ("lista","valor");--> statement-breakpoint
CREATE INDEX "pedidos_estado_idx" ON "pedidos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "pedidos_created_idx" ON "pedidos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pedidos_fecha_compra_idx" ON "pedidos" USING btree ("fecha_compra");--> statement-breakpoint
CREATE INDEX "pedidos_creado_por_idx" ON "pedidos" USING btree ("creado_por_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_idx" ON "usuarios" USING btree ("email");
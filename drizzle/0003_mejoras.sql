-- Para los índices de búsqueda por similitud (viene con PostgreSQL; el usuario de la base es dueño y puede activarla).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TYPE "public"."rol" ADD VALUE 'recepcion';--> statement-breakpoint
ALTER TYPE "public"."tipo_adjunto" ADD VALUE 'recepcion';--> statement-breakpoint
CREATE TABLE "intentos_login" (
	"clave" text PRIMARY KEY NOT NULL,
	"fallos" integer DEFAULT 0 NOT NULL,
	"desde" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"pedido_id" integer,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"cuerpo" text,
	"leida_en" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripciones_push" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "fecha_estimada" date;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "calificacion" integer;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "comentario_recepcion" text;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notificaciones_usuario_idx" ON "notificaciones" USING btree ("usuario_id","created_at");--> statement-breakpoint
CREATE INDEX "suscripciones_push_usuario_idx" ON "suscripciones_push" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "pedidos_producto_trgm_idx" ON "pedidos" USING gin ("producto" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pedidos_proveedor_trgm_idx" ON "pedidos" USING gin ("proveedor" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "pedidos_solicitante_trgm_idx" ON "pedidos" USING gin ("solicitante" gin_trgm_ops);
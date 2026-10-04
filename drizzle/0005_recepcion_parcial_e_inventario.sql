CREATE TYPE "public"."estado_equipo" AS ENUM('en_uso', 'en_deposito', 'en_reparacion', 'baja');--> statement-breakpoint
CREATE TABLE "equipo_historial" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipo_id" integer NOT NULL,
	"usuario_id" integer,
	"accion" text NOT NULL,
	"detalle" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer,
	"pedido_item_id" integer,
	"descripcion" text NOT NULL,
	"numero_serie" text,
	"estado" "estado_equipo" DEFAULT 'en_uso' NOT NULL,
	"asignado_a" text,
	"sector" text,
	"ubicacion" text,
	"fecha_alta" date DEFAULT now() NOT NULL,
	"garantia_hasta" date,
	"notas" text,
	"creado_por_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido_items" ADD COLUMN "cantidad_recibida" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipo_historial" ADD CONSTRAINT "equipo_historial_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipo_historial" ADD CONSTRAINT "equipo_historial_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_pedido_item_id_pedido_items_id_fk" FOREIGN KEY ("pedido_item_id") REFERENCES "public"."pedido_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipo_historial_equipo_idx" ON "equipo_historial" USING btree ("equipo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipos_serie_idx" ON "equipos" USING btree ("numero_serie");--> statement-breakpoint
CREATE INDEX "equipos_pedido_idx" ON "equipos" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "equipos_estado_idx" ON "equipos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "equipos_descripcion_trgm_idx" ON "equipos" USING gin ("descripcion" gin_trgm_ops);--> statement-breakpoint
-- Lo que ya estaba entregado se considera recibido completo.
UPDATE "pedido_items" SET "cantidad_recibida" = "cantidad"
  WHERE "pedido_id" IN (SELECT "id" FROM "pedidos" WHERE "estado" = 'Entregado');

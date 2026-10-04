CREATE TABLE "integraciones" (
	"clave" text PRIMARY KEY NOT NULL,
	"datos" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"producto" text NOT NULL,
	"cantidad" integer NOT NULL,
	"link" text
);
--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "ml_orden" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "ml_envio_estado" text;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedido_items_pedido_idx" ON "pedido_items" USING btree ("pedido_id","orden");--> statement-breakpoint
-- Los pedidos que ya existían pasan a tener un ítem con su producto, cantidad y link.
INSERT INTO "pedido_items" ("pedido_id", "orden", "producto", "cantidad", "link")
  SELECT "id", 0, "producto", "cantidad", "link" FROM "pedidos";

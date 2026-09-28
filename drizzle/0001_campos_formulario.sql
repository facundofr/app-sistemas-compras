ALTER TYPE "public"."lista_opciones" ADD VALUE 'solicitante_sector';--> statement-breakpoint
ALTER TYPE "public"."lista_opciones" ADD VALUE 'domicilio';--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "fecha_pedido" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "solicitante_sector" text;--> statement-breakpoint
-- Los pedidos existentes toman como fecha de pedido la fecha en que se cargaron.
UPDATE "pedidos" SET "fecha_pedido" = ("created_at" AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

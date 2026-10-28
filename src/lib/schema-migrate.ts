import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Creates every table the shop needs if it is missing. Safe to run on every
 * cold start: all statements are idempotent, so an existing database is left
 * exactly as it is. This is what lets a brand-new Neon database come up ready
 * without a separate migration step.
 */
const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"product_slug" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"country" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"shipping_method" text NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"category" text NOT NULL,
	"collection" text NOT NULL,
	"collections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"period" text,
	"locality" text NOT NULL,
	"formation" text,
	"length_mm" integer,
	"preparation" text NOT NULL,
	"price_cents" integer NOT NULL,
	"compare_at_cents" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"listing_channel" text DEFAULT 'direct' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"external_listing_url" text,
	"video_url" text,
	"last_price_check" timestamp with time zone,
	"has_certificate" boolean DEFAULT false NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"provenance" text NOT NULL,
	"images" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"author_country" text NOT NULL,
	"rating" smallint NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"verified_purchase" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hero_eyebrow" text NOT NULL,
	"hero_title" text NOT NULL,
	"hero_title_italic" text NOT NULL,
	"hero_description" text NOT NULL,
	"provenance_eyebrow" text NOT NULL,
	"provenance_title" text NOT NULL,
	"provenance_title_italic" text NOT NULL,
	"provenance_body" text NOT NULL,
	"years_experience" integer DEFAULT 23 NOT NULL,
	"feedbacks_label" text DEFAULT '5,000+' NOT NULL,
	"ebay_url" text DEFAULT '' NOT NULL,
	"catawiki_url" text DEFAULT '' NOT NULL,
	"instagram_url" text DEFAULT '' NOT NULL,
	"facebook_url" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT 'mediterranean.world@gmail.com' NOT NULL,
	"trustami_url" text DEFAULT '' NOT NULL,
	"trustami_rating" text DEFAULT '4.98/5' NOT NULL,
	"trustami_ratings" text DEFAULT '200' NOT NULL,
	"whatsapp_phone" text DEFAULT '' NOT NULL,
	"provenance_image" text DEFAULT '' NOT NULL,
	"hero_image" text DEFAULT '/images/hero.jpg' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "uploaded_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"data_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

let migrated: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      await db.execute(sql.raw(SCHEMA_SQL));
    })().catch((error) => {
      migrated = null;
      throw error;
    });
  }
  return migrated;
}

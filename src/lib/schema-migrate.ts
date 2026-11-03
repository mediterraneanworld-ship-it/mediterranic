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

/** Column changes made after the first deployment — all idempotent. */
const UPGRADE_SQL = `
ALTER TABLE "products" ALTER COLUMN "listing_channel" DROP NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "site_only_price_cents" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "last_price_check" timestamp with time zone;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "has_certificate" boolean DEFAULT false NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "hero_image" text DEFAULT '/images/hero.jpg' NOT NULL;

-- Newsletter (public sign-up form in the footer). Brand-new table: it is only
-- created when missing, so existing subscriber rows are never touched.
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'footer' NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);

-- Editable page texts & photographs. One jsonb document; the code merges it
-- over the defaults, so adding the column never blanks an existing page and
-- nothing already written in the back-office is overwritten.
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "content" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- PayPal: how the order was paid and the PayPal order reference. New columns
-- only; existing orders keep their default values and are never rewritten.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text DEFAULT 'direct' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paypal_order_id" text;

-- Log of every price check (automatic or manual). New table only.
CREATE TABLE IF NOT EXISTS "price_check_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"checked" integer DEFAULT 0 NOT NULL,
	"changed" integer DEFAULT 0 NOT NULL,
	"ended" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);

-- Preserve the log table used by the published 39e76ca deployment.
CREATE TABLE IF NOT EXISTS "price_refresh_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "ok" boolean DEFAULT true NOT NULL,
  "checked" integer DEFAULT 0 NOT NULL,
  "changed" integer DEFAULT 0 NOT NULL,
  "ended" integer DEFAULT 0 NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "ran_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Additive only: no backfill, deletion or overwrite of shop data.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ebay_listing_url" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "catawiki_listing_url" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketplace_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "specimen_reference" text;


CREATE TABLE IF NOT EXISTS "inventory_sync_state" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "lease_expires_at" timestamp with time zone,
  "report" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketplace_active" boolean;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_grams" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "marketplace_checked_at" timestamp with time zone;

-- Order notifications to the curator. New table only: no order is changed or
-- deleted by an e-mail that could not be delivered, and retries are idempotent.
CREATE TABLE IF NOT EXISTS "order_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" uuid NOT NULL,
  "event" text NOT NULL,
  "channel" text DEFAULT 'email' NOT NULL,
  "recipient" text NOT NULL,
  "status" text NOT NULL,
  "detail" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone
);

-- Buyer note left at checkout. Additive: existing orders keep NULL.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_note" text;

-- Tracking link sent to the buyer. Additive only.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_sent_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "order_notifications_order_event"
  ON "order_notifications" ("order_id", "event");

`;

let migrated: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!migrated) {
    migrated = (async () => {
      await db.execute(sql.raw(SCHEMA_SQL));
      await db.execute(sql.raw(UPGRADE_SQL));
    })().catch((error) => {
      migrated = null;
      throw error;
    });
  }
  return migrated;
}

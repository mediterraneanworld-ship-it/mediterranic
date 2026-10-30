import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type ProductImage = {
  src: string;
  alt: string;
  label: string;
  /** Optional macro crop: focal point in % and magnification */
  zoom?: { x: number; y: number; scale: number };
  /** Rotation in degrees (0 / 90 / 180 / 270) and mirroring, set in the back-office */
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
};

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  species: text("species").notNull(),
  category: text("category").notNull(), // specimen | accessory
  /** Kept for backwards compatibility: the primary (era) collection. */
  collection: text("collection").notNull(), // see lib/collections.ts
  /** Every collection this piece belongs to — a piece may sit in several. */
  collections: jsonb("collections").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  period: text("period"), // Ordovician | Devonian
  locality: text("locality").notNull(),
  formation: text("formation"),
  lengthMm: integer("length_mm"),
  preparation: text("preparation").notNull(),
  priceCents: integer("price_cents").notNull(),
  compareAtCents: integer("compare_at_cents"),
  stock: integer("stock").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  /** Null when the piece is not currently offered on any channel (e.g. an ended auction). */
  listingChannel: text("listing_channel"),
  published: boolean("published").notNull().default(true),
  externalListingUrl: text("external_listing_url"),
  /** Optional YouTube / Vimeo link shown on the product page */
  videoUrl: text("video_url"),
  /** When the marketplace price was last checked automatically */
  lastPriceCheck: timestamp("last_price_check", { withTimezone: true }),
  /** Not every specimen is sold with a certificate — ticked per piece. */
  hasCertificate: boolean("has_certificate").notNull().default(false),
  /** Price used automatically when an auction ends unsold and the piece returns to Site Only. */
  siteOnlyPriceCents: integer("site_only_price_cents"),
  /** Sold pieces shown (without price) in the public archive. */
  archived: boolean("archived").notNull().default(false),
  shortDescription: text("short_description").notNull(),
  description: text("description").notNull(),
  provenance: text("provenance").notNull(),
  images: jsonb("images").$type<ProductImage[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorCountry: text("author_country").notNull(),
  rating: smallint("rating").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  country: text("country").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  shippingMethod: text("shipping_method").notNull(),
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productSlug: text("product_slug").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  heroEyebrow: text("hero_eyebrow").notNull(),
  heroTitle: text("hero_title").notNull(),
  heroTitleItalic: text("hero_title_italic").notNull(),
  heroDescription: text("hero_description").notNull(),
  provenanceEyebrow: text("provenance_eyebrow").notNull(),
  provenanceTitle: text("provenance_title").notNull(),
  provenanceTitleItalic: text("provenance_title_italic").notNull(),
  provenanceBody: text("provenance_body").notNull(),
  yearsExperience: integer("years_experience").notNull().default(23),
  feedbacksLabel: text("feedbacks_label").notNull().default("5,000+"),
  ebayUrl: text("ebay_url").notNull().default(""),
  catawikiUrl: text("catawiki_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  contactEmail: text("contact_email").notNull().default("mediterranean.world@gmail.com"),
  trustamiUrl: text("trustami_url").notNull().default(""),
  trustamiRating: text("trustami_rating").notNull().default("4.98/5"),
  trustamiRatings: text("trustami_ratings").notNull().default("200"),
  whatsappPhone: text("whatsapp_phone").notNull().default(""),
  provenanceImage: text("provenance_image").notNull().default(""),
  heroImage: text("hero_image").notNull().default("/images/hero.jpg"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploadedImages = pgTable("uploaded_images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Newsletter sign-ups collected on the public storefront. Append-only: a
 * subscriber is never deleted by a deploy, only by an explicit admin action.
 */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** Where the sign-up came from: "footer", "shipping", "admin"… */
  source: text("source").notNull().default("footer"),
  /** Reserved for a future double opt-in; today a sign-up is confirmed on the spot. */
  confirmed: boolean("confirmed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ many }) => ({
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

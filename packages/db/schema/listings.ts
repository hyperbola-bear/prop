import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";
import { addresses } from "./addresses";
import { lifecycleColumns, tsvector } from "./common";
import { users } from "./users";

export type ListingStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "published"
  | "paused"
  | "expired"
  | "rented"
  | "delisted"
  | "removed"
  | "flagged";

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    agentUserId: uuid("agent_user_id").references(() => users.id),
    addressId: uuid("address_id").references(() => addresses.id),
    status: text("status").$type<ListingStatus>().default("draft").notNull(),
    listingType: text("listing_type").default("rental").notNull(),
    propertyType: text("property_type").default("hdb").notNull(),
    representedVia: text("represented_via").default("owner").notNull(),
    title: text("title").notNull(),
    slug: text("slug"),
    description: text("description"),
    priceSgd: bigint("price_sgd", { mode: "bigint" }).notNull(),
    priceUnit: text("price_unit").default("month").notNull(),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    sellerOwnershipVerified: boolean("seller_ownership_verified").default(false).notNull(),
    searchVector: tsvector("search_vector"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
    rentedAt: timestamp("rented_at", { withTimezone: true }),
    delistedAt: timestamp("delisted_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [
    index("listings_status_idx").on(table.status),
    index("listings_owner_user_idx").on(table.ownerUserId),
    index("listings_agent_user_idx").on(table.agentUserId),
    index("listings_published_at_idx").on(table.publishedAt),
    index("listings_search_idx").using("gin", table.searchVector),
    check(
      "listings_status_check",
      sql`${table.status} in ('draft', 'pending_verification', 'active', 'published', 'paused', 'expired', 'rented', 'delisted', 'removed', 'flagged')`
    ),
    check(
      "listings_listing_type_check",
      sql`${table.listingType} in ('rental', 'room', 'sale')`
    ),
    check(
      "listings_property_type_check",
      sql`${table.propertyType} in ('hdb', 'condo', 'landed')`
    ),
    check(
      "listings_represented_via_check",
      sql`${table.representedVia} in ('owner', 'agent_mandate', 'agent_no_mandate')`
    )
  ]
);

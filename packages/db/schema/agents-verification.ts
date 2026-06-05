import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { addresses } from "./addresses";
import { lifecycleColumns } from "./common";
import { listings } from "./listings";
import { users } from "./users";

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ceaRegistrationNo: text("cea_registration_no").notNull(),
    ceaStatus: text("cea_status"),
    agencyName: text("agency_name"),
    agencyLicenceNo: text("agency_licence_no"),
    photoS3Key: text("photo_s3_key"),
    bio: text("bio"),
    specialties: text("specialties").array().default(sql`'{}'::text[]`).notNull(),
    languages: text("languages").array().default(sql`'{}'::text[]`).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lifetimeListingsCount: integer("lifetime_listings_count").default(0).notNull(),
    responseStats: jsonb("response_stats"),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("agent_profiles_user_unique").on(table.userId)
  ]
);

export const sellerPropertyVerifications = pgTable(
  "seller_property_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sellerUserId: uuid("seller_user_id")
      .notNull()
      .references(() => users.id),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    addressId: uuid("address_id").references(() => addresses.id),
    documentS3Key: text("document_s3_key").notNull(),
    status: text("status").default("pending").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    ...lifecycleColumns()
  },
  (table) => [
    check(
      "seller_property_verifications_status_check",
      sql`${table.status} in ('pending', 'approved', 'rejected')`
    )
  ]
);

export const listingMandates = pgTable(
  "listing_mandates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sellerUserId: uuid("seller_user_id")
      .notNull()
      .references(() => users.id),
    agentUserId: uuid("agent_user_id")
      .notNull()
      .references(() => users.id),
    mandateVia: text("mandate_via").notNull(),
    status: text("status").default("pending").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("listing_mandates_listing_agent_unique").on(table.listingId, table.agentUserId),
    check(
      "listing_mandates_status_check",
      sql`${table.status} in ('pending', 'active', 'revoked', 'expired')`
    )
  ]
);

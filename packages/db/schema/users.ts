import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { lifecycleColumns } from "./common";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    passwordHash: text("password_hash"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    pdpaConsentAt: timestamp("pdpa_consent_at", { withTimezone: true }),
    myinfoPayload: jsonb("myinfo_payload"),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_phone_e164_unique").on(table.phoneE164)
  ]
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("user_roles_user_role_unique").on(table.userId, table.role),
    check(
      "user_roles_role_check",
      sql`${table.role} in ('admin', 'buyer', 'seller', 'agent')`
    )
  ]
);

export const buyerProfiles = pgTable("buyer_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredName: text("preferred_name"),
  householdSize: text("household_size"),
  employerName: text("employer_name"),
  preferredContactMethod: text("preferred_contact_method").default("email").notNull(),
  moveInWindowStart: date("move_in_window_start"),
  moveInWindowEnd: date("move_in_window_end"),
  ...lifecycleColumns()
});

export const sellerProfiles = pgTable("seller_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  isCompany: boolean("is_company").default(false).notNull(),
  uen: text("uen"),
  preferredContactMethod: text("preferred_contact_method").default("email").notNull(),
  ...lifecycleColumns()
});

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  phoneE164: text("phone_e164").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  attempts: integer("attempts").default(0).notNull(),
  ...lifecycleColumns()
});

export const requestLogs = pgTable(
  "request_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bucketKey: text("bucket_key").notNull(),
    action: text("action").notNull(),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("request_logs_bucket_action_created_idx").on(
      table.bucketKey,
      table.action,
      table.createdAt
    )
  ]
);

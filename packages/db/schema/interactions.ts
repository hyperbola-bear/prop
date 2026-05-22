import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { lifecycleColumns } from "./common";
import { listings } from "./listings";
import { users } from "./users";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id),
    sellerUserId: uuid("seller_user_id")
      .notNull()
      .references(() => users.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("conversations_listing_buyer_seller_unique").on(
      table.listingId,
      table.buyerUserId,
      table.sellerUserId
    )
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    scamFlags: text("scam_flags").array().default(sql`'{}'::text[]`).notNull(),
    scamScore: smallint("scam_score").default(0).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
    check("messages_scam_score_check", sql`${table.scamScore} between 0 and 100`)
  ]
);

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    slaBreachedAt: timestamp("sla_breached_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [index("enquiries_listing_buyer_idx").on(table.listingId, table.buyerUserId)]
);

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  query: jsonb("query").notNull(),
  notifyEmail: boolean("notify_email").default(true).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  ...lifecycleColumns()
});

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    ...lifecycleColumns()
  },
  (table) => [uniqueIndex("favorites_user_listing_unique").on(table.userId, table.listingId)]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    body: text("body"),
    status: text("status").default("open").notNull(),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...lifecycleColumns()
  },
  (table) => [
    index("reports_status_idx").on(table.status),
    check(
      "reports_target_type_check",
      sql`${table.targetType} in ('listing', 'message', 'agent', 'user')`
    ),
    check(
      "reports_status_check",
      sql`${table.status} in ('open', 'reviewing', 'resolved', 'dismissed')`
    )
  ]
);

export const agentReviews = pgTable(
  "agent_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentUserId: uuid("agent_user_id")
      .notNull()
      .references(() => users.id),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id),
    stars: integer("stars").notNull(),
    body: text("body").notNull(),
    reviewType: text("review_type").notNull(),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("agent_reviews_agent_reviewer_unique").on(table.agentUserId, table.reviewerUserId),
    check("agent_reviews_stars_check", sql`${table.stars} between 1 and 5`),
    check(
      "agent_reviews_review_type_check",
      sql`${table.reviewType} in ('verified', 'unverified')`
    )
  ]
);

export const emailQueue = pgTable("email_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  ...lifecycleColumns()
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  metadata: jsonb("metadata"),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...lifecycleColumns()
});

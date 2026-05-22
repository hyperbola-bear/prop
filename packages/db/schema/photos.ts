import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { lifecycleColumns } from "./common";
import { listings } from "./listings";
import { users } from "./users";

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    s3Key: text("s3_key").notNull(),
    thumbnailS3Key: text("thumbnail_s3_key"),
    altText: text("alt_text").notNull(),
    caption: text("caption"),
    sortOrder: integer("sort_order").default(0).notNull(),
    roomTag: text("room_tag"),
    width: integer("width"),
    height: integer("height"),
    blurhash: text("blurhash"),
    perceptualHash: text("perceptual_hash"),
    exif: jsonb("exif"),
    isCover: boolean("is_cover").default(false).notNull(),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("listing_photos_listing_sort_unique").on(table.listingId, table.sortOrder),
    check(
      "listing_photos_room_tag_check",
      sql`${table.roomTag} is null or ${table.roomTag} in ('Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Balcony', 'Exterior', 'Floor plan')`
    )
  ]
);

export const listingPhotoVariants = pgTable("listing_photo_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  photoId: uuid("photo_id")
    .notNull()
    .references(() => listingPhotos.id, { onDelete: "cascade" }),
  variant: text("variant").notNull(),
  s3Key: text("s3_key").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  byteSize: integer("byte_size"),
  ...lifecycleColumns()
});

export const listingFloorPlans = pgTable("listing_floor_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  s3Key: text("s3_key").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  width: integer("width"),
  height: integer("height"),
  ...lifecycleColumns()
});

export const listingFloorPlanZones = pgTable(
  "listing_floor_plan_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    floorPlanId: uuid("floor_plan_id")
      .notNull()
      .references(() => listingFloorPlans.id, { onDelete: "cascade" }),
    roomTag: text("room_tag").notNull(),
    polygonGeojson: jsonb("polygon_geojson"),
    bbox: jsonb("bbox"),
    ...lifecycleColumns()
  },
  (table) => [
    check(
      "listing_floor_plan_zones_room_tag_check",
      sql`${table.roomTag} in ('Living', 'Kitchen', 'Bedroom', 'Bathroom', 'Balcony', 'Utility', 'Store')`
    )
  ]
);

export const listingEvents = pgTable("listing_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const uploadSessions = pgTable("upload_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  contentType: text("content_type").notNull(),
  s3Key: text("s3_key").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...lifecycleColumns()
});

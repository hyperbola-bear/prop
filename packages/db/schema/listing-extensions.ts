import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  uuid
} from "drizzle-orm/pg-core";
import { blocks, projects, units } from "./addresses";
import { lifecycleColumns } from "./common";
import { listings } from "./listings";

export const listingRental = pgTable(
  "listing_rental",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    leaseMonths: integer("lease_months").notNull(),
    availableFrom: date("available_from").notNull(),
    furnishing: text("furnishing").notNull(),
    roomOnly: boolean("room_only").default(false).notNull(),
    depositSgd: bigint("deposit_sgd", { mode: "bigint" }),
    utilitiesIncluded: boolean("utilities_included").default(false).notNull(),
    petAllowed: boolean("pet_allowed").default(false).notNull(),
    cookingAllowed: boolean("cooking_allowed").default(true).notNull(),
    smokingAllowed: boolean("smoking_allowed").default(false).notNull(),
    genderPreference: text("gender_preference"),
    tenantRacePreference: text("tenant_race_preference"),
    visaPreference: text("visa_preference"),
    tenancyTerms: jsonb("tenancy_terms"),
    ...lifecycleColumns()
  },
  (table) => [
    check("listing_rental_lease_months_check", sql`${table.leaseMonths} between 1 and 36`),
    check(
      "listing_rental_furnishing_check",
      sql`${table.furnishing} in ('Unfurnished', 'Partial', 'Fully')`
    )
  ]
);

export const listingRoom = pgTable("listing_room", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  roomType: text("room_type").notNull(),
  roomTag: text("room_tag"),
  ensuiteBathroom: boolean("ensuite_bathroom").default(false).notNull(),
  maxOccupants: integer("max_occupants").default(1).notNull(),
  floorAreaSqft: integer("floor_area_sqft"),
  ...lifecycleColumns()
});

export const listingSale = pgTable("listing_sale", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  askingPriceSgd: bigint("asking_price_sgd", { mode: "bigint" }).notNull(),
  valuationPriceSgd: bigint("valuation_price_sgd", { mode: "bigint" }),
  optionFeeSgd: bigint("option_fee_sgd", { mode: "bigint" }),
  completionTimeline: text("completion_timeline"),
  saleTenureRemainingMonths: integer("sale_tenure_remaining_months"),
  ...lifecycleColumns()
});

export const listingHdb = pgTable(
  "listing_hdb",
  {
    listingId: uuid("listing_id")
      .primaryKey()
      .references(() => listings.id, { onDelete: "cascade" }),
    flatType: text("flat_type").notNull(),
    flatModel: text("flat_model"),
    floorLevelBand: text("floor_level_band"),
    floorAreaSqft: integer("floor_area_sqft").notNull(),
    blockId: uuid("block_id").references(() => blocks.id),
    unitId: uuid("unit_id").references(() => units.id),
    leaseCommenceYear: integer("lease_commence_year"),
    ethnicQuotaEligible: boolean("ethnic_quota_eligible"),
    ...lifecycleColumns()
  },
  (table) => [
    check(
      "listing_hdb_flat_type_check",
      sql`${table.flatType} in ('1-room', '2-room', '3-room', '4-room', '5-room', 'Executive')`
    ),
    check(
      "listing_hdb_floor_level_band_check",
      sql`${table.floorLevelBand} is null or ${table.floorLevelBand} in ('low', 'mid', 'high')`
    )
  ]
);

export const listingCondo = pgTable("listing_condo", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id),
  unitId: uuid("unit_id").references(() => units.id),
  unitType: text("unit_type"),
  floorAreaSqft: integer("floor_area_sqft"),
  balconySqft: integer("balcony_sqft"),
  maintenanceFeeSgd: bigint("maintenance_fee_sgd", { mode: "bigint" }),
  facilities: jsonb("facilities"),
  ...lifecycleColumns()
});

export const listingLanded = pgTable("listing_landed", {
  listingId: uuid("listing_id")
    .primaryKey()
    .references(() => listings.id, { onDelete: "cascade" }),
  landedType: text("landed_type").notNull(),
  landAreaSqft: integer("land_area_sqft"),
  builtUpSqft: integer("built_up_sqft"),
  storeys: integer("storeys"),
  tenure: text("tenure"),
  parkingSpaces: integer("parking_spaces"),
  ...lifecycleColumns()
});

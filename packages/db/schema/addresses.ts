import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { geographyPoint, lifecycleColumns } from "./common";

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    line1: text("line_1").notNull(),
    line2: text("line_2"),
    block: text("block"),
    street: text("street").notNull(),
    building: text("building"),
    unitNumber: text("unit_number"),
    postalCode: text("postal_code"),
    town: text("town").notNull(),
    district: text("district"),
    countryCode: text("country_code").default("SG").notNull(),
    latitude: text("latitude"),
    longitude: text("longitude"),
    location: geographyPoint("location"),
    ...lifecycleColumns()
  },
  (table) => [
    index("addresses_town_idx").on(table.town),
    index("addresses_location_idx").using("gist", table.location)
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    projectType: text("project_type").notNull(),
    tenure: text("tenure"),
    completionYear: integer("completion_year"),
    developerName: text("developer_name"),
    addressId: uuid("address_id").references(() => addresses.id),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("projects_name_unique").on(table.name),
    check(
      "projects_project_type_check",
      sql`${table.projectType} in ('hdb', 'condo', 'landed', 'mixed')`
    )
  ]
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").references(() => projects.id),
    addressId: uuid("address_id").references(() => addresses.id),
    blockNo: text("block_no").notNull(),
    streetName: text("street_name").notNull(),
    postalCode: text("postal_code"),
    town: text("town").notNull(),
    totalFloors: integer("total_floors"),
    hdbTownCode: text("hdb_town_code"),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("blocks_block_street_town_unique").on(
      table.blockNo,
      table.streetName,
      table.town
    ),
    index("blocks_town_idx").on(table.town)
  ]
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockId: uuid("block_id").references(() => blocks.id),
    addressId: uuid("address_id").references(() => addresses.id),
    unitNo: text("unit_no"),
    floorNo: integer("floor_no"),
    stackNo: text("stack_no"),
    floorLevelBand: text("floor_level_band"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    floorAreaSqft: integer("floor_area_sqft"),
    ...lifecycleColumns()
  },
  (table) => [
    uniqueIndex("units_block_unit_unique").on(table.blockId, table.unitNo),
    check(
      "units_floor_level_band_check",
      sql`${table.floorLevelBand} is null or ${table.floorLevelBand} in ('low', 'mid', 'high')`
    )
  ]
);

export const amenities = pgTable(
  "amenities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    amenityType: text("amenity_type").notNull(),
    addressId: uuid("address_id").references(() => addresses.id),
    location: geographyPoint("location"),
    isActive: boolean("is_active").default(true).notNull(),
    source: text("source").default("manual").notNull(),
    ...lifecycleColumns()
  },
  (table) => [
    index("amenities_type_idx").on(table.amenityType),
    index("amenities_location_idx").using("gist", table.location)
  ]
);

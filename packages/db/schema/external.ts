import {
  sql,
} from "drizzle-orm";
import {
  bigint,
  bigserial,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { geometryPoint, timestamps } from "./common";

export const external = pgSchema("external");

export const hdbResaleTransactions = external.table(
  "hdb_resale_transactions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    month: date("month").notNull(),
    town: text("town").notNull(),
    flatType: text("flat_type").notNull(),
    block: text("block").notNull(),
    streetName: text("street_name").notNull(),
    storeyRange: text("storey_range"),
    floorAreaSqm: integer("floor_area_sqm"),
    flatModel: text("flat_model"),
    leaseCommenceDate: integer("lease_commence_date"),
    remainingLease: text("remaining_lease"),
    resalePriceSgd: bigint("resale_price_sgd", { mode: "bigint" }).notNull(),
    sourcePayload: jsonb("source_payload"),
    ...timestamps()
  },
  (table) => [
    index("hdb_resale_transactions_town_flat_idx").on(table.town, table.flatType),
    index("hdb_resale_transactions_month_idx").on(table.month)
  ]
);

export const uraPrivateTransactions = external.table(
  "ura_private_transactions",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    projectName: text("project_name").notNull(),
    streetName: text("street_name"),
    propertyType: text("property_type"),
    saleDate: date("sale_date").notNull(),
    transactedPriceSgd: bigint("transacted_price_sgd", { mode: "bigint" }).notNull(),
    areaSqft: integer("area_sqft"),
    unitPricePsfSgd: bigint("unit_price_psf_sgd", { mode: "bigint" }),
    tenure: text("tenure"),
    postalDistrict: text("postal_district"),
    sourcePayload: jsonb("source_payload"),
    ...timestamps()
  },
  (table) => [index("ura_private_transactions_project_date_idx").on(table.projectName, table.saleDate)]
);

export const uraRentalMedians = external.table(
  "ura_rental_medians",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    quarter: text("quarter").notNull(),
    district: text("district").notNull(),
    propertyType: text("property_type").notNull(),
    bedrooms: integer("bedrooms"),
    medianRentSgd: bigint("median_rent_sgd", { mode: "bigint" }).notNull(),
    sampleSize: integer("sample_size"),
    sourcePayload: jsonb("source_payload"),
    ...timestamps()
  },
  (table) => [
    uniqueIndex("ura_rental_medians_unique").on(
      table.quarter,
      table.district,
      table.propertyType,
      table.bedrooms
    )
  ]
);

export const ceaRegisterSnapshots = external.table(
  "cea_register_snapshots",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    registrationNo: text("registration_no").notNull(),
    name: text("name").notNull(),
    agencyName: text("agency_name").notNull(),
    agencyLicenceNo: text("agency_licence_no"),
    status: text("status").notNull(),
    firstRegisteredDate: date("first_registered_date"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow().notNull(),
    sourcePayload: jsonb("source_payload"),
    ...timestamps()
  },
  (table) => [
    uniqueIndex("cea_register_snapshots_registration_snapshot_unique").on(
      table.registrationNo,
      table.snapshotAt
    ),
    index("cea_register_snapshots_registration_idx").on(table.registrationNo)
  ]
);

export const onemapAmenities = external.table(
  "onemap_amenities",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    name: text("name").notNull(),
    amenityType: text("amenity_type").notNull(),
    address: text("address"),
    postalCode: text("postal_code"),
    lines: text("lines").array().default(sql`'{}'::text[]`).notNull(),
    geom: geometryPoint("geom").notNull(),
    source: text("source").default("onemap").notNull(),
    sourcePayload: jsonb("source_payload"),
    ...timestamps()
  },
  (table) => [
    uniqueIndex("onemap_amenities_name_type_unique").on(table.name, table.amenityType),
    index("onemap_amenities_type_idx").on(table.amenityType),
    index("onemap_amenities_geom_idx").using("gist", table.geom)
  ]
);

import { customType, timestamp } from "drizzle-orm/pg-core";

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const lifecycleColumns = () => ({
  ...timestamps(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  }
});

export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  }
});

export const geometryPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Point,4326)";
  }
});

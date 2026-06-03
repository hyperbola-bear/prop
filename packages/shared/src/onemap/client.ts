import { ilike, or, sql } from "drizzle-orm";
import { onemapAmenities } from "@proppy/db";
import { getOneMapDb } from "./db";
import { getOneMapToken, hasOneMapCredentials } from "./token-cache";

const SEARCH_ENDPOINT = "https://www.onemap.gov.sg/api/common/elastic/search";

export type OneMapResult = {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
};

type SeedAmenityRow = {
  name: string;
  address: string | null;
  postalCode: string | null;
  latitude: string;
  longitude: string;
};

type OneMapApiResult = Partial<Record<keyof OneMapResult, unknown>>;

function normalizeResult(result: OneMapApiResult): OneMapResult {
  const searchValue = String(result.SEARCHVAL ?? "");
  const address = String(result.ADDRESS ?? searchValue);
  return {
    SEARCHVAL: searchValue,
    BLK_NO: String(result.BLK_NO ?? ""),
    ROAD_NAME: String(result.ROAD_NAME ?? ""),
    BUILDING: String(result.BUILDING ?? searchValue),
    ADDRESS: address,
    POSTAL: String(result.POSTAL ?? ""),
    LATITUDE: String(result.LATITUDE ?? ""),
    LONGITUDE: String(result.LONGITUDE ?? "")
  };
}

function mapSeedAmenity(row: SeedAmenityRow): OneMapResult {
  return {
    SEARCHVAL: row.name,
    BLK_NO: "",
    ROAD_NAME: "",
    BUILDING: row.name,
    ADDRESS: row.address ?? row.name,
    POSTAL: row.postalCode ?? "",
    LATITUDE: row.latitude,
    LONGITUDE: row.longitude
  };
}

async function searchSeedAmenities(query: string): Promise<OneMapResult[]> {
  const pattern = `%${query}%`;
  const rows = await getOneMapDb()
    .select({
      name: onemapAmenities.name,
      address: onemapAmenities.address,
      postalCode: onemapAmenities.postalCode,
      latitude: sql<string>`ST_Y(${onemapAmenities.geom}::geometry)::text`,
      longitude: sql<string>`ST_X(${onemapAmenities.geom}::geometry)::text`
    })
    .from(onemapAmenities)
    .where(or(ilike(onemapAmenities.name, pattern), ilike(onemapAmenities.address, pattern)))
    .limit(10);

  return rows.map(mapSeedAmenity);
}

async function searchOneMap(query: string): Promise<OneMapResult[]> {
  const token = await getOneMapToken();
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("searchVal", query);
  url.searchParams.set("returnGeom", "Y");
  url.searchParams.set("getAddrDetails", "Y");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`OneMap search request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { results?: unknown };
  if (!Array.isArray(body.results)) {
    return [];
  }

  return body.results.map((result) => normalizeResult(result as OneMapApiResult));
}

export async function search(query: string): Promise<OneMapResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  if (!hasOneMapCredentials()) {
    return searchSeedAmenities(trimmed);
  }

  return searchOneMap(trimmed);
}

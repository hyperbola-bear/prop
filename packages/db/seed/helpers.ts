import { createHash } from "node:crypto";
import argon2 from "argon2";

export type CeaRegisterRow = {
  registrationNo: string;
  name: string;
  agencyName: string;
  agencyLicenceNo: string;
  status: string;
  firstRegisteredDate: string;
};

export type MrtStationRow = {
  name: string;
  lng: number;
  lat: number;
  lines: string[];
};

export const SEED_PASSWORD = "Test!234";

export async function hashSeedPassword(password = SEED_PASSWORD): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((header) => header.trim());
  return rows.map((row) => {
    const values = row.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function parseCEACsv(csv: string): CeaRegisterRow[] {
  return parseCsvRows(csv).map((row) => ({
    registrationNo: row.registration_no ?? "",
    name: row.name ?? "",
    agencyName: row.agency_name ?? "",
    agencyLicenceNo: row.agency_licence_no ?? "",
    status: row.status ?? "",
    firstRegisteredDate: row.first_registered_date ?? ""
  }));
}

export function parseMrtStationsCsv(csv: string): MrtStationRow[] {
  return parseCsvRows(csv).map((row) => ({
    name: row.name ?? "",
    lng: Number(row.lng),
    lat: Number(row.lat),
    lines: row.lines ? row.lines.split("|").map((line) => line.trim()).filter(Boolean) : []
  }));
}

export function coordsToGeometrySql(lng: number, lat: number): string {
  return `ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)`;
}

export function stableUuid(input: string): string {
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  const variant = Number.parseInt(hash[16] ?? "0", 16);
  hash[16] = ((variant & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8).join("")}-${hash.slice(8, 12).join("")}-${hash
    .slice(12, 16)
    .join("")}-${hash.slice(16, 20).join("")}-${hash.slice(20, 32).join("")}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

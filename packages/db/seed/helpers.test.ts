import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import {
  coordsToGeometrySql,
  hashSeedPassword,
  parseCEACsv,
  parseMrtStationsCsv,
  stableUuid
} from "./helpers";

describe("seed helpers", () => {
  it("hashSeedPassword produces an argon2id hash that verifies the seed password", async () => {
    const hash = await hashSeedPassword("Test!234");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(argon2.verify(hash, "Test!234")).resolves.toBe(true);
  });

  it("parseCEACsv maps CEA snapshot rows to seed objects", () => {
    const rows = parseCEACsv(
      "registration_no,name,agency_name,agency_licence_no,status,first_registered_date\nR012345A,Alicia Tan,PropNex Realty Pte Ltd,L3009250J,active,2018-03-15"
    );

    expect(rows).toEqual([
      {
        registrationNo: "R012345A",
        name: "Alicia Tan",
        agencyName: "PropNex Realty Pte Ltd",
        agencyLicenceNo: "L3009250J",
        status: "active",
        firstRegisteredDate: "2018-03-15"
      }
    ]);
  });

  it("parseMrtStationsCsv parses lng before lat and pipe-delimited lines", () => {
    const [station] = parseMrtStationsCsv("name,lng,lat,lines\nTampines,103.9451,1.3533,EWL|DTL");

    expect(station).toEqual({
      name: "Tampines",
      lng: 103.9451,
      lat: 1.3533,
      lines: ["EWL", "DTL"]
    });
  });

  it("coordsToGeometrySql emits ST_SetSRID(ST_MakePoint(lng,lat),4326)", () => {
    expect(coordsToGeometrySql(103.9451, 1.3533)).toBe(
      "ST_SetSRID(ST_MakePoint(103.9451,1.3533),4326)"
    );
  });

  it("stableUuid returns repeatable UUIDs for idempotent fixtures", () => {
    expect(stableUuid("listing:tampines")).toBe(stableUuid("listing:tampines"));
    expect(stableUuid("listing:tampines")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

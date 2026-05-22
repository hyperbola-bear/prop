import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("checks database, storage, and mail dependencies", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      db: "ok",
      storage: "ok",
      mail: "ok"
    });
  });
});

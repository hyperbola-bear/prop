"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MRT_OPTIONS, RADIUS_KM_OPTIONS } from "./search-options";

export function RadiusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: "near_mrt" | "radius_km", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
      if (key === "near_mrt" && !next.get("radius_km")) {
        next.set("radius_km", "1");
      }
    } else {
      next.delete(key);
      if (key === "near_mrt") {
        next.delete("radius_km");
      }
    }
    next.delete("cursor");
    router.push(`/search?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        Near MRT
        <select
          data-testid="radius-mrt-select"
          value={searchParams.get("near_mrt") ?? ""}
          onChange={(event) => update("near_mrt", event.target.value)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-normal"
        >
          <option value="">Any station</option>
          {MRT_OPTIONS.map((station) => (
            <option key={station} value={station}>
              {station}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        Radius
        <select
          data-testid="radius-distance-select"
          value={searchParams.get("radius_km") ?? "1"}
          onChange={(event) => update("radius_km", event.target.value)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 font-normal"
        >
          {RADIUS_KM_OPTIONS.map((radiusKm) => (
            <option key={radiusKm} value={radiusKm}>
              {radiusKm} km
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

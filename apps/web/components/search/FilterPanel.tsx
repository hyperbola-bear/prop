"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FLAT_TYPES, FURNISHING_OPTIONS, HDB_TOWNS } from "./search-options";

function valueFromParams(params: URLSearchParams, key: string): string {
  return params.get(key) ?? "";
}

export function FilterPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(formData: FormData) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("cursor");

    for (const key of [
      "q",
      "town",
      "flat_type",
      "bedrooms",
      "price_min",
      "price_max",
      "lease_min_months",
      "available_from",
      "furnishing",
      "room_only"
    ]) {
      const value = formData.get(key);
      if (typeof value === "string" && value.trim() !== "") {
        next.set(key, value.trim());
      } else {
        next.delete(key);
      }
    }

    router.push(`/search?${next.toString()}`);
  }

  return (
    <form action={apply} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4">
        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Keywords
          <input
            name="q"
            defaultValue={valueFromParams(searchParams, "q")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            placeholder="balcony sunny"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Town
          <select
            data-testid="filter-town"
            name="town"
            defaultValue={valueFromParams(searchParams, "town")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Any town</option>
            {HDB_TOWNS.map((town) => (
              <option key={town} value={town}>
                {town}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Flat type
          <select
            data-testid="filter-flat-type"
            name="flat_type"
            defaultValue={valueFromParams(searchParams, "flat_type")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Any flat type</option>
            {FLAT_TYPES.map((flatType) => (
              <option key={flatType} value={flatType}>
                {flatType}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Min price (SGD)
          <input
            data-testid="filter-price-min"
            name="price_min"
            inputMode="numeric"
            defaultValue={valueFromParams(searchParams, "price_min")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Max price (SGD)
          <input
            data-testid="filter-price-max"
            name="price_max"
            inputMode="numeric"
            defaultValue={valueFromParams(searchParams, "price_max")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Bedrooms
          <select
            data-testid="filter-bedrooms"
            name="bedrooms"
            defaultValue={valueFromParams(searchParams, "bedrooms")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Any bedrooms</option>
            <option value="1">1 bedroom</option>
            <option value="2">2 bedrooms</option>
            <option value="3">3 bedrooms</option>
            <option value="4">4 bedrooms</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Minimum lease
          <select
            data-testid="filter-lease-term"
            name="lease_min_months"
            defaultValue={valueFromParams(searchParams, "lease_min_months")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Any lease</option>
            <option value="6">6+ months</option>
            <option value="12">12+ months</option>
            <option value="24">24+ months</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Available from
          <input
            name="available_from"
            type="date"
            defaultValue={valueFromParams(searchParams, "available_from")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
          Furnishing
          <select
            data-testid="filter-furnishing"
            name="furnishing"
            defaultValue={valueFromParams(searchParams, "furnishing")}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="">Any furnishing</option>
            {FURNISHING_OPTIONS.map((furnishing) => (
              <option key={furnishing} value={furnishing}>
                {furnishing === "Fully" ? "Fully furnished" : furnishing}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          <input
            data-testid="filter-room-only"
            name="room_only"
            type="checkbox"
            value="true"
            defaultChecked={searchParams.get("room_only") === "true"}
            className="size-4"
          />
          Room-only listings
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          data-testid="filter-apply"
          type="submit"
          className="rounded-full bg-proppy-primary px-5 py-2 text-sm font-bold text-white"
        >
          Apply filters
        </button>
        <a
          data-testid="filter-reset"
          href="/search"
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-slate-700"
        >
          Reset
        </a>
      </div>
    </form>
  );
}

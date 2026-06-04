"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS } from "./search-options";

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "newest";

  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      Sort
      <select
        data-testid="sort-select"
        value={currentSort}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          next.set("sort", event.target.value);
          next.delete("cursor");
          router.push(`/search?${next.toString()}`);
        }}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 font-normal"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

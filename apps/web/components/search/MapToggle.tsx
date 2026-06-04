"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function MapToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMap = searchParams.get("view") === "map";

  return (
    <button
      data-testid="map-toggle"
      type="button"
      aria-pressed={isMap}
      onClick={() => {
        const next = new URLSearchParams(searchParams.toString());
        if (isMap) {
          next.delete("view");
        } else {
          next.set("view", "map");
        }
        next.delete("cursor");
        router.push(`/search?${next.toString()}`);
      }}
      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
        isMap
          ? "border-proppy-primary bg-proppy-primary text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {isMap ? "Show list" : "Show map"}
    </button>
  );
}

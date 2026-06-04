"use client";

import dynamic from "next/dynamic";
import type { ListingSummary } from "../../../../packages/shared/src/types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
      Loading map…
    </div>
  )
});

export function DynamicMapView({ listings }: { listings: ListingSummary[] }) {
  return <MapView listings={listings} />;
}

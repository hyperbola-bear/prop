"use client";

import { useEffect, useState } from "react";
import { formatSGD } from "../../../lib/format";

type OwnedListing = {
  id: string;
  title: string;
  status: string;
  priceSgd: number;
  block: string | null;
  street: string | null;
  flatType: string | null;
  photoCount: number;
  refreshedAt: string | null;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: OwnedListing[] };

export function OwnedListingsTable() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/me/listings");
      if (!response.ok) {
        throw new Error("Failed to load owned listings");
      }
      const payload = (await response.json()) as { items: OwnedListing[] };
      setState({ status: "ready", items: payload.items });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Failed to load owned listings" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(id: string, action: "pause" | "refresh" | "mark-rented" | "delist") {
    if ((action === "mark-rented" || action === "delist") && !window.confirm(`Confirm ${action.replace("-", " ")}?`)) {
      return;
    }
    setBusyId(id);
    try {
      const response = await fetch(`/api/listings/${id}/${action}`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Action failed");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (state.status === "loading") {
    return <p className="mt-6 text-slate-600">Loading your listings…</p>;
  }

  if (state.status === "error") {
    return <p role="alert" className="mt-6 text-red-700">{state.message}</p>;
  }

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Listing</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Rent</th>
            <th className="px-4 py-3">Photos</th>
            <th className="px-4 py-3">Refreshed</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.items.map((listing) => (
            <tr key={listing.id}>
              <td className="px-4 py-4">
                <div className="font-bold text-slate-950">{listing.title}</div>
                <div className="text-slate-600">{listing.block} {listing.street} · {listing.flatType ?? "HDB"}</div>
              </td>
              <td className="px-4 py-4">
                <span data-testid="listing-status-badge" className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                  {listing.status}
                </span>
              </td>
              <td className="px-4 py-4 font-semibold">{formatSGD(listing.priceSgd)}</td>
              <td className="px-4 py-4">{listing.photoCount}</td>
              <td className="px-4 py-4">{listing.refreshedAt ? new Date(listing.refreshedAt).toLocaleString("en-SG") : "—"}</td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <a href={`/listings/${listing.id}/edit`} className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                    Edit
                  </a>
                  <button disabled={busyId === listing.id} onClick={() => void runAction(listing.id, "pause")} className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                    Pause
                  </button>
                  <button disabled={busyId === listing.id} onClick={() => void runAction(listing.id, "refresh")} className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                    Refresh
                  </button>
                  <button disabled={busyId === listing.id} onClick={() => void runAction(listing.id, "mark-rented")} className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
                    Mark as rented
                  </button>
                  <button disabled={busyId === listing.id} onClick={() => void runAction(listing.id, "delist")} className="rounded-full border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">
                    Delist
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {state.items.length === 0 ? (
        <p className="p-6 text-slate-600">No owned listings yet.</p>
      ) : null}
    </div>
  );
}

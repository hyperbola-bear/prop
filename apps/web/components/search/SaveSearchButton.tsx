"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { filteredQueryFromSearchParams } from "./search-options";

export function SaveSearchButton() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("Tampines 4-room");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const query = useMemo(
    () => filteredQueryFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  async function saveSearch() {
    setIsSaving(true);
    setMessage(null);
    const bodyQuery = Object.keys(query).length > 0 ? query : { sort: "newest" };
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, query: bodyQuery, notify_email: true })
    });

    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    setIsSaving(false);

    if (!response.ok) {
      setMessage("Could not save this search. Please check the filters and try again.");
      return;
    }

    setMessage("Saved search created");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        data-testid="save-search-button"
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-proppy-primary px-4 py-2 text-sm font-bold text-proppy-primary"
      >
        Save this search
      </button>
      {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-search-title"
          className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        >
          <h2 id="save-search-title" className="text-lg font-bold text-slate-950">
            Name this saved search
          </h2>
          <label className="mt-4 flex flex-col gap-2 text-sm font-semibold text-slate-700">
            Search name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || name.trim().length === 0}
              onClick={saveSearch}
              className="rounded-full bg-proppy-primary px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

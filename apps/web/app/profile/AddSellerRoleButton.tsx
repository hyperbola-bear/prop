"use client";

import { useState } from "react";

export function AddSellerRoleButton() {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addSellerRole() {
    setIsSubmitting(true);
    setStatus("");
    const response = await fetch("/api/me/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "seller" })
    });

    if (!response.ok) {
      setStatus("Could not add seller role");
      setIsSubmitting(false);
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mt-8 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <p className="font-semibold text-teal-950">
        Ready to list your property?
      </p>
      <button
        type="button"
        onClick={addSellerRole}
        disabled={isSubmitting}
        className="mt-3 rounded-full bg-proppy-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Adding role…" : "Become a landlord"}
      </button>
      <p className="mt-2 text-sm text-teal-900">Add role: seller</p>
      {status ? <p role="alert" className="mt-2 text-sm text-red-700">{status}</p> : null}
    </div>
  );
}

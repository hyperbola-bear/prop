"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function EnquiryButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, body })
    });

    if (!response.ok) {
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      setError("Unable to send enquiry. Please try again.");
      setSubmitting(false);
      return;
    }

    const result = (await response.json()) as { conversationId: string };
    router.push(`/messages/${result.conversationId}`);
    router.refresh();
  }

  return (
    <>
      <button
        data-testid="enquiry-button"
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-proppy-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
      >
        Send enquiry
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="enquiry-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
        >
          <form onSubmit={submitEnquiry} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="enquiry-dialog-title" className="text-xl font-bold text-slate-950">
                  Send enquiry
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Start a conversation with the owner about this listing.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close enquiry dialog"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <label htmlFor="enquiry-body" className="mt-5 block text-sm font-semibold text-slate-800">
              Message
            </label>
            <textarea
              id="enquiry-body"
              data-testid="enquiry-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              rows={5}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Is this still available?"
            />

            {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                data-testid="enquiry-submit"
                type="submit"
                disabled={submitting}
                className="rounded-full bg-proppy-primary px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

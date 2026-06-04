"use client";

import { FormEvent, useState } from "react";

type ReportDialogProps = {
  targetType: "listing" | "message" | "agent" | "user";
  targetId: string;
  buttonLabel?: string;
  buttonTestId?: string;
  buttonClassName?: string;
};

export function ReportDialog({
  targetType,
  targetId,
  buttonLabel = "Report",
  buttonTestId,
  buttonClassName
}: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Suspected scam");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId,
        reason,
        body: body || null
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      setStatus("error");
      setError("Unable to submit report. Please try again.");
      return;
    }

    setStatus("success");
    setBody("");
  }

  return (
    <>
      <button
        type="button"
        data-testid={buttonTestId}
        onClick={() => {
          setOpen(true);
          setStatus("idle");
          setError("");
        }}
        className={
          buttonClassName ??
          "rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
        }
      >
        {buttonLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`report-${targetType}-${targetId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
        >
          <form
            data-testid="report-form"
            onSubmit={submitReport}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id={`report-${targetType}-${targetId}-title`}
                  className="text-xl font-bold text-slate-950"
                >
                  Report this {targetType}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Tell our safety team what happened.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close report dialog"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <label
              htmlFor={`report-reason-${targetType}-${targetId}`}
              className="mt-5 block text-sm font-semibold text-slate-800"
            >
              Reason
            </label>
            <input
              id={`report-reason-${targetType}-${targetId}`}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
            />

            <label
              htmlFor={`report-body-${targetType}-${targetId}`}
              className="mt-4 block text-sm font-semibold text-slate-800"
            >
              Details
            </label>
            <textarea
              id={`report-body-${targetType}-${targetId}`}
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Add any extra context"
            />

            {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
            {status === "success" ? (
              <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">
                Report submitted.
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                data-testid="report-submit"
                type="submit"
                disabled={status === "submitting"}
                className="rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting…" : "Report"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

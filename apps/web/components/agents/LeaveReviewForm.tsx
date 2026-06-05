"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { validateAgentReviewDraft } from "../../lib/agent-review-validation";

type LeaveReviewFormProps = {
  agentId: string;
};

export function LeaveReviewForm({ agentId }: LeaveReviewFormProps) {
  const router = useRouter();
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateAgentReviewDraft({ stars, body });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/agents/${agentId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, body })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string; fieldErrors?: Record<string, string> };
        reviewType?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error?.fieldErrors?.stars ??
            payload.error?.fieldErrors?.body ??
            payload.error?.message ??
            "Unable to submit review"
        );
      }

      setSuccess(
        payload.reviewType === "verified"
          ? "Review submitted as Verified."
          : "Review submitted as Unverified."
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit review");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      data-testid="agent-review-form"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-xl font-bold text-slate-950">Leave a review</h2>
      <div className="mt-4">
        <label htmlFor="agent-review-stars" className="block text-sm font-semibold text-slate-700">
          Stars
        </label>
        <input
          id="agent-review-stars"
          name="stars"
          type="number"
          min={1}
          max={5}
          value={stars}
          onChange={(event) => setStars(Number(event.target.value))}
          className="mt-2 w-28 rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>
      <div className="mt-4">
        <label htmlFor="agent-review-body" className="block text-sm font-semibold text-slate-700">
          Review
        </label>
        <textarea
          id="agent-review-body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {success ? <p className="mt-3 text-sm font-semibold text-teal-700">{success}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-proppy-primary px-5 py-2 font-bold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {isSubmitting ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}

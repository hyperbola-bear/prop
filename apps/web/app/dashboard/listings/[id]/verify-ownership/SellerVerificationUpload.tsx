"use client";

import { useState, type FormEvent } from "react";

type SellerVerificationUploadProps = {
  listingId: string;
};

export function SellerVerificationUpload({ listingId }: SellerVerificationUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!file) {
      setError("Please choose a PDF document.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Property tax document must be a PDF.");
      return;
    }

    setIsSubmitting(true);
    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          fileSize: file.size,
          scope: "seller-verification",
          listingId
        })
      });
      const presign = (await presignResponse.json().catch(() => ({}))) as {
        url?: string;
        fields?: Record<string, string>;
        key?: string;
        error?: { message?: string };
      };
      if (!presignResponse.ok || !presign.url || !presign.fields || !presign.key) {
        throw new Error(presign.error?.message ?? "Could not prepare document upload");
      }

      const uploadBody = new FormData();
      for (const [key, value] of Object.entries(presign.fields)) {
        uploadBody.append(key, value);
      }
      uploadBody.append("file", file);

      const uploadResponse = await fetch(presign.url, {
        method: "POST",
        body: uploadBody
      });
      if (!uploadResponse.ok && uploadResponse.status !== 204) {
        throw new Error("Document upload failed");
      }

      const verificationResponse = await fetch(`/api/listings/${listingId}/seller-verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: presign.key })
      });
      if (!verificationResponse.ok) {
        const payload = (await verificationResponse.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(payload.error?.message ?? "Could not submit verification");
      }

      setMessage("Verification submitted and pending admin review.");
      setFile(null);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit verification");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <label htmlFor="seller-verification-document" className="block text-sm font-semibold text-slate-700">
        Property tax document PDF
      </label>
      <input
        id="seller-verification-document"
        data-testid="seller-verification-document"
        type="file"
        accept="application/pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
      />
      {error ? <p role="alert" className="mt-3 font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 font-semibold text-teal-700">{message}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 rounded-full bg-proppy-primary px-5 py-2 font-bold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {isSubmitting ? "Uploading…" : "Submit verification"}
      </button>
    </form>
  );
}

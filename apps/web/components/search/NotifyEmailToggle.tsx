"use client";

import { useState } from "react";

type NotifyEmailToggleProps = {
  savedSearchId: string;
  initialNotifyEmail: boolean;
};

export function NotifyEmailToggle({
  savedSearchId,
  initialNotifyEmail
}: NotifyEmailToggleProps) {
  const [checked, setChecked] = useState(initialNotifyEmail);
  const [isSaving, setIsSaving] = useState(false);

  async function update(nextChecked: boolean) {
    setChecked(nextChecked);
    setIsSaving(true);
    const response = await fetch(`/api/saved-searches/${savedSearchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notify_email: nextChecked })
    });
    setIsSaving(false);
    if (!response.ok) {
      setChecked(!nextChecked);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={isSaving}
        onChange={(event) => update(event.target.checked)}
        className="size-4"
      />
      Notify by email
    </label>
  );
}

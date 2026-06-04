"use client";

import { useState } from "react";
import { createApiClient } from "../../../../packages/shared/src/api-client";

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
    try {
      await createApiClient({ baseUrl: window.location.origin }).savedSearches.update(
        savedSearchId,
        { notify_email: nextChecked }
      );
    } catch {
      setChecked(!nextChecked);
    } finally {
      setIsSaving(false);
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

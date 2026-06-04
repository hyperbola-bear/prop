import { sqlClient } from "../db";
import { startTicker, type StopTask } from "../ticker";

type EnquirySlaOptions = {
  intervalMs: number;
  runOnStart?: boolean;
};

export async function breachStaleEnquiries(): Promise<number> {
  const rows = await sqlClient<{ id: string }[]>`
    UPDATE enquiries
    SET sla_breached_at = now(),
        updated_at = now()
    WHERE created_at < now() - interval '24 hours'
      AND first_response_at IS NULL
      AND sla_breached_at IS NULL
      AND deleted_at IS NULL
    RETURNING id
  `;

  if (rows.length === 0) {
    console.log("[worker] enquiry-sla: no stale enquiries to breach");
  } else {
    console.log(`[worker] enquiry-sla: breached ${rows.length} stale enquiries`);
  }

  return rows.length;
}

export function startEnquirySlaTick({
  intervalMs,
  runOnStart = true
}: EnquirySlaOptions): StopTask {
  console.log(`[worker] enquiry-sla: starting tick every ${intervalMs}ms`);
  return startTicker({
    name: "enquiry-sla",
    intervalMs,
    runOnStart,
    run: async () => {
      const breached = await breachStaleEnquiries();
      console.log(`[worker] enquiry-sla: tick complete; breached ${breached}`);
    }
  });
}

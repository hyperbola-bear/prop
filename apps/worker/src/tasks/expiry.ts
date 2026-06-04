import { drainEmailQueue } from "./email";
import { sqlClient } from "../db";
import { startTicker, type StopTask } from "../ticker";

type ExpiredListingRow = {
  id: string;
  title: string;
  owner_user_id: string;
  owner_email: string;
};

type ExpiryTickOptions = {
  intervalMs: number;
  runOnStart?: boolean;
  drainAfterQueue?: boolean;
};

export async function expirePublishedListings({
  drainAfterQueue = true
}: {
  drainAfterQueue?: boolean;
} = {}): Promise<number> {
  const queued = await sqlClient.begin(async (tx) => {
    const expiredRows = await tx<ExpiredListingRow[]>`
      SELECT l.id, l.title, l.owner_user_id, u.email AS owner_email
      FROM listings l
      INNER JOIN users u ON u.id = l.owner_user_id
      WHERE l.status = 'published'
        AND l.expires_at < now()
        AND l.deleted_at IS NULL
      ORDER BY l.expires_at ASC, l.id ASC
      FOR UPDATE OF l SKIP LOCKED
    `;

    if (expiredRows.length === 0) {
      console.log("[worker] expiry: no published listings to expire");
      return 0;
    }

    for (const row of expiredRows) {
      await tx`
        UPDATE listings
        SET status = 'expired',
            updated_at = now()
        WHERE id = ${row.id}
          AND status = 'published'
      `;

      await tx`
        INSERT INTO listing_events (listing_id, actor_user_id, event_type, metadata)
        VALUES (
          ${row.id},
          NULL,
          'expired',
          ${JSON.stringify({ worker: "apps/worker" })}::jsonb
        )
      `;

      await tx`
        INSERT INTO email_queue (to_email, subject, body)
        VALUES (
          ${row.owner_email},
          ${`Your listing has expired - ${row.title}`},
          ${`Your listing "${row.title}" has expired. Renew it from your dashboard.`}
        )
      `;

      console.log(
        `[worker] expiry: expired listing ${row.id}; queued email to ${row.owner_email}`
      );
    }

    return expiredRows.length;
  });

  if (queued > 0 && drainAfterQueue) {
    const sent = await drainEmailQueue();
    console.log(`[worker] expiry: post-expiry email drain sent ${sent}`);
  }

  return queued;
}

export function startExpiryTick({
  intervalMs,
  runOnStart = true,
  drainAfterQueue = true
}: ExpiryTickOptions): StopTask {
  console.log(`[worker] expiry: starting tick every ${intervalMs}ms`);
  return startTicker({
    name: "expiry",
    intervalMs,
    runOnStart,
    run: async () => {
      const expired = await expirePublishedListings({ drainAfterQueue });
      console.log(`[worker] expiry: tick complete; expired ${expired}`);
    }
  });
}

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  agentProfiles,
  listings,
  sellerPropertyVerifications,
  users
} from "../../../../../packages/db/schema";
import { db } from "../../../lib/db";
import { currentSessionUser } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await currentSessionUser();
  return user?.roles.includes("admin") ? user : null;
}

async function approveVerification(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) {
    throw new Error("Forbidden");
  }

  const type = String(formData.get("type") ?? "");
  const id = String(formData.get("id") ?? "");
  const now = new Date();

  if (type === "seller") {
    const [updated] = await db.transaction(async (tx) => {
      const [verification] = await tx
        .update(sellerPropertyVerifications)
        .set({
          status: "approved",
          reviewedBy: admin.id,
          reviewedAt: now,
          updatedAt: now
        })
        .where(
          and(
            eq(sellerPropertyVerifications.id, id),
            isNull(sellerPropertyVerifications.deletedAt)
          )
        )
        .returning({
          id: sellerPropertyVerifications.id,
          listingId: sellerPropertyVerifications.listingId
        });

      if (verification?.listingId) {
        await tx
          .update(listings)
          .set({ sellerOwnershipVerified: true, updatedAt: now })
          .where(eq(listings.id, verification.listingId));
      }

      return verification ? [verification] : [];
    });

    if (!updated) {
      throw new Error("Verification not found");
    }
  }

  if (type === "agent") {
    await db
      .update(agentProfiles)
      .set({ verifiedAt: now, ceaStatus: "active", updatedAt: now })
      .where(and(eq(agentProfiles.userId, id), isNull(agentProfiles.deletedAt)));
  }

  revalidatePath("/admin/verifications");
}

async function rejectVerification(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) {
    throw new Error("Forbidden");
  }

  const type = String(formData.get("type") ?? "");
  const id = String(formData.get("id") ?? "");
  const now = new Date();

  if (type === "seller") {
    await db
      .update(sellerPropertyVerifications)
      .set({
        status: "rejected",
        reviewedBy: admin.id,
        reviewedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(sellerPropertyVerifications.id, id),
          isNull(sellerPropertyVerifications.deletedAt)
        )
      );
  }

  if (type === "agent") {
    await db
      .update(agentProfiles)
      .set({ ceaStatus: "rejected", verifiedAt: null, updatedAt: now })
      .where(and(eq(agentProfiles.userId, id), isNull(agentProfiles.deletedAt)));
  }

  revalidatePath("/admin/verifications");
}

export default async function AdminVerificationsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold text-slate-950">403 Forbidden</h1>
        <p className="mt-3 text-slate-700">Admin access is required.</p>
      </main>
    );
  }

  const sellerRows = await db
    .select({
      id: sellerPropertyVerifications.id,
      listingId: sellerPropertyVerifications.listingId,
      listingTitle: listings.title,
      sellerName: users.name,
      documentS3Key: sellerPropertyVerifications.documentS3Key,
      createdAt: sellerPropertyVerifications.createdAt
    })
    .from(sellerPropertyVerifications)
    .innerJoin(users, eq(users.id, sellerPropertyVerifications.sellerUserId))
    .leftJoin(listings, eq(listings.id, sellerPropertyVerifications.listingId))
    .where(
      and(
        eq(sellerPropertyVerifications.status, "pending"),
        isNull(sellerPropertyVerifications.deletedAt)
      )
    )
    .orderBy(asc(sellerPropertyVerifications.createdAt));

  const agentRows = await db
    .select({
      id: agentProfiles.userId,
      name: users.name,
      ceaRegistrationNo: agentProfiles.ceaRegistrationNo,
      agencyName: agentProfiles.agencyName,
      createdAt: agentProfiles.createdAt
    })
    .from(agentProfiles)
    .innerJoin(users, eq(users.id, agentProfiles.userId))
    .where(and(isNull(agentProfiles.verifiedAt), isNull(agentProfiles.deletedAt), isNull(users.deletedAt)))
    .orderBy(asc(agentProfiles.createdAt));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Admin
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
        Verification queue
      </h1>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table data-testid="admin-verifications-queue" className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sellerRows.map((row) => (
              <tr key={`seller-${row.id}`}>
                <td className="px-4 py-4 font-semibold">Seller ownership</td>
                <td className="px-4 py-4">
                  {row.sellerName} · {row.listingTitle ?? row.listingId ?? "Listing"}
                </td>
                <td className="px-4 py-4">{row.documentS3Key}</td>
                <td className="px-4 py-4">{row.createdAt.toLocaleString("en-SG")}</td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <form action={approveVerification}>
                      <input type="hidden" name="type" value="seller" />
                      <input type="hidden" name="id" value={row.id} />
                      <button data-testid="admin-approve" className="rounded-full bg-proppy-primary px-3 py-1.5 font-bold text-white">
                        Approve
                      </button>
                    </form>
                    <form action={rejectVerification}>
                      <input type="hidden" name="type" value="seller" />
                      <input type="hidden" name="id" value={row.id} />
                      <button data-testid="admin-reject" className="rounded-full border border-red-200 px-3 py-1.5 font-bold text-red-700">
                        Reject
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {agentRows.map((row) => (
              <tr key={`agent-${row.id}`}>
                <td className="px-4 py-4 font-semibold">Agent verification</td>
                <td className="px-4 py-4">
                  {row.name} · {row.ceaRegistrationNo}
                </td>
                <td className="px-4 py-4">{row.agencyName ?? "CEA lookup pending"}</td>
                <td className="px-4 py-4">{row.createdAt.toLocaleString("en-SG")}</td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <form action={approveVerification}>
                      <input type="hidden" name="type" value="agent" />
                      <input type="hidden" name="id" value={row.id} />
                      <button data-testid="admin-approve" className="rounded-full bg-proppy-primary px-3 py-1.5 font-bold text-white">
                        Approve
                      </button>
                    </form>
                    <form action={rejectVerification}>
                      <input type="hidden" name="type" value="agent" />
                      <input type="hidden" name="id" value={row.id} />
                      <button data-testid="admin-reject" className="rounded-full border border-red-200 px-3 py-1.5 font-bold text-red-700">
                        Reject
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sellerRows.length === 0 && agentRows.length === 0 ? (
          <p className="p-6 text-slate-600">No pending verifications.</p>
        ) : null}
      </div>
    </main>
  );
}

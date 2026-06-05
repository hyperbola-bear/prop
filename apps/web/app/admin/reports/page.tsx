import { asc, eq, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { reports, users } from "../../../../../packages/db/schema";
import { db } from "../../../lib/db";
import { currentSessionUser } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await currentSessionUser();
  return user?.roles.includes("admin") ? user : null;
}

async function resolveReport(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  if (!admin) {
    throw new Error("Forbidden");
  }

  const id = String(formData.get("id") ?? "");
  const now = new Date();
  await db
    .update(reports)
    .set({
      status: "resolved",
      resolvedBy: admin.id,
      resolvedAt: now,
      updatedAt: now
    })
    .where(and(eq(reports.id, id), isNull(reports.deletedAt)));

  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage() {
  const admin = await requireAdmin();
  if (!admin) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
        <h1 className="text-4xl font-bold text-slate-950">403 Forbidden</h1>
        <p className="mt-3 text-slate-700">Admin access is required.</p>
      </main>
    );
  }

  const rows = await db
    .select({
      id: reports.id,
      reporterName: users.name,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      body: reports.body,
      createdAt: reports.createdAt
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterUserId))
    .where(and(eq(reports.status, "open"), isNull(reports.deletedAt)))
    .orderBy(asc(reports.createdAt));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Admin
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
        Reports queue
      </h1>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table data-testid="admin-reports-queue" className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Reporter</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Body</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-4">{row.reporterName}</td>
                <td className="px-4 py-4">
                  {row.targetType} · {row.targetId}
                </td>
                <td className="px-4 py-4 font-semibold">{row.reason}</td>
                <td className="px-4 py-4">{row.body ?? "—"}</td>
                <td className="px-4 py-4">{row.createdAt.toLocaleString("en-SG")}</td>
                <td className="px-4 py-4">
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="rounded-full bg-proppy-primary px-3 py-1.5 font-bold text-white">
                      Resolve
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-6 text-slate-600">No open reports.</p> : null}
      </div>
    </main>
  );
}

import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  agentProfiles,
  agentReviews,
  enquiries,
  listings,
  users
} from "../../../../../packages/db/schema";
import { LeaveReviewForm } from "../../../components/agents/LeaveReviewForm";
import { formatAgentResponseTime } from "../../../lib/agent-review-validation";
import { db } from "../../../lib/db";
import { currentSessionUser } from "../../../lib/server-auth";
import { presignPhotoGetUrl } from "../../../lib/storage";

export const dynamic = "force-dynamic";

type AgentPageProps = {
  params: Promise<{ id: string }>;
};

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function fallbackAgentPhoto(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#ccfbf1"/><circle cx="320" cy="170" r="84" fill="#0f766e"/><rect x="180" y="278" width="280" height="76" rx="38" fill="#0f766e"/><text x="320" y="195" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default async function AgentProfilePage({ params }: AgentPageProps) {
  const { id } = await params;
  const sessionUser = await currentSessionUser();

  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      photoRef: agentProfiles.photoS3Key,
      bio: agentProfiles.bio,
      specialties: agentProfiles.specialties,
      languages: agentProfiles.languages,
      verifiedAt: agentProfiles.verifiedAt
    })
    .from(agentProfiles)
    .innerJoin(users, eq(users.id, agentProfiles.userId))
    .where(and(eq(agentProfiles.userId, id), isNull(agentProfiles.deletedAt), isNull(users.deletedAt)))
    .limit(1);

  if (!profile) {
    notFound();
  }

  const [listingCountRow] = await db
    .select({ value: count(listings.id) })
    .from(listings)
    .where(
      and(
        or(eq(listings.agentUserId, id), eq(listings.ownerUserId, id)),
        inArray(listings.status, ["published", "active"]),
        isNull(listings.deletedAt)
      )
    );

  const [stats] = await db
    .select({
      p50Minutes: sql<string | null>`percentile_cont(0.5) within group (order by extract(epoch from (${enquiries.firstResponseAt} - ${enquiries.createdAt})) / 60.0)`,
      p90Minutes: sql<string | null>`percentile_cont(0.9) within group (order by extract(epoch from (${enquiries.firstResponseAt} - ${enquiries.createdAt})) / 60.0)`
    })
    .from(enquiries)
    .innerJoin(listings, eq(listings.id, enquiries.listingId))
    .where(
      and(
        or(eq(listings.agentUserId, id), eq(listings.ownerUserId, id)),
        isNull(listings.deletedAt),
        isNull(enquiries.deletedAt),
        sql`${enquiries.firstResponseAt} is not null`
      )
    );

  const reviews = await db
    .select({
      id: agentReviews.id,
      stars: agentReviews.stars,
      body: agentReviews.body,
      reviewType: agentReviews.reviewType,
      reviewerName: users.name,
      createdAt: agentReviews.createdAt
    })
    .from(agentReviews)
    .innerJoin(users, eq(users.id, agentReviews.reviewerUserId))
    .where(and(eq(agentReviews.agentUserId, id), isNull(agentReviews.deletedAt), isNull(users.deletedAt)))
    .orderBy(desc(agentReviews.createdAt));

  const photoUrl = profile.photoRef
    ? await presignPhotoGetUrl(profile.photoRef)
    : fallbackAgentPhoto(profile.name);
  const p50Minutes = numericOrNull(stats?.p50Minutes);
  const p90Minutes = numericOrNull(stats?.p90Minutes);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <img
            data-testid="agent-profile"
            src={photoUrl}
            alt={profile.name}
            className="h-80 w-full rounded-3xl object-cover shadow-sm"
          />
        </section>
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
            Agent profile
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">{profile.name}</h1>
            {profile.verifiedAt ? (
              <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-800">
                Verified
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-lg text-slate-700">
            {profile.bio ?? "This agent has not added a bio yet."}
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-600">Active listings</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">{listingCountRow?.value ?? 0}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-600">P50 response time</dt>
              <dd data-testid="agent-stats-p50" className="mt-1 text-2xl font-bold text-slate-950">
                {formatAgentResponseTime(p50Minutes)}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-600">P90 response time</dt>
              <dd data-testid="agent-stats-p90" className="mt-1 text-2xl font-bold text-slate-950">
                {formatAgentResponseTime(p90Minutes)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Specialties</h2>
              <ul className="mt-2 list-disc pl-5 text-slate-700">
                {profile.specialties.map((specialty) => (
                  <li key={specialty}>{specialty}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Languages</h2>
              <ul className="mt-2 list-disc pl-5 text-slate-700">
                {profile.languages.map((language) => (
                  <li key={language}>{language}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Reviews</h2>
          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                data-testid="agent-review-card"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-label={`${review.stars} stars`} className="font-bold text-amber-600">
                    {"★".repeat(review.stars)}
                    {"☆".repeat(5 - review.stars)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {review.reviewType === "verified" ? "Verified" : "Unverified"}
                  </span>
                </div>
                <p className="mt-3 text-slate-800">{review.body}</p>
                <p className="mt-2 text-sm text-slate-500">
                  {review.reviewerName} · {review.createdAt.toLocaleDateString("en-SG")}
                </p>
              </article>
            ))}
            {reviews.length === 0 ? <p className="text-slate-600">No reviews yet.</p> : null}
          </div>
        </div>
        <div>
          {sessionUser ? (
            <LeaveReviewForm agentId={id} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Leave a review</h2>
              <p className="mt-2 text-slate-700">
                <a className="font-semibold text-proppy-primary underline" href="/login">
                  Sign in
                </a>{" "}
                to review this agent.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

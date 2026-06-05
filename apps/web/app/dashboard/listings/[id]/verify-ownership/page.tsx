import { and, eq, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { listings } from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { currentSessionUser } from "../../../../../lib/server-auth";
import { SellerVerificationUpload } from "./SellerVerificationUpload";

export const dynamic = "force-dynamic";

type VerifyOwnershipPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VerifyOwnershipPage({ params }: VerifyOwnershipPageProps) {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const [listing] = await db
    .select({
      id: listings.id,
      title: listings.title,
      ownerUserId: listings.ownerUserId,
      agentUserId: listings.agentUserId,
      sellerOwnershipVerified: listings.sellerOwnershipVerified
    })
    .from(listings)
    .where(
      and(
        eq(listings.id, id),
        isNull(listings.deletedAt),
        or(eq(listings.ownerUserId, user.id), eq(listings.agentUserId, user.id))
      )
    )
    .limit(1);

  if (!listing) {
    redirect("/dashboard/listings");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Seller verification
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
        Verify ownership
      </h1>
      <p className="mt-3 text-slate-700">
        Upload a property tax document PDF for <strong>{listing.title}</strong>. Admins will review
        it before the public listing shows a Verified owner badge.
      </p>
      {listing.sellerOwnershipVerified ? (
        <p className="mt-5 rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800">
          This listing is already marked as a Verified owner listing.
        </p>
      ) : (
        <SellerVerificationUpload listingId={listing.id} />
      )}
    </main>
  );
}

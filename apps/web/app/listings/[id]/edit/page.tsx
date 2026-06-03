import { redirect } from "next/navigation";
import { currentSessionUser } from "../../../../lib/server-auth";
import { ListingWizard } from "../../_components/ListingWizard";

type EditListingPageProps = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function EditListingPage({ params }: EditListingPageProps) {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { id } = await params;

  return (
    <ListingWizard
      initialListingId={id}
      user={{
        email: user.email,
        roles: user.roles
      }}
    />
  );
}

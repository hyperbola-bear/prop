import { redirect } from "next/navigation";
import { currentSessionUser } from "../../../lib/server-auth";
import { ListingWizard } from "../_components/ListingWizard";

export default async function NewListingPage() {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <ListingWizard
      user={{
        email: user.email,
        roles: user.roles
      }}
    />
  );
}

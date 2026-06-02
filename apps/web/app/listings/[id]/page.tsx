import { ListingDetailView } from "./ListingDetailView";

export const dynamic = "force-dynamic";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({
  params
}: ListingDetailPageProps) {
  const { id } = await params;
  return <ListingDetailView id={id} />;
}

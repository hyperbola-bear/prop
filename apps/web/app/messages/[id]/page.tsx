import { redirect } from "next/navigation";
import { ChatThread } from "../../../components/messaging/ChatThread";
import { currentSessionUser } from "../../../lib/server-auth";

type MessageThreadPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MessageThreadPage({ params }: MessageThreadPageProps) {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Messages
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Conversation
      </h1>
      <ChatThread conversationId={id} currentUserId={user.id} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { ConversationList } from "../../components/messaging/ConversationList";
import { currentSessionUser } from "../../lib/server-auth";

export default async function MessagesPage() {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Messages
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Your conversations
      </h1>
      <ConversationList />
    </main>
  );
}

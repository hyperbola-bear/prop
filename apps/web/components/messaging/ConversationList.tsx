"use client";

import { useEffect, useState } from "react";
import type { ConversationSummary } from "./chat-utils";

type ConversationListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ConversationSummary[] };

export function ConversationList() {
  const [state, setState] = useState<ConversationListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        const response = await fetch("/api/conversations", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load conversations");
        }
        const body = (await response.json()) as { items: ConversationSummary[] };
        if (!cancelled) {
          setState({ status: "ready", items: body.items });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error" });
        }
      }
    }

    void loadConversations();
    const timer = window.setInterval(loadConversations, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (state.status === "loading") {
    return <p className="mt-6 text-slate-600">Loading conversations…</p>;
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="mt-6 text-rose-700">
        Unable to load conversations.
      </p>
    );
  }

  if (state.items.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-slate-600">
        No conversations yet. Send an enquiry from a listing to get started.
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-4">
      {state.items.map((conversation) => (
        <a
          key={conversation.id}
          href={`/messages/${conversation.id}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-proppy-primary"
        >
          <div>
            <p className="font-semibold text-slate-950">Conversation about listing</p>
            <p className="mt-1 text-sm text-slate-600">Listing ID: {conversation.listingId}</p>
            {conversation.last_message_at ? (
              <p className="mt-1 text-xs text-slate-500">
                Last message: {new Date(conversation.last_message_at).toLocaleString("en-SG")}
              </p>
            ) : null}
          </div>
          {conversation.unread_count > 0 ? (
            <span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-bold text-white">
              {conversation.unread_count} unread
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
              Read
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

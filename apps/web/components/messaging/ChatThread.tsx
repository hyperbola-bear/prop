"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import { ReportDialog } from "../report/ReportDialog";
import {
  type ChatMessage,
  type ConversationDetail,
  messageSenderLabel,
  shouldShowScamWarning
} from "./chat-utils";

async function fetchConversation(conversationId: string): Promise<ConversationDetail> {
  const response = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load conversation");
  }
  return response.json() as Promise<ConversationDetail>;
}

async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  if (!response.ok) {
    throw new Error("Unable to send message");
  }
  return response.json() as Promise<ChatMessage>;
}

function ChatThreadInner({
  conversationId,
  currentUserId
}: {
  conversationId: string;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const conversationQuery = useQuery({
    queryKey: ["conv", conversationId],
    queryFn: () => fetchConversation(conversationId),
    refetchInterval: 5000
  });

  useEffect(() => {
    if (!conversationQuery.data) return;
    void fetch(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
  }, [conversationId, conversationQuery.data?.last_message_at, conversationQuery.data]);

  const mutation = useMutation({
    mutationFn: (messageBody: string) => sendMessage(conversationId, messageBody),
    onSuccess: async () => {
      setBody("");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["conv", conversationId] });
    },
    onError: () => {
      setError("Unable to send message. Please try again.");
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    mutation.mutate(trimmed);
  }

  if (conversationQuery.isLoading) {
    return <p className="mt-6 text-slate-600">Loading conversation…</p>;
  }

  if (conversationQuery.isError || !conversationQuery.data) {
    return (
      <p role="alert" className="mt-6 text-rose-700">
        Unable to load this conversation.
      </p>
    );
  }

  const conversation = conversationQuery.data;

  return (
    <div className="mt-8 grid gap-6">
      <div
        data-testid="chat-thread"
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {conversation.messages.map((message) => {
          const mine = message.senderUserId === currentUserId;
          return (
            <article
              key={message.id}
              data-testid="chat-message"
              data-sender={message.senderUserId}
              className={`group flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                  mine
                    ? "bg-proppy-primary text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-900"
                }`}
              >
                {shouldShowScamWarning(message.scam_score) ? (
                  <p
                    data-testid="chat-scam-warning"
                    role="alert"
                    className="mb-3 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"
                  >
                    Caution: this message contains suspicious patterns.
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{message.body}</p>
                <div
                  className={`mt-2 flex items-center gap-3 text-xs ${
                    mine ? "text-teal-50" : "text-slate-500"
                  }`}
                >
                  <span>{messageSenderLabel(message, currentUserId)}</span>
                  <ReportDialog
                    targetType="message"
                    targetId={message.id}
                    buttonLabel="Report"
                    buttonClassName={`opacity-100 underline transition group-hover:opacity-100 focus:opacity-100 ${
                      mine ? "text-teal-50" : "text-rose-700"
                    }`}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="chat-input" className="block text-sm font-semibold text-slate-800">
          Message
        </label>
        <textarea
          id="chat-input"
          data-testid="chat-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3"
          placeholder="Write your reply"
        />
        {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-3 flex justify-end">
          <button
            data-testid="chat-send"
            type="submit"
            disabled={mutation.isPending || !body.trim()}
            className="rounded-full bg-proppy-primary px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChatThread(props: { conversationId: string; currentUserId: string }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ChatThreadInner {...props} />
    </QueryClientProvider>
  );
}

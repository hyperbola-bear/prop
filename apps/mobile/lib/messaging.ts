import type { ChatMessage, ConversationSummary } from "@proppy/shared/api-client";

export function shouldShowScamWarning(scamScore: number | null | undefined): boolean {
  return (scamScore ?? 0) > 70;
}

export function messageSenderLabel(
  message: Pick<ChatMessage, "senderUserId">,
  currentUserId?: string | null
): string {
  return message.senderUserId === currentUserId ? "You" : "Other party";
}

export function totalUnreadCount(
  conversations: Pick<ConversationSummary, "unread_count">[]
): number {
  return conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);
}

export function formatUnreadBadge(count: number): string {
  if (count <= 0) {
    return "";
  }

  return count > 99 ? "99+" : String(count);
}

export function jwtSubject(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const parsed = JSON.parse(globalThis.atob(padded)) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}

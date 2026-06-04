export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  scam_score: number;
  scam_flags: string[];
  created_at: string | null;
  read_at: string | null;
};

export type ConversationDetail = {
  id: string;
  listingId: string;
  buyerUserId: string;
  sellerUserId: string;
  unread_count: number;
  last_message_at: string | null;
  messages: ChatMessage[];
};

export type ConversationSummary = Omit<ConversationDetail, "messages">;

export function shouldShowScamWarning(scamScore: number | null | undefined): boolean {
  return (scamScore ?? 0) > 70;
}

export function messageSenderLabel(message: ChatMessage, currentUserId?: string | null): string {
  return message.senderUserId === currentUserId ? "You" : "Other party";
}

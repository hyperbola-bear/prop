import { checkRateLimit, messageRateLimits } from "./rate-limit";
import { jsonError } from "./route-helpers";

export class ConversationMessageRateLimitError extends Error {
  retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("Conversation message rate limit exceeded");
    this.retryAfterSec = retryAfterSec;
  }
}

export function assertConversationMessageRateLimit(conversationId: string): void {
  const rateLimit = checkRateLimit(conversationId, messageRateLimits);
  if (!rateLimit.ok) {
    throw new ConversationMessageRateLimitError(rateLimit.retryAfterSec);
  }
}

export function mapConversationMessageRateLimitError(error: unknown) {
  if (!(error instanceof ConversationMessageRateLimitError)) {
    return null;
  }

  return jsonError(429, "rate_limited", "Try again later", undefined, {
    "Retry-After": String(error.retryAfterSec)
  });
}

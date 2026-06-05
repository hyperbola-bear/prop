export type AgentReviewDraft = {
  stars: number;
  body: string;
};

export function validateAgentReviewDraft(draft: AgentReviewDraft): string | null {
  if (!Number.isInteger(draft.stars) || draft.stars < 1 || draft.stars > 5) {
    return "Stars must be 1 to 5";
  }

  if (draft.body.trim().length === 0) {
    return "Review body is required";
  }

  return null;
}

export function formatAgentResponseTime(minutes: number | null): string {
  if (minutes === null) {
    return "No responses yet";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

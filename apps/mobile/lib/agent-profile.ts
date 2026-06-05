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

export function initialsForAgent(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function fallbackAgentPhoto(name: string): string {
  const initials = initialsForAgent(name) || "A";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#ccfbf1"/><circle cx="320" cy="170" r="84" fill="#0f766e"/><rect x="180" y="278" width="280" height="76" rx="38" fill="#0f766e"/><text x="320" y="195" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">${initials}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function agentReviewTypeLabel(reviewType: "verified" | "unverified"): string {
  return reviewType === "verified" ? "Verified" : "Unverified";
}

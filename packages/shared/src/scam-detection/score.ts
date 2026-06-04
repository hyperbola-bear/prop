import { cryptoKeywords, keywordRules, singaporeMobileRegex, type ScamFlag } from "./rules";

export type ScoreMessageContext = {
  listedPriceSgdCents?: bigint | number | null;
  comparableMedianSgdCents?: bigint | number | null;
};

export type ScamScoreResult = {
  scam_flags: ScamFlag[];
  scam_score: number;
};

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function toNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

export function scoreMessage(body: string, context: ScoreMessageContext = {}): ScamScoreResult {
  const normalized = body.toLowerCase();
  const flags = new Set<ScamFlag>();
  let score = 0;

  for (const rule of keywordRules) {
    if (includesAny(normalized, rule.keywords)) {
      flags.add(rule.flag);
      score += rule.score;
    }
  }

  if (includesAny(normalized, cryptoKeywords)) {
    flags.add("crypto");
  }

  if (singaporeMobileRegex.test(normalized)) {
    flags.add("whatsapp_handoff");
    if (!includesAny(normalized, ["whatsapp me at", "wechat", "telegram"])) {
      score += 25;
    }
  }

  const listedPrice = toNumber(context.listedPriceSgdCents);
  const comparableMedian = toNumber(context.comparableMedianSgdCents);
  if (
    listedPrice !== null &&
    comparableMedian !== null &&
    comparableMedian > 0 &&
    listedPrice < comparableMedian * 0.5
  ) {
    flags.add("too_good_to_be_true");
    score += 10;
  }

  return {
    scam_flags: Array.from(flags),
    scam_score: Math.min(100, Math.max(0, score))
  };
}

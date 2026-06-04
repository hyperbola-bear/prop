export type ScamFlag =
  | "deposit_before_viewing"
  | "offsite_payment"
  | "crypto"
  | "urgency_pressure"
  | "whatsapp_handoff"
  | "too_good_to_be_true";

export type KeywordRule = {
  flag: ScamFlag;
  score: number;
  keywords: string[];
};

export const keywordRules: KeywordRule[] = [
  {
    flag: "deposit_before_viewing",
    score: 40,
    keywords: ["deposit before viewing", "transfer first", "pay first then view", "pay deposit"]
  },
  {
    flag: "offsite_payment",
    score: 30,
    keywords: ["western union", "bank transfer to my", "paynow to my personal", "bitcoin", "crypto"]
  },
  {
    flag: "urgency_pressure",
    score: 15,
    keywords: ["act now", "limited time", "today only", "first come first served"]
  },
  {
    flag: "whatsapp_handoff",
    score: 25,
    keywords: ["whatsapp me at", "wechat", "telegram"]
  }
];

export const cryptoKeywords = ["bitcoin", "crypto"];

export const singaporeMobileRegex = /\+?65?[\s-]?[89]\d{7}/i;

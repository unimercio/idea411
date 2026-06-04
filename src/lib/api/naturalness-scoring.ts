/**
 * Naturalness scoring for AI Focus Group transcripts.
 *
 * Detects rote, templated, corporate, or "survey response" phrasing that
 * makes persona turns feel mechanical instead of like real people talking
 * in a room. Pure, deterministic — no I/O — so it's cheap to unit-test
 * and reusable in production telemetry.
 *
 * Score model (per turn, 0..100):
 *   start at 100, subtract penalties, floor at 0.
 *
 * Penalty buckets:
 *   - bannedOpening:   turn opens with "As a X", "Speaking as", "From my
 *                      perspective", "I think this product", etc.
 *   - corporateJargon: marketing/MBA vocabulary ("value proposition",
 *                      "pain point", "target demographic", "key
 *                      differentiator", "user experience", ...).
 *   - surveySpeak:     "I would purchase", "I would recommend", "this
 *                      product offers", "I feel positive about", ...
 *   - noContractions:  zero contractions in a 2+ sentence turn.
 *   - noConcreteness:  no number, brand, proper noun, currency, or
 *                      time/place specific — all abstract adjectives.
 *   - lowVoiceTexture: no filler/discourse markers (honestly, like, ugh,
 *                      hmm, wait, nah, okay so, I mean, ...) AND no
 *                      em-dash/ellipsis/mid-thought punctuation.
 *   - exclamationSpam: 2+ "!" in one turn.
 *
 * A turn is "flagged" when score < flagThreshold (default 60) or when any
 * single bucket triggers a hard flag (banned opening, corporate jargon,
 * survey speak).
 */

import { extractPersonaTurns } from "./persona-scoring";

export type NaturalnessOptions = {
  /** Per-turn score below which the turn is flagged. Default 60. */
  flagThreshold?: number;
};

const DEFAULTS: Required<NaturalnessOptions> = {
  flagThreshold: 60,
};

// ---- phrase banks (lowercase) ----

/** Hard-flagged openings (regex, anchored to start of turn after trim). */
const BANNED_OPENING_PATTERNS: RegExp[] = [
  /^as an?\s+\w+/i,
  /^speaking as\b/i,
  /^from my perspective\b/i,
  /^in my (?:opinion|view)\b/i,
  /^i think this product\b/i,
  /^this product (?:is|offers|provides|seems)\b/i,
  /^this is interesting because\b/i,
  /^i would (?:like to )?(?:purchase|recommend|buy this product)\b/i,
];

const CORPORATE_JARGON = [
  "value proposition",
  "pain point",
  "pain points",
  "target demographic",
  "target market",
  "key differentiator",
  "differentiator",
  "user experience",
  "ux",
  "go to market",
  "go-to-market",
  "product-market fit",
  "synergy",
  "leverage",
  "stakeholder",
  "core competency",
  "value-add",
  "value add",
  "low-hanging fruit",
  "circle back",
  "deep dive",
  "actionable insight",
  "actionable insights",
];

const SURVEY_SPEAK = [
  "i would purchase",
  "i would recommend",
  "i would consider buying",
  "this product offers",
  "this product provides",
  "this product seems",
  "i feel positive about",
  "i feel negative about",
  "overall i would",
  "in conclusion",
  "to summarize",
  "the target audience",
  "speaks to me as a consumer",
];

const FILLERS_AND_DISCOURSE = [
  "honestly",
  "like,",
  " like ",
  "ugh",
  "hmm",
  "wait",
  "okay so",
  "ok so",
  "i mean",
  "nah",
  "yeah but",
  "lowkey",
  "ngl",
  "frankly",
  "look",
  "y'all",
  "kinda",
  "sorta",
  "tbh",
  "uh,",
  "well,",
  "oh,",
];

const CONTRACTION_RE = /\b\w+'(?:s|t|re|ve|ll|d|m)\b/i;
const MIDTHOUGHT_RE = /(?:—|\.\.\.|–)/;
const CONCRETE_NUMERIC_RE =
  /(?:\$[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:%|bucks?|dollars?|euros?|min(?:utes?)?|hours?|days?|weeks?|months?|years?|am|pm|k)\b|\b\d{4}\b|\b\d+\b)/i;

/**
 * Concreteness check: a proper noun *after* the first word of a sentence, OR a
 * numeric/currency/duration token. Sentence-initial capitalization (e.g. "The",
 * "As") doesn't count because every sentence starts capitalized.
 */
function hasConcreteness(text: string): boolean {
  if (CONCRETE_NUMERIC_RE.test(text)) return true;
  const sentences = text.split(/[.!?]+\s*/);
  for (const s of sentences) {
    const words = s.trim().split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      if (/^[A-Z][a-zA-Z'’-]{1,}/.test(words[i])) return true;
    }
  }
  return false;
}


export type NaturalnessFlag =
  | "bannedOpening"
  | "corporateJargon"
  | "surveySpeak"
  | "noContractions"
  | "noConcreteness"
  | "lowVoiceTexture"
  | "exclamationSpam";

export type TurnNaturalness = {
  text: string;
  score: number;
  flags: NaturalnessFlag[];
  hits: {
    bannedOpening?: string;
    corporateJargon: string[];
    surveySpeak: string[];
  };
};

export type PersonaNaturalness = {
  name: string;
  turns: TurnNaturalness[];
  /** Mean per-turn score, 0..100. */
  averageScore: number;
  /** Share of turns flagged (score < flagThreshold or hard-flag bucket). */
  flagRate: number;
  /** Tally of how often each bucket triggered across this persona's turns. */
  flagCounts: Record<NaturalnessFlag, number>;
};

export type NaturalnessReport = {
  personas: PersonaNaturalness[];
  /** Mean turn score across all personas. */
  groupScore: number;
  /** Share of all turns that were flagged. */
  groupFlagRate: number;
  /** Bucket tally across the whole transcript. */
  groupFlagCounts: Record<NaturalnessFlag, number>;
};

const EMPTY_COUNTS = (): Record<NaturalnessFlag, number> => ({
  bannedOpening: 0,
  corporateJargon: 0,
  surveySpeak: 0,
  noContractions: 0,
  noConcreteness: 0,
  lowVoiceTexture: 0,
  exclamationSpam: 0,
});

export function scoreTurnNaturalness(turn: string): TurnNaturalness {
  const text = turn.trim();
  const lower = text.toLowerCase();
  const flags: NaturalnessFlag[] = [];
  const hits = {
    bannedOpening: undefined as string | undefined,
    corporateJargon: [] as string[],
    surveySpeak: [] as string[],
  };

  let score = 100;

  // 1. Banned openings — hard penalty.
  for (const re of BANNED_OPENING_PATTERNS) {
    const m = text.match(re);
    if (m) {
      flags.push("bannedOpening");
      hits.bannedOpening = m[0];
      score -= 30;
      break;
    }
  }

  // 2. Corporate jargon — per hit, capped.
  for (const phrase of CORPORATE_JARGON) {
    if (lower.includes(phrase)) hits.corporateJargon.push(phrase);
  }
  if (hits.corporateJargon.length > 0) {
    flags.push("corporateJargon");
    score -= Math.min(40, 15 * hits.corporateJargon.length);
  }

  // 3. Survey speak — per hit, capped.
  for (const phrase of SURVEY_SPEAK) {
    if (lower.includes(phrase)) hits.surveySpeak.push(phrase);
  }
  if (hits.surveySpeak.length > 0) {
    flags.push("surveySpeak");
    score -= Math.min(40, 20 * hits.surveySpeak.length);
  }

  // 4. No contractions in a 2+ sentence turn — sounds stiff/formal.
  const sentenceCount = countSentences(text);
  if (sentenceCount >= 2 && !CONTRACTION_RE.test(text)) {
    flags.push("noContractions");
    score -= 15;
  }

  // 5. No concreteness — purely abstract.
  if (!CONCRETE_RE.test(text)) {
    flags.push("noConcreteness");
    score -= 15;
  }

  // 6. Low voice texture — no fillers AND no mid-thought punctuation.
  const hasFiller = FILLERS_AND_DISCOURSE.some((f) => lower.includes(f));
  const hasMidThought = MIDTHOUGHT_RE.test(text);
  if (!hasFiller && !hasMidThought) {
    flags.push("lowVoiceTexture");
    score -= 10;
  }

  // 7. Exclamation spam.
  const bangs = (text.match(/!/g) ?? []).length;
  if (bangs >= 2) {
    flags.push("exclamationSpam");
    score -= 10;
  }

  if (score < 0) score = 0;
  return { text, score, flags, hits };
}

export function scorePersonaNaturalness(
  name: string,
  turns: string[],
  opts: NaturalnessOptions = {},
): PersonaNaturalness {
  const { flagThreshold } = { ...DEFAULTS, ...opts };
  const scored = turns.map((t) => scoreTurnNaturalness(t));
  const flagCounts = EMPTY_COUNTS();
  for (const t of scored) for (const f of t.flags) flagCounts[f] += 1;

  const n = scored.length || 1;
  const averageScore = Math.round(scored.reduce((s, t) => s + t.score, 0) / n);

  const hardFlag = (t: TurnNaturalness) =>
    t.flags.includes("bannedOpening") ||
    t.flags.includes("corporateJargon") ||
    t.flags.includes("surveySpeak");

  const flagged = scored.filter((t) => t.score < flagThreshold || hardFlag(t)).length;
  const flagRate = scored.length === 0 ? 0 : flagged / scored.length;

  return { name, turns: scored, averageScore, flagRate, flagCounts };
}

export function scoreFocusGroupNaturalness(
  transcript: string,
  personaNames: string[],
  opts: NaturalnessOptions = {},
): NaturalnessReport {
  const turnsByName = extractPersonaTurns(transcript, personaNames);
  const personas = personaNames.map((name) =>
    scorePersonaNaturalness(name, turnsByName[name] ?? [], opts),
  );

  const allTurns = personas.flatMap((p) => p.turns);
  const groupScore =
    allTurns.length === 0
      ? 0
      : Math.round(allTurns.reduce((s, t) => s + t.score, 0) / allTurns.length);

  const groupFlagCounts = EMPTY_COUNTS();
  for (const p of personas) {
    for (const k of Object.keys(groupFlagCounts) as NaturalnessFlag[]) {
      groupFlagCounts[k] += p.flagCounts[k];
    }
  }

  const { flagThreshold } = { ...DEFAULTS, ...opts };
  const hardFlag = (t: TurnNaturalness) =>
    t.flags.includes("bannedOpening") ||
    t.flags.includes("corporateJargon") ||
    t.flags.includes("surveySpeak");
  const flagged = allTurns.filter((t) => t.score < flagThreshold || hardFlag(t)).length;
  const groupFlagRate = allTurns.length === 0 ? 0 : flagged / allTurns.length;

  return { personas, groupScore, groupFlagRate, groupFlagCounts };
}

// ---- helpers ----

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const parts = trimmed
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length || 1;
}

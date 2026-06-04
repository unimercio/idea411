/**
 * Persona adherence scoring for AI Focus Group transcripts.
 *
 * Given a focus-group transcript and the persona spec the model was asked
 * to embody, compute a deterministic per-persona score covering:
 *   - skill activation (do they speak through their Unique Skill lens?)
 *   - psychographic anchoring (do their stated values/lifestyle show up?)
 *   - voice distinctness (slang/jargon/formality markers unique to them)
 *   - response length discipline (2–5 sentences per turn)
 *   - interaction (do they react to other personas by name?)
 *
 * Pure functions only — no I/O — so it is cheap to unit-test and can also
 * be reused in production telemetry to flag low-quality focus groups.
 */

export type PersonaSpec = {
  /** Display name exactly as it appears in the transcript, e.g. "Maya Chen". */
  name: string;
  /** The Unique Skill the model was asked to activate every turn. */
  uniqueSkill: string;
  /**
   * Lowercase keywords/phrases that prove the Unique Skill is being used as
   * a working lens (not just named). E.g. for "Budgeting enthusiast":
   *   ["budget", "cost per", "monthly", "save", "spend", "afford"]
   */
  skillKeywords: string[];
  /**
   * Lowercase keywords/phrases that prove the persona's stated
   * psychographics, values, lifestyle, or life context are showing up.
   * E.g. ["kids", "commute", "studio", "freelance", "retire"]
   */
  psychKeywords: string[];
  /**
   * Lowercase voice markers — slang, jargon, idioms, or formality cues
   * that should be specific to this persona. E.g. ["honestly", "lowkey",
   * "back in the day", "y'all", "per our findings"]
   */
  voiceMarkers: string[];
};

export type PersonaTurnScore = {
  text: string;
  sentenceCount: number;
  skillUse: 0 | 1;
  psychAnchor: 0 | 1;
  voiceDistinct: 0 | 1;
  lengthOk: 0 | 1;
  reactsToPeer: 0 | 1;
};

export type PersonaScore = {
  name: string;
  turns: PersonaTurnScore[];
  /** 0..1 share of turns that used the Unique Skill. */
  skillActivation: number;
  /** 0..1 share of turns with a psychographic anchor. */
  psychAnchoring: number;
  /** 0..1 share of turns with a distinct voice marker. */
  voiceDistinctness: number;
  /** 0..1 share of turns at 2–5 sentences. */
  lengthDiscipline: number;
  /** 0..1 share of turns that named another persona. */
  interaction: number;
  /** Weighted 0..100 overall character-fidelity score. */
  overall: number;
  /** True when overall >= passThreshold AND skillActivation >= skillFloor. */
  passed: boolean;
};

export type ScoreOptions = {
  /** Minimum overall score to count the persona as in-character. Default 70. */
  passThreshold?: number;
  /** Minimum skill activation rate required to pass. Default 0.8. */
  skillFloor?: number;
};

const DEFAULTS: Required<ScoreOptions> = {
  passThreshold: 70,
  skillFloor: 0.8,
};

/**
 * Extract per-persona turns from a transcript. Recognizes the lines our
 * focus-group prompt produces, which look like:
 *
 *   **Maya Chen:** I'd honestly check the unit cost first…
 *   **Maya Chen** — I'd honestly check the unit cost first…
 *   Maya Chen: I'd honestly check the unit cost first…
 *
 * A turn ends at the next persona line or a Markdown heading.
 */
export function extractPersonaTurns(
  transcript: string,
  personaNames: string[],
): Record<string, string[]> {
  const turns: Record<string, string[]> = Object.fromEntries(
    personaNames.map((n) => [n, [] as string[]]),
  );

  // Only look inside the discussion section if present, otherwise scan all.
  const discussionStart = transcript.search(/^##\s+Focus Group Discussion/im);
  const summaryStart = transcript.search(
    /^##\s+Moderator'?s? Final Insights|^##\s+Moderator'?s? Summary/im,
  );
  const body = transcript.slice(
    discussionStart >= 0 ? discussionStart : 0,
    summaryStart > 0 ? summaryStart : transcript.length,
  );

  const lines = body.split(/\r?\n/);
  let current: { name: string; buf: string[] } | null = null;

  const flush = () => {
    if (current && current.buf.length) {
      const text = current.buf.join(" ").replace(/\s+/g, " ").trim();
      if (text) turns[current.name].push(text);
    }
  };

  // Build a name → regex map. Names are matched case-insensitive at the
  // start of a line, optionally bolded, followed by `:` or `—`.
  const namePatterns = personaNames.map((name) => ({
    name,
    re: new RegExp(
      `^\\s*(?:\\*\\*)?${escapeRegex(name)}(?:\\*\\*)?\\s*[:\\u2014\\-]\\s*(.*)$`,
      "i",
    ),
  }));

  for (const raw of lines) {
    if (/^##\s+/.test(raw)) {
      flush();
      current = null;
      continue;
    }
    let matched = false;
    for (const { name, re } of namePatterns) {
      const m = raw.match(re);
      if (m) {
        flush();
        current = { name, buf: [m[1] ?? ""] };
        matched = true;
        break;
      }
    }
    if (!matched && current) {
      if (raw.trim()) current.buf.push(raw.trim());
    }
  }
  flush();

  return turns;
}

export function scorePersonaTurn(
  turn: string,
  persona: PersonaSpec,
  otherNames: string[],
): PersonaTurnScore {
  const lower = turn.toLowerCase();
  const sentenceCount = countSentences(turn);

  const skillUse = anyHit(lower, persona.skillKeywords) ? 1 : 0;
  const psychAnchor = anyHit(lower, persona.psychKeywords) ? 1 : 0;
  const voiceDistinct = anyHit(lower, persona.voiceMarkers) ? 1 : 0;
  const lengthOk = sentenceCount >= 2 && sentenceCount <= 5 ? 1 : 0;
  const reactsToPeer = otherNames.some((n) =>
    new RegExp(`\\b${escapeRegex(n.split(" ")[0])}\\b`, "i").test(turn),
  )
    ? 1
    : 0;

  return {
    text: turn,
    sentenceCount,
    skillUse,
    psychAnchor,
    voiceDistinct,
    lengthOk,
    reactsToPeer,
  };
}

export function scorePersona(
  persona: PersonaSpec,
  turns: string[],
  otherNames: string[],
  opts: ScoreOptions = {},
): PersonaScore {
  const { passThreshold, skillFloor } = { ...DEFAULTS, ...opts };
  const scored = turns.map((t) => scorePersonaTurn(t, persona, otherNames));

  const n = scored.length || 1;
  const avg = (key: keyof PersonaTurnScore) =>
    scored.reduce((s, t) => s + (t[key] as number), 0) / n;

  const skillActivation = avg("skillUse");
  const psychAnchoring = avg("psychAnchor");
  const voiceDistinctness = avg("voiceDistinct");
  const lengthDiscipline = avg("lengthOk");
  const interaction = avg("reactsToPeer");

  // Weights: skill activation is the highest-priority rule in the prompt.
  const overall = Math.round(
    (skillActivation * 0.4 +
      psychAnchoring * 0.2 +
      voiceDistinctness * 0.15 +
      lengthDiscipline * 0.15 +
      interaction * 0.1) *
      100,
  );

  return {
    name: persona.name,
    turns: scored,
    skillActivation,
    psychAnchoring,
    voiceDistinctness,
    lengthDiscipline,
    interaction,
    overall,
    passed: overall >= passThreshold && skillActivation >= skillFloor && scored.length > 0,
  };
}

export type FocusGroupScoreReport = {
  personas: PersonaScore[];
  /** Average of per-persona overall scores. */
  groupOverall: number;
  /** Share of personas that passed. */
  passRate: number;
};

export function scoreFocusGroup(
  transcript: string,
  personas: PersonaSpec[],
  opts: ScoreOptions = {},
): FocusGroupScoreReport {
  const names = personas.map((p) => p.name);
  const byName = extractPersonaTurns(transcript, names);

  const reports = personas.map((p) =>
    scorePersona(
      p,
      byName[p.name] ?? [],
      names.filter((n) => n !== p.name),
      opts,
    ),
  );

  const groupOverall =
    reports.length === 0
      ? 0
      : Math.round(reports.reduce((s, r) => s + r.overall, 0) / reports.length);
  const passRate =
    reports.length === 0 ? 0 : reports.filter((r) => r.passed).length / reports.length;

  return { personas: reports, groupOverall, passRate };
}

// ---------- helpers ----------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function anyHit(haystackLower: string, needles: string[]): boolean {
  return needles.some((n) => n && haystackLower.includes(n.toLowerCase()));
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Split on sentence terminators followed by whitespace or end; collapse runs.
  const parts = trimmed
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length || 1;
}

import { describe, it, expect } from "vitest";
import {
  scoreTurnNaturalness,
  scorePersonaNaturalness,
  scoreFocusGroupNaturalness,
} from "./naturalness-scoring";

describe("scoreTurnNaturalness", () => {
  it("rewards natural, concrete, contraction-rich speech", () => {
    const turn =
      "Honestly Walter, fifty bucks a month is a hard no — my rent in Brooklyn already eats half my paycheck. I'd want to see the cost per use before I'd even click buy.";
    const r = scoreTurnNaturalness(turn);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.flags).toHaveLength(0);
  });

  it("hard-flags banned 'As a X' opening", () => {
    const r = scoreTurnNaturalness(
      "As a busy professional, I appreciate the convenience of this offering.",
    );
    expect(r.flags).toContain("bannedOpening");
    expect(r.hits.bannedOpening).toMatch(/as a/i);
    expect(r.score).toBeLessThan(60);
  });

  it("flags corporate jargon and survey speak together", () => {
    const r = scoreTurnNaturalness(
      "This product offers a strong value proposition for the target demographic, and I would purchase it.",
    );
    expect(r.flags).toEqual(
      expect.arrayContaining(["corporateJargon", "surveySpeak"]),
    );
    expect(r.hits.corporateJargon.length).toBeGreaterThan(0);
    expect(r.hits.surveySpeak.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(40);
  });

  it("flags stiff turns: no contractions, no concreteness, no voice texture", () => {
    const r = scoreTurnNaturalness(
      "The concept is appealing. The execution will determine adoption among interested parties.",
    );
    expect(r.flags).toEqual(
      expect.arrayContaining([
        "noContractions",
        "noConcreteness",
        "lowVoiceTexture",
      ]),
    );
    expect(r.score).toBeLessThan(70);
  });

  it("flags exclamation spam", () => {
    const r = scoreTurnNaturalness("I love it! It's so great! Amazing!");
    expect(r.flags).toContain("exclamationSpam");
  });
});

describe("scorePersonaNaturalness", () => {
  it("aggregates per-turn scores and tallies flag buckets", () => {
    const turns = [
      "Honestly, I'd buy it tomorrow — my old blender died last Tuesday and I'm tired of cold smoothies.",
      "As a busy mom, I appreciate the value proposition and would recommend it.",
    ];
    const p = scorePersonaNaturalness("Maya Chen", turns);
    expect(p.turns).toHaveLength(2);
    expect(p.turns[0].score).toBeGreaterThan(p.turns[1].score);
    expect(p.flagCounts.bannedOpening).toBe(1);
    expect(p.flagCounts.corporateJargon).toBe(1);
    expect(p.flagRate).toBe(0.5);
  });
});

describe("scoreFocusGroupNaturalness", () => {
  const natural = `
## Focus Group Discussion

**Maya Chen:** Honestly Walter, fifty bucks a month is a hard no — my rent in Brooklyn already eats half my paycheck. I'd want to see the cost per use before I'd click buy.
**Walter Brennan:** Frankly Maya, I'm with you on price, but back in my garage in Toledo I've watched three "smart" gadgets brick themselves inside 18 months. Show me the warranty.
`;

  const rote = `
## Focus Group Discussion

**Maya Chen:** As a busy professional, I appreciate the value proposition of this product. It offers a strong user experience for the target demographic. I would purchase it.
**Walter Brennan:** This product seems well designed. The concept is appealing and addresses key pain points. Overall I would recommend it to interested parties.
`;

  it("scores a natural transcript high with a low flag rate", () => {
    const r = scoreFocusGroupNaturalness(natural, ["Maya Chen", "Walter Brennan"]);
    expect(r.groupScore).toBeGreaterThanOrEqual(85);
    expect(r.groupFlagRate).toBeLessThanOrEqual(0.1);
  });

  it("scores a rote transcript low and flags every turn", () => {
    const r = scoreFocusGroupNaturalness(rote, ["Maya Chen", "Walter Brennan"]);
    expect(r.groupScore).toBeLessThan(50);
    expect(r.groupFlagRate).toBe(1);
    expect(r.groupFlagCounts.corporateJargon).toBeGreaterThan(0);
    expect(r.groupFlagCounts.surveySpeak).toBeGreaterThan(0);
    expect(r.groupFlagCounts.bannedOpening).toBeGreaterThan(0);
  });
});

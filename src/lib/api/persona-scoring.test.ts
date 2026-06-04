import { describe, it, expect } from "vitest";
import {
  extractPersonaTurns,
  scorePersona,
  scoreFocusGroup,
  type PersonaSpec,
} from "./persona-scoring";

const personas: PersonaSpec[] = [
  {
    name: "Maya Chen",
    uniqueSkill: "Budgeting enthusiast",
    skillKeywords: ["budget", "cost per", "monthly", "save", "afford", "spend"],
    psychKeywords: ["freelance", "studio", "rent", "side gig"],
    voiceMarkers: ["honestly", "lowkey", "ngl"],
  },
  {
    name: "Walter Brennan",
    uniqueSkill: "Retired engineer / reliability nerd",
    skillKeywords: ["tolerance", "failure mode", "mtbf", "warranty", "build quality", "spec"],
    psychKeywords: ["grandkids", "garage", "workshop", "retired"],
    voiceMarkers: ["back in my day", "frankly", "let me tell you"],
  },
];

const goodTranscript = `
## Focus Group Discussion

### Question 1

**Maya Chen:** Honestly, my first question is the monthly cost — I'm freelance and rent in a tiny studio, so anything over fifty bucks a month is a hard no. I'd want to see the cost per use before I'd even click buy. Lowkey though, the design is cute.

**Walter Brennan:** Frankly Maya, price is the easy part. I want the failure mode analysis and the warranty terms; back in my day we'd never ship something without a published MTBF. Out in my garage I've seen "smart" gadgets brick themselves in eighteen months.

### Question 2

**Maya Chen:** Walter's right that warranty matters, but I'm still stuck on the budget side — if I can't fit it into my monthly side gig income, the warranty is moot. Honestly the subscription model worries me more than the hardware.

**Walter Brennan:** Let me tell you, Maya, I've watched my grandkids get burned by subscriptions too. The build quality and spec sheet would have to be exceptional to justify a recurring charge. Frankly, sell it once, sell it well.
`;

const badTranscript = `
## Focus Group Discussion

**Maya Chen:** This product seems interesting and I think a lot of people would like it. It has nice features. Overall I would consider buying it depending on the situation.

**Walter Brennan:** I agree that the product is interesting. It seems well designed and modern. I think the target market will respond positively. There are many opportunities here. I could see this being successful in multiple verticals if positioned correctly.
`;

describe("extractPersonaTurns", () => {
  it("groups turns under the correct persona and stops at the Moderator summary", () => {
    const transcriptWithSummary =
      goodTranscript +
      `\n## Moderator's Final Insights & Recommendations\n- Maya Chen pushed back on pricing.\n- Walter Brennan asked for reliability data.\n`;

    const turns = extractPersonaTurns(transcriptWithSummary, [
      "Maya Chen",
      "Walter Brennan",
    ]);

    expect(turns["Maya Chen"]).toHaveLength(2);
    expect(turns["Walter Brennan"]).toHaveLength(2);
    expect(turns["Maya Chen"][0]).toMatch(/freelance/);
    // Summary bullets must not leak into persona turns.
    expect(turns["Maya Chen"].join(" ")).not.toMatch(/pushed back on pricing/);
  });
});

describe("scorePersona", () => {
  it("rewards turns that activate the Unique Skill, anchor psychographics, and use voice markers", () => {
    const turns = extractPersonaTurns(goodTranscript, [
      "Maya Chen",
      "Walter Brennan",
    ]);
    const maya = scorePersona(personas[0], turns["Maya Chen"], ["Walter Brennan"]);

    expect(maya.skillActivation).toBe(1);
    expect(maya.psychAnchoring).toBeGreaterThan(0.5);
    expect(maya.voiceDistinctness).toBe(1);
    expect(maya.lengthDiscipline).toBe(1);
    expect(maya.interaction).toBeGreaterThanOrEqual(0.5);
    expect(maya.overall).toBeGreaterThanOrEqual(85);
    expect(maya.passed).toBe(true);
  });

  it("flags generic, voiceless responses with no skill lens as failing", () => {
    const turns = extractPersonaTurns(badTranscript, [
      "Maya Chen",
      "Walter Brennan",
    ]);

    const maya = scorePersona(personas[0], turns["Maya Chen"], ["Walter Brennan"]);
    const walter = scorePersona(personas[1], turns["Walter Brennan"], ["Maya Chen"]);

    expect(maya.skillActivation).toBe(0);
    expect(maya.voiceDistinctness).toBe(0);
    expect(maya.passed).toBe(false);

    // Walter's turn lacks his reliability-engineer skill lens and any voice marker.
    expect(walter.skillActivation).toBe(0);
    expect(walter.voiceDistinctness).toBe(0);
    expect(walter.psychAnchoring).toBe(0);
    expect(walter.passed).toBe(false);
  });

  it("requires skill activation above the floor even when other dimensions are strong", () => {
    const transcript = `
## Focus Group Discussion
**Maya Chen:** Honestly Walter, I freelance out of my studio and the rent keeps creeping up. I love the look of this, lowkey. Walter, what do you think about the build?
**Maya Chen:** Lowkey it's giving high-end, but Walter's point about durability sticks with me. My side gig income is tight this quarter.
`;
    const turns = extractPersonaTurns(transcript, ["Maya Chen", "Walter Brennan"]);
    const maya = scorePersona(personas[0], turns["Maya Chen"], ["Walter Brennan"]);

    // Voice + psych + interaction are all great, but the budgeting skill lens
    // is missing — pass must be false because skillActivation < floor.
    expect(maya.voiceDistinctness).toBe(1);
    expect(maya.psychAnchoring).toBe(1);
    expect(maya.interaction).toBe(1);
    expect(maya.skillActivation).toBe(0);
    expect(maya.passed).toBe(false);
  });
});

describe("scoreFocusGroup", () => {
  it("aggregates per-persona scores into a group report", () => {
    const good = scoreFocusGroup(goodTranscript, personas);
    expect(good.personas).toHaveLength(2);
    expect(good.passRate).toBe(1);
    expect(good.groupOverall).toBeGreaterThanOrEqual(80);

    const bad = scoreFocusGroup(badTranscript, personas);
    expect(bad.passRate).toBe(0);
    expect(bad.groupOverall).toBeLessThan(40);
  });
});

// Client-side deliverable generators. Produce tailored files from the
// project's idea + scores. Swap for server-rendered assets once Lovable
// Cloud + a render/IP pipeline are wired up.
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { Project } from "./projects";
import { overallScore } from "./projects";

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "idea";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function scoreLine(p: Project): string {
  if (!p.scores) return "Vetting pending.";
  const o = overallScore(p.scores);
  return `Forge Score ${o} · Compliance ${p.scores.compliance} · Market ${p.scores.market} · Demand ${p.scores.demand}`;
}

/* ───────── Patent draft (PDF) ───────── */
export function downloadPatent(p: Project) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 64;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const writeHeading = (text: string, size = 14) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size + 8;
  };
  const writeBody = (text: string, size = 11) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += size + 4;
    }
    y += 8;
  };

  writeHeading("PROVISIONAL PATENT APPLICATION", 16);
  writeBody(`Title: ${p.title}`);
  writeBody(`Filed (draft): ${new Date(p.updatedAt).toLocaleDateString()}`);
  writeBody(scoreLine(p));

  writeHeading("Field of the Invention");
  writeBody(
    `The present invention relates to systems and methods described as: ${p.idea}`,
  );

  writeHeading("Background");
  writeBody(
    "Existing solutions in this domain suffer from limitations in cost, accessibility, " +
      "and user experience. There remains a need for an improved approach that addresses " +
      "the shortcomings identified during prior-art review.",
  );

  writeHeading("Summary of the Invention");
  writeBody(
    `Disclosed herein is an apparatus and/or method directed to: ${p.idea}. ` +
      "Embodiments described below provide novel structural and functional elements " +
      "yielding measurable improvements over the prior art.",
  );

  writeHeading("Detailed Description");
  writeBody(
    "In one embodiment, the invention comprises a primary assembly configured to perform " +
      "the core function described above. Additional embodiments include alternative " +
      "materials, form factors, and control schemes. Figures 1-4 (to be supplied) illustrate " +
      "representative configurations.",
  );

  writeHeading("Claims (Draft)");
  writeBody("1. An apparatus comprising the elements described in the summary above.");
  writeBody("2. The apparatus of claim 1, further comprising a user-facing interface.");
  writeBody("3. A method of operating the apparatus of claim 1.");
  writeBody("4. The method of claim 3, wherein operation is performed automatically.");

  writeHeading("Abstract");
  writeBody(
    `A provisional disclosure covering: ${p.idea}. This draft is attorney-reviewable and ` +
      "intended as the basis for a formal USPTO filing.",
  );

  doc.save(`${slug(p.title)}-provisional-patent.pdf`);
}

/* ───────── Crowdfund kit (ZIP of markdown) ───────── */
export async function downloadCrowdfund(p: Project) {
  const zip = new JSZip();
  const head = `# ${p.title} — Crowdfund Kit\n\n> ${p.idea}\n\n${scoreLine(p)}\n\n`;

  zip.file(
    "README.md",
    head +
      "## Contents\n- pitch-video-script.md\n- reward-tiers.md\n- launch-sequence.md\n- press-release.md\n",
  );

  zip.file(
    "pitch-video-script.md",
    `# Pitch video script\n\n**Hook (0:00-0:10)** — "${p.title}" reframed as a problem worth solving.\n\n**Problem (0:10-0:30)** — Why today's options fall short.\n\n**Solution (0:30-1:30)** — Walk through ${p.idea}.\n\n**Proof (1:30-2:00)** — ${scoreLine(p)}\n\n**Ask (2:00-2:30)** — Back the project, pick a tier, share.\n`,
  );

  zip.file(
    "reward-tiers.md",
    `# Reward tiers\n\n| Tier | Pledge | Reward |\n|---|---|---|\n| Early Bird | $39 | 1× ${p.title} (40% off retail) |\n| Standard | $59 | 1× ${p.title} + sticker pack |\n| Double Up | $109 | 2× ${p.title} + signed thank-you |\n| Studio | $499 | 10× ${p.title} + custom engraving |\n`,
  );

  zip.file(
    "launch-sequence.md",
    "# Launch sequence\n\n- T-30: Teaser landing page live, email capture\n- T-14: Press list outreach\n- T-7: Influencer seeding\n- T-0: Campaign goes live, email blast\n- T+3: Stretch goal #1\n- T+14: Mid-campaign update video\n- T+28: Final 48h push\n",
  );

  zip.file(
    "press-release.md",
    `# FOR IMMEDIATE RELEASE\n\n**${p.title} launches on crowdfunding today.**\n\n${p.idea}\n\nVetting summary: ${scoreLine(p)}\n\nFor press inquiries, contact press@ideaforge.app.\n`,
  );

  const blob = await zip.generateAsync({ type: "blob" });
  saveBlob(blob, `${slug(p.title)}-crowdfund-kit.zip`);
}

export function downloadDeliverable(key: string, p: Project) {
  switch (key) {
    case "patent":
      return downloadPatent(p);
    case "crowdfund":
      return downloadCrowdfund(p);
  }
}


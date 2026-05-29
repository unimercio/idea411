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

/* ───────── Renders (PNG placeholder generated via canvas) ───────── */
export function downloadRenders(p: Project) {
  const w = 2048;
  const h = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // backdrop
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#1a1a1a");
  grad.addColorStop(1, "#2d2d2d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ember glow
  const glow = ctx.createRadialGradient(w * 0.7, h * 0.5, 50, w * 0.7, h * 0.5, 900);
  glow.addColorStop(0, "rgba(232, 93, 58, 0.55)");
  glow.addColorStop(1, "rgba(232, 93, 58, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // product silhouette (rounded rect)
  ctx.fillStyle = "rgba(20,20,20,0.85)";
  ctx.strokeStyle = "rgba(232,93,58,0.9)";
  ctx.lineWidth = 4;
  const px = w * 0.18,
    py = h * 0.28,
    pw = w * 0.45,
    ph = h * 0.44,
    r = 32;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, r);
  ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r);
  ctx.arcTo(px, py, px + pw, py, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // text
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "600 64px Inter, system-ui, sans-serif";
  ctx.fillText(p.title, 96, 140);
  ctx.fillStyle = "#a0a0a0";
  ctx.font = "400 28px Inter, system-ui, sans-serif";
  ctx.fillText("IdeaForge studio render · concept v1", 96, 188);
  ctx.fillStyle = "#e85d3a";
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillText(scoreLine(p), 96, h - 96);

  canvas.toBlob((blob) => {
    if (blob) saveBlob(blob, `${slug(p.title)}-render.png`);
  }, "image/png");
}

/* ───────── Pre-order landing page (HTML) ───────── */
export function downloadPreorder(p: Project) {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(p.title)} — Pre-order</title>
<meta name="description" content="${esc(p.idea).slice(0, 155)}" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #1a1a1a; color: #f5f5f5; line-height: 1.5; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 96px 24px; }
  .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(232,93,58,0.12); color: #e85d3a; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
  h1 { font-size: clamp(40px, 6vw, 72px); margin: 24px 0 16px; letter-spacing: -0.02em; }
  p.lead { font-size: 20px; color: #c0c0c0; max-width: 640px; }
  .score { margin-top: 32px; padding: 20px 24px; border: 1px solid #333; border-radius: 16px; background: #222; font-size: 14px; color: #d0d0d0; }
  form { margin-top: 40px; display: flex; gap: 12px; flex-wrap: wrap; }
  input[type=email] { flex: 1 1 280px; padding: 14px 18px; border-radius: 999px; border: 1px solid #333; background: #111; color: #f5f5f5; font-size: 15px; }
  button { padding: 14px 28px; border-radius: 999px; border: 0; background: linear-gradient(135deg, #e85d3a, #f0865f); color: #1a1a1a; font-weight: 600; font-size: 15px; cursor: pointer; }
  footer { margin-top: 96px; color: #707070; font-size: 13px; }
</style>
</head>
<body>
  <main class="wrap">
    <span class="badge">Pre-order · Limited run</span>
    <h1>${esc(p.title)}</h1>
    <p class="lead">${esc(p.idea)}</p>
    <div class="score"><strong>Vetting summary.</strong> ${esc(scoreLine(p))}</div>
    <form onsubmit="event.preventDefault(); this.querySelector('button').textContent='Reserved ✓';">
      <input type="email" required placeholder="you@domain.com" />
      <button type="submit">Reserve mine — $1 hold</button>
    </form>
    <footer>Forged with IdeaForge · ${new Date(p.updatedAt).toLocaleDateString()}</footer>
  </main>
</body>
</html>`;
  saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${slug(p.title)}-preorder.html`);
}

export function downloadDeliverable(key: string, p: Project) {
  switch (key) {
    case "renders":
      return downloadRenders(p);
    case "patent":
      return downloadPatent(p);
    case "crowdfund":
      return downloadCrowdfund(p);
    case "preorder":
      return downloadPreorder(p);
  }
}

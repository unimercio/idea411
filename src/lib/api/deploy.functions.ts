import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REPO = "unimercio/idea411";
const WORKFLOW_FILE = "deploy-vps.yml";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function ghHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "idea411-deploy",
  };
}

export type DeployRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  display_title: string;
  head_branch: string | null;
  run_number: number;
  actor: string | null;
};

export type DeployStep = {
  name: string;
  status: string | null;
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
};

export type DeployJob = {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  steps: DeployStep[];
};

export type DeployRunDetail = {
  run: DeployRun;
  jobs: DeployJob[];
  logs: string | null;
  logsTruncated: boolean;
};

export const triggerVpsDeploy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ref: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[A-Za-z0-9._\/\-]+$/)
          .default("main"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ref: data.ref, inputs: { ref: data.ref } }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub dispatch failed (${res.status}): ${text}`);
    }
    return { ok: true, dispatchedRef: data.ref, dispatchedAt: new Date().toISOString() };
  });

export const listVpsDeployRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=15`,
      { headers: ghHeaders(token) },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub list runs failed (${res.status}): ${text}`);
    }
    const json = (await res.json()) as any;
    const runs: DeployRun[] = (json.workflow_runs ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      conclusion: r.conclusion,
      created_at: r.created_at,
      updated_at: r.updated_at,
      html_url: r.html_url,
      display_title: r.display_title ?? r.name ?? "Deploy",
      head_branch: r.head_branch,
      run_number: r.run_number,
      actor: r.actor?.login ?? null,
    }));
    return { runs };
  });

function mapRun(r: any): DeployRun {
  return {
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
    display_title: r.display_title ?? r.name ?? "Deploy",
    head_branch: r.head_branch,
    run_number: r.run_number,
    actor: r.actor?.login ?? null,
  };
}

const MAX_LOG_BYTES = 256 * 1024; // 256 KB cap returned to client

export const getDeployRunDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ runId: z.number().int().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured");

    const [runRes, jobsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/actions/runs/${data.runId}`, {
        headers: ghHeaders(token),
      }),
      fetch(
        `https://api.github.com/repos/${REPO}/actions/runs/${data.runId}/jobs?per_page=20`,
        { headers: ghHeaders(token) },
      ),
    ]);
    if (!runRes.ok) throw new Error(`GitHub run fetch failed (${runRes.status})`);
    if (!jobsRes.ok) throw new Error(`GitHub jobs fetch failed (${jobsRes.status})`);

    const runJson = await runRes.json();
    const jobsJson = (await jobsRes.json()) as any;

    const jobs: DeployJob[] = (jobsJson.jobs ?? []).map((j: any) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: j.started_at,
      completed_at: j.completed_at,
      html_url: j.html_url,
      steps: (j.steps ?? []).map((s: any) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        number: s.number,
        started_at: s.started_at,
        completed_at: s.completed_at,
      })),
    }));

    // Logs only become available once a job is finished.
    let logs: string | null = null;
    let logsTruncated = false;
    const completedJob = jobs.find((j) => j.status === "completed");
    if (completedJob) {
      const logRes = await fetch(
        `https://api.github.com/repos/${REPO}/actions/jobs/${completedJob.id}/logs`,
        { headers: ghHeaders(token), redirect: "follow" },
      );
      if (logRes.ok) {
        const text = await logRes.text();
        if (text.length > MAX_LOG_BYTES) {
          logs = text.slice(text.length - MAX_LOG_BYTES);
          logsTruncated = true;
        } else {
          logs = text;
        }
      }
    }

    return {
      run: mapRun(runJson),
      jobs,
      logs,
      logsTruncated,
    } satisfies DeployRunDetail;
  });


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

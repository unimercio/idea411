import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  isSysadmin: boolean;
  users: {
    total: number;
    newThisWeek: number;
    admins: number;
    sysadmins: number;
  };
  projects: {
    total: number;
    ready: number;
    vetting: number;
    newThisWeek: number;
  };
  templates: { total: number; enabled: number; lastEditedAt: string | null };
  skills: { total: number; enabled: number };
  recentSignups: { id: string; email: string | null; created_at: string; roles: string[] }[];
  recentActivity: {
    id: string;
    action: string;
    actor_email: string | null;
    target_email: string | null;
    created_at: string;
  }[];
  usage: { date: string; signups: number; projects: number }[]; // last 30 days
  topIdeas: {
    id: string;
    title: string;
    score: number | null;
    user_email: string | null;
    updated_at: string;
  }[]; // sysadmin only
  health: {
    aiGatewayKeySet: boolean;
    errorCount24h: number;
  };
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sysRes = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "sysadmin" as any,
    });
    const isSysadmin = Boolean(sysRes.data);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      profilesTotal,
      profilesNew,
      rolesRows,
      projectsTotal,
      projectsReady,
      projectsVetting,
      projectsNew,
      templatesAll,
      skillsAll,
      signupsRecent,
      activityRecent,
      profilesForUsage,
      projectsForUsage,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("projects").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "ready"),
      supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("status", "vetting"),
      supabaseAdmin
        .from("projects")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabaseAdmin
        .from("prompt_templates")
        .select("id, enabled, updated_at")
        .order("updated_at", { ascending: false }),
      supabaseAdmin.from("model_skills").select("id, enabled"),
      supabaseAdmin
        .from("profiles")
        .select("user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("admin_audit_log")
        .select("id, action, actor_email, target_email, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyAgo.toISOString()),
      supabaseAdmin
        .from("projects")
        .select("created_at")
        .gte("created_at", thirtyAgo.toISOString()),
    ]);

    const admins = (rolesRows.data ?? []).filter((r: any) => r.role === "admin").length;
    const sysadmins = (rolesRows.data ?? []).filter((r: any) => r.role === "sysadmin").length;
    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRows.data ?? []) {
      const a = rolesByUser.get(r.user_id) ?? [];
      a.push(r.role as string);
      rolesByUser.set(r.user_id, a);
    }

    // Hydrate signup emails via auth.admin
    const signupUserIds = (signupsRecent.data ?? []).map((r: any) => r.user_id);
    const emailMap = new Map<string, string | null>();
    if (signupUserIds.length > 0) {
      await Promise.all(
        signupUserIds.map(async (uid: string) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
          emailMap.set(uid, data?.user?.email ?? null);
        }),
      );
    }

    const recentSignups = (signupsRecent.data ?? []).map((r: any) => ({
      id: r.user_id,
      email: emailMap.get(r.user_id) ?? null,
      created_at: r.created_at,
      roles: rolesByUser.get(r.user_id) ?? [],
    }));

    // Build 30-day buckets
    const buckets = new Map<string, { signups: number; projects: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      buckets.set(isoDay(d), { signups: 0, projects: 0 });
    }
    for (const p of profilesForUsage.data ?? []) {
      const k = isoDay(new Date((p as any).created_at));
      const b = buckets.get(k);
      if (b) b.signups += 1;
    }
    for (const p of projectsForUsage.data ?? []) {
      const k = isoDay(new Date((p as any).created_at));
      const b = buckets.get(k);
      if (b) b.projects += 1;
    }
    const usage = Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));

    // Top ideas (sysadmin only)
    let topIdeas: AdminStats["topIdeas"] = [];
    if (isSysadmin) {
      const { data: topRows } = await supabaseAdmin
        .from("projects")
        .select("id, title, user_id, data, updated_at, status")
        .eq("status", "ready")
        .order("updated_at", { ascending: false })
        .limit(50);
      const enriched = (topRows ?? [])
        .map((r: any) => {
          const s = r.data?.scores;
          const score = s
            ? Math.round(s.compliance * 0.3 + s.market * 0.35 + s.demand * 0.35)
            : null;
          return {
            id: r.id as string,
            title: r.title as string,
            score,
            user_id: r.user_id as string,
            updated_at: r.updated_at as string,
          };
        })
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .slice(0, 5);
      const ids = Array.from(new Set(enriched.map((e) => e.user_id)));
      const map = new Map<string, string | null>();
      await Promise.all(
        ids.map(async (uid) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
          map.set(uid, data?.user?.email ?? null);
        }),
      );
      topIdeas = enriched.map((e) => ({
        id: e.id,
        title: e.title,
        score: e.score,
        updated_at: e.updated_at,
        user_email: map.get(e.user_id) ?? null,
      }));
    }

    const templates = templatesAll.data ?? [];
    const skills = skillsAll.data ?? [];

    const errorCount24h = (activityRecent.data ?? []).filter((e: any) =>
      String(e.action).startsWith("error."),
    ).length;

    return {
      isSysadmin,
      users: {
        total: profilesTotal.count ?? 0,
        newThisWeek: profilesNew.count ?? 0,
        admins,
        sysadmins,
      },
      projects: {
        total: projectsTotal.count ?? 0,
        ready: projectsReady.count ?? 0,
        vetting: projectsVetting.count ?? 0,
        newThisWeek: projectsNew.count ?? 0,
      },
      templates: {
        total: templates.length,
        enabled: templates.filter((t: any) => t.enabled).length,
        lastEditedAt: (templates[0] as any)?.updated_at ?? null,
      },
      skills: {
        total: skills.length,
        enabled: skills.filter((s: any) => s.enabled).length,
      },
      recentSignups,
      recentActivity: (activityRecent.data ?? []) as any,
      usage,
      topIdeas,
      health: {
        aiGatewayKeySet:
          !!process.env.LOVABLE_API_KEY || !!process.env.OPENROUTER_API_KEY,
        errorCount24h,
      },
    } satisfies AdminStats;
  });

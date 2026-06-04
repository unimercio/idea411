import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  roles: string[];
};

export type AuditLogEntry = {
  id: string;
  action: string;
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_email: string | null;
  details: Record<string, string | number | boolean | null>;
  created_at: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

async function assertSysadmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "sysadmin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: sysadmin role required");
}

async function recordAudit(
  admin: any,
  entry: {
    action: string;
    actor_user_id: string;
    actor_email: string | null;
    target_user_id?: string | null;
    target_email?: string | null;
    details?: Record<string, string | number | boolean | null>;
  },
) {
  const { error } = await admin.from("admin_audit_log").insert({
    action: entry.action,
    actor_user_id: entry.actor_user_id,
    actor_email: entry.actor_email,
    target_user_id: entry.target_user_id ?? null,
    target_email: entry.target_email ?? null,
    details: entry.details ?? {},
  });
  if (error) console.error("audit log insert failed", error);
}

async function getActorEmail(admin: any, actorId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(actorId);
  return data?.user?.email ?? null;
}

async function getTargetEmail(admin: any, targetId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(targetId);
  return data?.user?.email ?? null;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (usersErr) throw new Error(usersErr.message);

    const { data: rolesData, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesData ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      rolesByUser.set(r.user_id, arr);
    }

    const users: AdminUserRow[] = (usersData?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }));

    return { users, currentUserId: userId };
  });

// Only sysadmins can grant/revoke the admin role. When revoking admin, also
// revoke sysadmin (sysadmin implies admin).
export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid(), makeAdmin: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSysadmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.targetUserId, role: "admin" },
          { onConflict: "user_id,role" },
        );
      if (error) throw new Error(error.message);
    } else {
      // Cascade: revoking admin also removes sysadmin (sysadmin requires admin).
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .in("role", ["admin", "sysadmin"]);
      if (error) throw new Error(error.message);
    }

    const [actorEmail, targetEmail] = await Promise.all([
      getActorEmail(supabaseAdmin, userId),
      getTargetEmail(supabaseAdmin, data.targetUserId),
    ]);
    await recordAudit(supabaseAdmin, {
      action: data.makeAdmin ? "role.admin.grant" : "role.admin.revoke",
      actor_user_id: userId,
      actor_email: actorEmail,
      target_user_id: data.targetUserId,
      target_email: targetEmail,
      details: { role: "admin" },
    });

    return { ok: true };
  });

// Only sysadmins can grant/revoke the sysadmin role. Granting sysadmin also
// grants admin so all existing admin policies apply.
export const setUserSysadmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid(), makeSysadmin: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSysadmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.makeSysadmin) {
      const { error: aErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.targetUserId, role: "admin" }, { onConflict: "user_id,role" });
      if (aErr) throw new Error(aErr.message);
      const { error: sErr } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.targetUserId, role: "sysadmin" as any }, { onConflict: "user_id,role" });
      if (sErr) throw new Error(sErr.message);
    } else {
      if (data.targetUserId === userId) {
        const { count, error: cErr } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "sysadmin" as any);
        if (cErr) throw new Error(cErr.message);
        if ((count ?? 0) <= 1) {
          throw new Error("Cannot remove the last sysadmin.");
        }
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", "sysadmin" as any);
      if (error) throw new Error(error.message);
    }

    const [actorEmail, targetEmail] = await Promise.all([
      getActorEmail(supabaseAdmin, userId),
      getTargetEmail(supabaseAdmin, data.targetUserId),
    ]);
    await recordAudit(supabaseAdmin, {
      action: data.makeSysadmin ? "role.sysadmin.grant" : "role.sysadmin.revoke",
      actor_user_id: userId,
      actor_email: actorEmail,
      target_user_id: data.targetUserId,
      target_email: targetEmail,
      details: { role: "sysadmin" },
    });

    return { ok: true };
  });

// Bootstrap: any signed-in user can claim sysadmin if none exists yet.
// Also grants admin so admin policies apply.
export const claimFirstSysadmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "sysadmin" as any);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) return { claimed: false };

    const { error: aErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (aErr) throw new Error(aErr.message);
    const { error: sErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "sysadmin" as any }, { onConflict: "user_id,role" });
    if (sErr) throw new Error(sErr.message);

    const actorEmail = await getActorEmail(supabaseAdmin, userId);
    await recordAudit(supabaseAdmin, {
      action: "role.sysadmin.claim_first",
      actor_user_id: userId,
      actor_email: actorEmail,
      target_user_id: userId,
      target_email: actorEmail,
    });
    return { claimed: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().email(), redirectTo: z.string().url().optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);

    const actorEmail = await getActorEmail(supabaseAdmin, userId);
    await recordAudit(supabaseAdmin, {
      action: "password_reset.send",
      actor_user_id: userId,
      actor_email: actorEmail,
      target_user_id: null,
      target_email: data.email,
      details: { redirectTo: data.redirectTo ?? null },
    });

    return { ok: true };
  });

// Admins can delete regular users. Only sysadmins can delete admins/sysadmins.
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetUserId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("You cannot delete your own account here.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRoles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.targetUserId);
    if (rErr) throw new Error(rErr.message);
    const targetIsPrivileged = (targetRoles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "sysadmin",
    );
    if (targetIsPrivileged) {
      await assertSysadmin(supabase, userId);
    }

    const targetEmail = await getTargetEmail(supabaseAdmin, data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);

    const actorEmail = await getActorEmail(supabaseAdmin, userId);
    const priorRoles = (targetRoles ?? []).map((r: any) => String(r.role)).sort();
    await recordAudit(supabaseAdmin, {
      action: "user.delete",
      actor_user_id: userId,
      actor_email: actorEmail,
      target_user_id: data.targetUserId,
      target_email: targetEmail,
      details: {
        prior_roles: priorRoles.join(",") || "user",
        was_admin: priorRoles.includes("admin"),
        was_sysadmin: priorRoles.includes("sysadmin"),
      },
    });

    return { ok: true };
  });



export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, action, actor_user_id, actor_email, target_user_id, target_email, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { entries: (data ?? []) as AuditLogEntry[] };
  });

export type HomeTarget = "/" | "/dashboard" | "/admin" | "/sysadmin";

export function getHomePath(opts: {
  isAuthed: boolean | null;
  isAdmin?: boolean;
  isSysadmin?: boolean;
}): HomeTarget {
  if (opts.isSysadmin) return "/sysadmin";
  if (opts.isAdmin) return "/admin";
  if (opts.isAuthed === true) return "/dashboard";
  return "/";
}

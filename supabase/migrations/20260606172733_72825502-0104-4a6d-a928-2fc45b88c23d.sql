-- Revoke default PUBLIC EXECUTE on all SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sysadmin_exists() FROM PUBLIC, anon;

-- Grant EXECUTE only where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sysadmin_exists() TO authenticated;

-- Trigger functions always need service_role for admin-driven backfills
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO service_role;
GRANT EXECUTE ON FUNCTION public.sysadmin_exists() TO service_role;
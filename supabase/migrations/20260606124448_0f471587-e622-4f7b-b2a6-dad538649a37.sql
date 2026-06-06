CREATE OR REPLACE FUNCTION public.sysadmin_exists()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'sysadmin'::app_role)
$$;
GRANT EXECUTE ON FUNCTION public.sysadmin_exists() TO authenticated, anon;
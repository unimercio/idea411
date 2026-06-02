-- Restore EXECUTE on has_role to authenticated users.
-- The function is SECURITY DEFINER with a locked search_path, and is the
-- canonical way for server functions (acting as the user) to check roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
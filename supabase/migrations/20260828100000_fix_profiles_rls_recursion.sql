-- Fix infinite recursion on public.profiles RLS during signup/login.
-- SQL-inlined current_profile_org_id() + policies that subquery profiles
-- caused: "infinite recursion detected in policy for relation profiles".

CREATE OR REPLACE FUNCTION public.current_profile_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  result uuid;
BEGIN
  SELECT org_id INTO result
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  result public.user_role;
BEGIN
  SELECT role INTO result
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.current_profile_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles_select_same_org" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_org_mates" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_org_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_org_admin" ON public.profiles;

CREATE POLICY "profiles_select_self"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_org_mates"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_org_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND public.current_profile_role() IN ('super_admin', 'admin')
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
  );

CREATE POLICY "profiles_delete_org_admin"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    id <> auth.uid()
    AND org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND public.current_profile_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "team_invites_org_scoped" ON public.team_invites;
CREATE POLICY "team_invites_org_scoped"
  ON public.team_invites FOR ALL
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND public.current_profile_role() IN ('super_admin', 'admin', 'manager')
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND public.current_profile_role() IN ('super_admin', 'admin', 'manager')
  );

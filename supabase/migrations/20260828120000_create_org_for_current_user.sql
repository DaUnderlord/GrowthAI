-- Org create failed after signup: INSERT ... RETURNING is blocked because
-- organizations_select_own requires profile.org_id, which is still null.
-- Create org + attach profile in one SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.create_organization_for_current_user(
  org_name text,
  org_website text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  uid uuid := auth.uid();
  existing uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT org_id INTO existing
  FROM public.profiles
  WHERE id = uid;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.organizations (name, website)
  VALUES (COALESCE(NULLIF(trim(org_name), ''), 'My Agency'), NULLIF(trim(org_website), ''))
  RETURNING id INTO new_id;

  UPDATE public.profiles
  SET
    org_id = new_id,
    company_name = COALESCE(NULLIF(trim(org_name), ''), company_name)
  WHERE id = uid
    AND org_id IS NULL;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_for_current_user(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_for_current_user(text, text) TO authenticated, service_role;

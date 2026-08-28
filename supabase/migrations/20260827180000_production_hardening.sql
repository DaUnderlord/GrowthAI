-- Production hardening: schema alignment, team invites, org-scoped RLS

-- ---------------------------------------------------------------------------
-- Missing columns referenced by the app
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ai_notes text;

-- ---------------------------------------------------------------------------
-- Team invites (used by inviteTeamMember / acceptPendingInviteForEmail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'manager',
  department text NOT NULL DEFAULT 'Growth Operations',
  privileges jsonb NOT NULL DEFAULT '{
    "can_create_account": false,
    "can_delete_social_handle": false,
    "can_add_team": false,
    "can_invoice_management": true,
    "can_manage_campaigns": true,
    "can_manage_calendar": true,
    "can_sync_social": true
  }'::jsonb,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_invites_email_idx ON public.team_invites (email);
CREATE INDEX IF NOT EXISTS team_invites_org_id_idx ON public.team_invites (org_id);

DROP TRIGGER IF EXISTS team_invites_set_updated_at ON public.team_invites;
CREATE TRIGGER team_invites_set_updated_at
  BEFORE UPDATE ON public.team_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth bootstrap: never trust client-supplied role on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'full_name', ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );
  avatar_url text := coalesce(
    nullif(meta ->> 'avatar', ''),
    nullif(meta ->> 'avatar_url', ''),
    nullif(meta ->> 'picture', ''),
    'https://ui-avatars.com/api/?name=' || replace(full_name, ' ', '+') || '&background=6366f1&color=fff&size=128'
  );
BEGIN
  INSERT INTO public.profiles (
    id, name, email, role, avatar, phone, company_name, department, privileges
  ) VALUES (
    new.id,
    full_name,
    coalesce(new.email, ''),
    'admin',
    avatar_url,
    nullif(meta ->> 'phone', ''),
    nullif(meta ->> 'company_name', ''),
    coalesce(nullif(meta ->> 'department', ''), 'Growth Operations'),
    coalesce(meta -> 'privileges', '{
      "can_create_account": true,
      "can_delete_social_handle": true,
      "can_add_team": true,
      "can_invoice_management": true,
      "can_manage_campaigns": true,
      "can_manage_calendar": true,
      "can_sync_social": true
    }'::jsonb)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Ensure org helper exists (from WhatsApp migration; safe if already present)
CREATE OR REPLACE FUNCTION public.current_profile_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Replace permissive RLS with org-scoped policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_same_org"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      org_id IS NOT NULL
      AND org_id = public.current_profile_org_id()
    )
  );

DROP POLICY IF EXISTS "organizations_select_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON public.organizations;

CREATE POLICY "organizations_select_own"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id = public.current_profile_org_id());

CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "organizations_update_own"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (id = public.current_profile_org_id())
  WITH CHECK (id = public.current_profile_org_id());

DROP POLICY IF EXISTS "clients_all_authenticated" ON public.clients;
CREATE POLICY "clients_org_scoped"
  ON public.clients FOR ALL
  TO authenticated
  USING (org_id IS NOT NULL AND org_id = public.current_profile_org_id())
  WITH CHECK (org_id IS NOT NULL AND org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS "campaigns_all_authenticated" ON public.campaigns;
CREATE POLICY "campaigns_org_scoped"
  ON public.campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = campaigns.client_id
        AND c.org_id = public.current_profile_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = campaigns.client_id
        AND c.org_id = public.current_profile_org_id()
    )
  );

DROP POLICY IF EXISTS "calendar_items_all_authenticated" ON public.calendar_items;
DROP POLICY IF EXISTS "calendar_items_authenticated" ON public.calendar_items;
CREATE POLICY "calendar_items_org_scoped"
  ON public.calendar_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = calendar_items.client_id
        AND c.org_id = public.current_profile_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = calendar_items.client_id
        AND c.org_id = public.current_profile_org_id()
    )
  );

DROP POLICY IF EXISTS "team_invites_org_scoped" ON public.team_invites;
CREATE POLICY "team_invites_org_scoped"
  ON public.team_invites FOR ALL
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id = public.current_profile_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'manager')
    )
  );

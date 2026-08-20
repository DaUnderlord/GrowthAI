-- Assignees on calendar posts
ALTER TABLE public.calendar_items
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_name text,
  ADD COLUMN IF NOT EXISTS assignee_craft text;

-- Shareable calendar briefs
CREATE TABLE IF NOT EXISTS public.calendar_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Content calendar brief',
  access_mode text NOT NULL DEFAULT 'read_only' CHECK (access_mode = ANY (ARRAY['read_only'::text, 'collaborate'::text])),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_share_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.calendar_shares(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  craft_role text NOT NULL DEFAULT 'collaborator',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (share_id, user_id),
  UNIQUE (share_id, email)
);

CREATE INDEX IF NOT EXISTS calendar_shares_client_idx ON public.calendar_shares(client_id);
CREATE INDEX IF NOT EXISTS calendar_shares_token_idx ON public.calendar_shares(token);
CREATE INDEX IF NOT EXISTS calendar_items_assignee_idx ON public.calendar_items(assignee_id);

ALTER TABLE public.calendar_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_share_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_shares_authenticated ON public.calendar_shares;
CREATE POLICY calendar_shares_authenticated ON public.calendar_shares
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS calendar_share_members_authenticated ON public.calendar_share_members;
CREATE POLICY calendar_share_members_authenticated ON public.calendar_share_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS calendar_items_authenticated ON public.calendar_items;
CREATE POLICY calendar_items_authenticated ON public.calendar_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_calendar_brief(share_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_row public.calendar_shares%ROWTYPE;
BEGIN
  IF share_token IS NULL OR btrim(share_token) = '' THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired');
  END IF;

  SELECT * INTO share_row
  FROM public.calendar_shares
  WHERE token = share_token
    AND revoked = false
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired');
  END IF;

  RETURN jsonb_build_object(
    'share', jsonb_build_object(
      'id', share_row.id,
      'clientId', share_row.client_id,
      'label', share_row.label,
      'accessMode', share_row.access_mode
    ),
    'client', (
      SELECT jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'logo', c.logo,
        'primaryGoal', c.primary_goal
      )
      FROM public.clients c
      WHERE c.id = share_row.client_id
    ),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', m.user_id,
        'email', m.email,
        'craftRole', m.craft_role
      ))
      FROM public.calendar_share_members m
      WHERE m.share_id = share_row.id
    ), '[]'::jsonb),
    'items', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'date', i.date,
          'dayOfWeek', i.day_of_week,
          'time', i.time,
          'platform', i.platform,
          'contentType', i.content_type,
          'topic', i.topic,
          'hookText', i.hook_text,
          'captionText', i.caption_text,
          'cta', i.cta,
          'status', i.status,
          'assigneeName', i.assignee_name,
          'assigneeCraft', i.assignee_craft,
          'designerStatus', i.designer_status,
          'designerNotes', i.designer_notes
        )
        ORDER BY i.date, i.time
      )
      FROM public.calendar_items i
      WHERE i.client_id = share_row.client_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_calendar_brief(text) TO anon, authenticated;

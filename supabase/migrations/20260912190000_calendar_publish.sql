-- Calendar → Instagram / Facebook Page publishing
ALTER TABLE public.calendar_items
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_post_id text,
  ADD COLUMN IF NOT EXISTS provider_permalink text,
  ADD COLUMN IF NOT EXISTS provider_container_id text,
  ADD COLUMN IF NOT EXISTS publish_error text,
  ADD COLUMN IF NOT EXISTS publish_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_lock_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_publish_attempt_at timestamptz;

UPDATE public.calendar_items
SET scheduled_at = (
  CASE
    WHEN date ~ '^\d{4}-\d{2}-\d{2}$' AND time ~ '^\d{1,2}:\d{2}'
      THEN (date || ' ' || time)::timestamp AT TIME ZONE 'Africa/Lagos'
    WHEN date ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (date || ' 12:00')::timestamp AT TIME ZONE 'Africa/Lagos'
    ELSE NULL
  END
)
WHERE scheduled_at IS NULL;

CREATE INDEX IF NOT EXISTS calendar_items_due_idx
  ON public.calendar_items (status, scheduled_at)
  WHERE status = 'scheduled' AND provider_post_id IS NULL;

CREATE TABLE IF NOT EXISTS public.calendar_publish_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id text NOT NULL REFERENCES public.calendar_items (id) ON DELETE CASCADE,
  org_id uuid,
  client_id text NOT NULL,
  platform text NOT NULL,
  status text NOT NULL,
  provider_post_id text,
  provider_permalink text,
  error text,
  requested_by uuid,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS calendar_publish_attempts_item_idx
  ON public.calendar_publish_attempts (calendar_item_id, created_at DESC);

ALTER TABLE public.calendar_publish_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calendar_publish_attempts_org_select ON public.calendar_publish_attempts;
CREATE POLICY calendar_publish_attempts_org_select
  ON public.calendar_publish_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.profiles p ON p.org_id = c.org_id
      WHERE c.id = calendar_publish_attempts.client_id
        AND p.id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('calendar-media', 'calendar-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'calendar-media';

DROP POLICY IF EXISTS calendar_media_public_read ON storage.objects;
CREATE POLICY calendar_media_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'calendar-media');

DROP POLICY IF EXISTS calendar_media_org_insert ON storage.objects;
CREATE POLICY calendar_media_org_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'calendar-media'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS calendar_media_org_update ON storage.objects;
CREATE POLICY calendar_media_org_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'calendar-media'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'calendar-media'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS calendar_media_org_delete ON storage.objects;
CREATE POLICY calendar_media_org_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'calendar-media'
    AND (storage.foldername(name))[1] = (
      SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

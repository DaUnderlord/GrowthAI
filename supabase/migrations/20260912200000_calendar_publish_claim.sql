CREATE OR REPLACE FUNCTION public.claim_calendar_publish(p_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id text;
BEGIN
  UPDATE public.calendar_items
  SET
    publish_lock_until = now() + interval '3 minutes',
    last_publish_attempt_at = now()
  WHERE id = p_id
    AND provider_post_id IS NULL
    AND (publish_lock_until IS NULL OR publish_lock_until < now())
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_calendar_publish(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_calendar_publish(text) TO service_role;

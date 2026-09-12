-- Repair: clients.id is text. Earlier drafts of live_integrations used uuid.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'client_id'
      AND table_name IN (
        'oauth_states',
        'social_connections',
        'client_live_insights',
        'invoices',
        'reboost_jobs'
      )
      AND data_type = 'uuid'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      rec.table_name,
      rec.table_name || '_client_id_fkey'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN client_id TYPE text USING client_id::text',
      rec.table_name
    );
    IF rec.table_name <> 'oauth_states' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE',
        rec.table_name,
        rec.table_name || '_client_id_fkey'
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.org_provider_secrets
  ADD COLUMN IF NOT EXISTS meta_config_id text;

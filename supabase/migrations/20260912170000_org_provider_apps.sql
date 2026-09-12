ALTER TABLE public.org_provider_secrets
  ADD COLUMN IF NOT EXISTS google_client_id text,
  ADD COLUMN IF NOT EXISTS google_client_secret text,
  ADD COLUMN IF NOT EXISTS google_ads_developer_token text,
  ADD COLUMN IF NOT EXISTS google_ads_customer_id text,
  ADD COLUMN IF NOT EXISTS tiktok_client_key text,
  ADD COLUMN IF NOT EXISTS tiktok_client_secret text,
  ADD COLUMN IF NOT EXISTS linkedin_client_id text,
  ADD COLUMN IF NOT EXISTS linkedin_client_secret text;

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS demographics jsonb NOT NULL DEFAULT '{}'::jsonb;

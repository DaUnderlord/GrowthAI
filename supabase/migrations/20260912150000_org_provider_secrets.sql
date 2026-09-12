CREATE TABLE IF NOT EXISTS public.org_provider_secrets (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  meta_app_id text,
  meta_app_secret text,
  meta_webhook_verify_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_provider_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_provider_secrets_deny ON public.org_provider_secrets;
CREATE POLICY org_provider_secrets_deny ON public.org_provider_secrets
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.org_provider_secrets FROM anon, authenticated;

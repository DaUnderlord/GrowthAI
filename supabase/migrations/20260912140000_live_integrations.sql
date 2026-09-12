-- Live social tokens, invoices, reboost jobs, org billing/domain

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain_verify_token text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS billing_tier text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'inactive';

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid,
  client_id text,
  platform text NOT NULL,
  redirect_origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes')
);

CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  platform text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  external_id text,
  ad_account_id text,
  status text NOT NULL DEFAULT 'connected',
  followers integer NOT NULL DEFAULT 0,
  growth_rate numeric NOT NULL DEFAULT 0,
  health_score integer NOT NULL DEFAULT 0,
  impressions_24h integer NOT NULL DEFAULT 0,
  reach_24h integer NOT NULL DEFAULT 0,
  engagement_24h integer NOT NULL DEFAULT 0,
  clicks_24h integer NOT NULL DEFAULT 0,
  spend_30d numeric NOT NULL DEFAULT 0,
  conversions_30d integer NOT NULL DEFAULT 0,
  revenue_30d numeric NOT NULL DEFAULT 0,
  last_sync timestamptz,
  last_error text,
  posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, platform)
);

CREATE TABLE IF NOT EXISTS public.social_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.social_connections (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_live_insights (
  client_id text PRIMARY KEY REFERENCES public.clients (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'live_sync',
  growth_score integer NOT NULL DEFAULT 0,
  virality_score integer NOT NULL DEFAULT 0,
  engagement_health integer NOT NULL DEFAULT 0,
  sentiment_score integer NOT NULL DEFAULT 0,
  conversion_score integer NOT NULL DEFAULT 0,
  roi_multiplier numeric NOT NULL DEFAULT 0,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  personas jsonb NOT NULL DEFAULT '[]'::jsonb,
  attribution jsonb NOT NULL DEFAULT '[]'::jsonb,
  posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  demographics jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'outstanding',
  due_date date,
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  hosted_invoice_url text,
  email_sent_at timestamptz,
  created_by uuid
);

CREATE TABLE IF NOT EXISTS public.reboost_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  post_id text,
  post_title text,
  platform text,
  budget numeric,
  status text NOT NULL DEFAULT 'drafted',
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_campaign_id text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_live_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reboost_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_connections_org ON public.social_connections;
CREATE POLICY social_connections_org ON public.social_connections
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS social_secrets_deny ON public.social_connection_secrets;
CREATE POLICY social_secrets_deny ON public.social_connection_secrets
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS client_live_insights_org ON public.client_live_insights;
CREATE POLICY client_live_insights_org ON public.client_live_insights
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS invoices_org ON public.invoices;
CREATE POLICY invoices_org ON public.invoices
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS reboost_jobs_org ON public.reboost_jobs;
CREATE POLICY reboost_jobs_org ON public.reboost_jobs
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_live_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reboost_jobs TO authenticated;
REVOKE ALL ON public.social_connection_secrets FROM anon, authenticated;
REVOKE ALL ON public.oauth_states FROM anon, authenticated;

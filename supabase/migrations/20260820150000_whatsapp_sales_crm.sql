-- WhatsApp Sales & Lead CRM (channel-agnostic foundation)

DO $$ BEGIN
  CREATE TYPE public.channel_type AS ENUM ('whatsapp', 'instagram', 'facebook', 'website', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_status AS ENUM ('open', 'pending', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_stage AS ENUM ('new', 'contacted', 'qualified', 'quote', 'negotiation', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.message_status AS ENUM ('received', 'pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.whatsapp_account_status AS ENUM ('connected', 'disconnected', 'pending', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_profile_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  waba_id text,
  display_phone_number text NOT NULL DEFAULT '',
  verified_name text,
  status public.whatsapp_account_status NOT NULL DEFAULT 'pending',
  webhook_subscribed boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id),
  UNIQUE (client_id, phone_number_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_account_secrets (
  account_id uuid PRIMARY KEY REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id text REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL,
  whatsapp_id text,
  profile_image_url text,
  source text,
  first_campaign_id text REFERENCES public.campaigns(id) ON DELETE SET NULL,
  last_campaign_id text REFERENCES public.campaigns(id) ON DELETE SET NULL,
  meta_referral jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, phone)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL,
  channel public.channel_type NOT NULL DEFAULT 'whatsapp',
  status public.conversation_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  campaign_id text REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_status public.lead_stage NOT NULL DEFAULT 'new',
  lead_score integer NOT NULL DEFAULT 0,
  lead_value numeric,
  expected_revenue numeric,
  actual_revenue numeric,
  lost_reason text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'normal',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  meta_attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary text,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_open_contact_channel_idx
  ON public.conversations (org_id, contact_id, channel)
  WHERE status IN ('open', 'pending');

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  media_mime_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_message_id text,
  status public.message_status NOT NULL DEFAULT 'pending',
  sender_type text NOT NULL DEFAULT 'customer',
  sender_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  error_message text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (whatsapp_message_id)
);

CREATE INDEX IF NOT EXISTS messages_conversation_ts_idx
  ON public.messages (conversation_id, timestamp);

CREATE TABLE IF NOT EXISTS public.campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id text REFERENCES public.campaigns(id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  client_id text REFERENCES public.clients(id) ON DELETE SET NULL,
  source text,
  creative_id text,
  meta_source_id text,
  status public.lead_stage NOT NULL DEFAULT 'new',
  lead_score integer NOT NULL DEFAULT 0,
  converted boolean NOT NULL DEFAULT false,
  meta_attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_org_idx ON public.contacts(org_id);
CREATE INDEX IF NOT EXISTS conversations_client_idx ON public.conversations(client_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversations_org_idx ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_client_idx ON public.whatsapp_accounts(client_id);

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_account_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_ai_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_account_secrets FROM anon, authenticated;
DROP POLICY IF EXISTS wa_secrets_deny_all ON public.whatsapp_account_secrets;
CREATE POLICY wa_secrets_deny_all ON public.whatsapp_account_secrets
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS wa_accounts_org ON public.whatsapp_accounts;
CREATE POLICY wa_accounts_org ON public.whatsapp_accounts
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS contacts_org ON public.contacts;
CREATE POLICY contacts_org ON public.contacts
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS conversations_org ON public.conversations;
CREATE POLICY conversations_org ON public.conversations
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS messages_org ON public.messages;
CREATE POLICY messages_org ON public.messages
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS campaign_leads_org ON public.campaign_leads;
CREATE POLICY campaign_leads_org ON public.campaign_leads
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DROP POLICY IF EXISTS ai_analyses_org ON public.conversation_ai_analyses;
CREATE POLICY ai_analyses_org ON public.conversation_ai_analyses
  FOR ALL TO authenticated
  USING (org_id = public.current_profile_org_id())
  WITH CHECK (org_id = public.current_profile_org_id());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

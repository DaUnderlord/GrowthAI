export interface BlueprintTopic {
  id: string;
  title: string;
  badge: string;
  description: string;
  detailsMarkdown: string;
}

export const BLUEPRINT_TOPICS: BlueprintTopic[] = [
  {
    id: 'prd',
    title: '1. Product Requirements Document (PRD)',
    badge: 'Core PRD',
    description: 'Autonomous AI Growth Operating System for multi-tenant digital marketing agencies.',
    detailsMarkdown: `
# Executive Summary & Vision

**GrowthOS AI** is an autonomous growth operating system designed specifically for digital marketing agencies managing clients across FMCG, Education, Politics, Healthcare, Hospitality, Real Estate, and SMEs.

### Core Problem Statement
Digital agencies face unpredictable growth loops, manual report synthesis, content fatigue, sub-optimal posting schedules, and inaccurate revenue attribution across multi-channel campaigns.

### Key Objectives & Value Proposition
1. **Autonomous Analytics & Pattern Discovery**: Continuously mine reach, saves, shares, and conversion bottlenecks.
2. **Predictive Performance Indexing**: Calculate virality probability and revenue potential before content publication.
3. **Multi-Agent Strategic Council**: 7 specialized AI agents collaborating in real-time to generate data-backed growth recommendations.
4. **Autonomous Content Reboosting**: Detect underperforming or decaying assets and automatically recommend reformat/reboost schedules.
5. **Strict API Compliance & Ethical Growth**: 100% compliant with Meta Graph, TikTok Display, LinkedIn REST, and Google APIs without prohibited scraping or fake engagement.
`
  },
  {
    id: 'architecture',
    title: '2. System Architecture Diagram & Topology',
    badge: 'System Design',
    description: 'Event-driven, multi-tenant cloud microservices with streaming AI orchestration.',
    detailsMarkdown: `
# System Architecture

\`\`\`
[ Client App / Agency Hub (React 19 + Tailwind) ]
                     │
                     ▼ (REST / SSE / WebSockets)
[ API Gateway / Express Microservices (Node.js/TypeScript) ]
     │               │               │               │
     ▼               ▼               ▼               ▼
[ OAuth Vault ]  [ Multi-Agent ] [ Analytics ]   [ Attribution ]
 (Meta/TikTok/    Orchestration   Pipeline         Engine
  LinkedIn/GA)   (Gemini 3.6)     (ClickHouse)   (Revenue Flow)
     │               │               │               │
     └───────────────┼───────────────┴───────────────┘
                     ▼
  [ PostgreSQL + pgvector ] + [ Redis Event Bus ]
\`\`\`

### Architectural Principles
* **Multi-Tenant Isolation**: Tenant ID scoping across DB tables, cache namespaces, and OAuth token vaults.
* **Asynchronous Queue Pipeline**: BullMQ / Redis stream workers for social analytics crawling and batch AI predictions.
* **Vector Store Integration**: \`pgvector\` or Pinecone for semantic indexing of historical viral hooks and competitor content themes.
`
  },
  {
    id: 'database',
    title: '3. Database Schema (PostgreSQL & Vector Store)',
    badge: 'DB Schema',
    description: 'Normalized multi-tenant database schema with vector embedding support.',
    detailsMarkdown: `
# Database Schema Design

### Core Tables

#### 1. \`tenants\` (Agencies)
* \`id\` (UUID, PK)
* \`agency_name\` (VARCHAR 255)
* \`white_label_domain\` (VARCHAR 255)
* \`tier\` (ENUM: 'starter', 'growth', 'enterprise')
* \`created_at\` (TIMESTAMP)

#### 2. \`clients\`
* \`id\` (UUID, PK)
* \`tenant_id\` (UUID, FK -> tenants.id)
* \`name\` (VARCHAR 255)
* \`industry\` (ENUM: 'fmcg', 'healthcare', 'realestate', 'education', 'politics', 'hospitality', 'sme')
* \`monthly_budget\` (DECIMAL)
* \`target_kpi\` (TEXT)

#### 3. \`social_accounts\`
* \`id\` (UUID, PK)
* \`client_id\` (UUID, FK -> clients.id)
* \`platform\` (ENUM: 'instagram', 'facebook', 'tiktok', 'linkedin', 'google_analytics', 'whatsapp', 'meta_ads', 'google_ads')
* \`oauth_token_encrypted\` (TEXT)
* \`health_status\` (VARCHAR 50)

#### 4. \`posts\` & \`post_metrics\`
* \`id\` (UUID, PK)
* \`client_id\` (UUID, FK -> clients.id)
* \`platform\` (VARCHAR 50)
* \`hook_text\` (TEXT)
* \`content_embedding\` (VECTOR(1536))
* \`reach\`, \`impressions\`, \`saves\`, \`shares\`, \`likes\`, \`conversions\` (BIGINT)
* \`virality_score\` (DECIMAL)
* \`reboost_status\` (BOOLEAN)

#### 5. \`audience_dna\` & \`attribution_events\`
* Captures demographic clusters, active hour heatmaps, CAC, and multi-touch attribution chains.
`
  },
  {
    id: 'user_journeys',
    title: '4. User Journey Maps',
    badge: 'UX Workflows',
    description: 'Agency Director, Growth Lead, and Client Brand Manager journey flows.',
    detailsMarkdown: `
# Core User Journeys

### Journey 1: Agency Growth Lead Onboarding a New Client
1. **Connect Channels**: Authenticate Instagram Professional, TikTok, GA4 via OAuth.
2. **AI Initial Baseline**: GrowthOS AI ingests 90 days of historical data within 120 seconds.
3. **Audience DNA Generation**: System synthesizes buyer personas, active hour matrices, and content gaps.
4. **Action Plan Approval**: Strategist reviews multi-agent recommendations and clicks "Approve 30-Day Campaign Plan".

### Journey 2: Content Creator Optimizing a Reel
1. **Input Draft**: Enter draft hook, caption idea, and media asset type.
2. **Run Prediction**: AI Prediction Engine outputs expected reach (e.g., 40k-60k) and virality score (88%).
3. **Apply One-Click Enhancements**: AI suggests high-retention visual cuts and SEO hashtag cluster.
4. **Schedule & Publish**: Automated dispatch at peak algorithm window.
`
  },
  {
    id: 'agent_workflows',
    title: '5. AI Multi-Agent Workflows & Orchestration',
    badge: 'Multi-Agent',
    description: '7 Collaborative agents working in concert to drive client ROI.',
    detailsMarkdown: `
# Multi-Agent Orchestration Framework

### The 7 Growth Agents
1. **Data Analyst Agent**: Ingests raw telemetry and calculates variance in save-to-share ratios.
2. **Social Growth Agent**: Identifies platform algorithm shifts (e.g., Instagram Reels watch time thresholds).
3. **Content Strategist Agent**: Drafts psychological hooks, carousels, and script storyboards.
4. **Conversion Agent**: Analyzes lead forms, DM automation, and landing page drop-offs.
5. **Competitor Research Agent**: Scans competitor posting frequency and content whitespace.
6. **Campaign Optimization Agent**: Manages automated ad budget re-allocation.
7. **Executive Reporting Agent**: Compiles white-labeled weekly PDF & interactive executive scorecards.

### Inter-Agent Communication Topology
\`\`\`
[Data Analyst] ──> [Social Growth Agent] ──> [Content Strategist]
       │                    │                       │
       ▼                    ▼                       ▼
[Conversion Agent] <──> [Competitor Agent] <──> [Campaign Optimizer]
       │
       ▼
[Executive Reporting Agent]
\`\`\`
`
  },
  {
    id: 'apis',
    title: '6. API Specifications & Endpoints',
    badge: 'API Specs',
    description: 'RESTful and Event-driven streaming API definitions.',
    detailsMarkdown: `
# GrowthOS AI Core API Design

### 1. Multi-Agent Strategic Audit
\`\`\`http
POST /api/v1/growth/multi-agent
Header: Authorization: Bearer <API_KEY>
Body: {
  "client_id": "client-123",
  "industry": "healthcare",
  "prompt": "Optimize patient acquisition campaign"
}
Response: {
  "status": "success",
  "agent_insights": { ... }
}
\`\`\`

### 2. Virality & Performance Predictor
\`\`\`http
POST /api/v1/growth/predict
Body: {
  "platform": "instagram",
  "content_type": "reel",
  "hook_text": "3 skincare secrets doctors won't tell you"
}
Response: {
  "virality_score": 92,
  "estimated_reach": "45,000 - 70,000",
  "optimal_time": "Thursday at 8:00 PM"
}
\`\`\`

### 3. Content Optimizer & Reboost
\`\`\`http
POST /api/v1/growth/optimize-content
POST /api/v1/growth/reboost
\`\`\`
`
  },
  {
    id: 'roadmap',
    title: '7. MVP & Multi-Year Product Roadmap (V1, V2, V3)',
    badge: 'Roadmap',
    description: 'Phased rollout strategy from initial MVP to full autonomous OS.',
    detailsMarkdown: `
# Product Release Roadmap

### Version 1: MVP (Months 1–4)
* Multi-tenant agency dashboard & client selector.
* Connected platforms: Instagram, Facebook, TikTok, LinkedIn, GA4.
* Growth Intelligence Engine & AI Prediction Engine (Gemini 3.6 Flash).
* Manual approval workflow for AI recommendations.

### Version 2: Advanced Automation & Reboost (Months 5–9)
* Autonomous Reboost Agent for decaying posts.
* Multi-touch Conversion Attribution Engine (Content -> Lead -> Sale).
* WhatsApp Business CRM auto-responder agent.
* White-label portal for enterprise agency clients.

### Version 3: Fully Autonomous Operating System (Months 10–18)
* Auto-scheduling & native publishing across all platforms.
* Autonomous Meta & Google Ads budget re-allocation.
* Fine-tuned domain models for vertical industries.
* Predictive revenue forecasting with 95%+ confidence.
`
  },
  {
    id: 'monetization',
    title: '8. Monetization & Pricing Model',
    badge: 'Monetization',
    description: 'Multi-tiered SaaS subscriptions & enterprise white-label licensing.',
    detailsMarkdown: `
# Revenue Models & Tiering

1. **Agency Starter Plan**: $299/month
   * Up to 5 Client Accounts
   * Basic Analytics & AI Content Optimizer
   * Weekly AI Performance Summaries

2. **Agency Growth Plan**: $799/month
   * Up to 20 Client Accounts
   * Full 7-Agent Council & Prediction Engine
   * Autonomous Reboost Agent & Competitor Benchmarking
   * Unlimited Social Channel Connections

3. **Enterprise White-Label Plan**: $1,999/month
   * Unlimited Clients & Custom Branding / Custom Subdomains
   * Multi-touch Revenue Attribution
   * Dedicated API access & SLA
   * Custom fine-tuned AI growth models
`
  },
  {
    id: 'prompts',
    title: '9. Prompt Engineering Framework',
    badge: 'AI Prompts',
    description: 'Production prompt structures for multi-agent growth reasoning.',
    detailsMarkdown: `
# Prompt Engineering Framework

### Multi-Agent System Prompt Architecture
* **Role Conditioning**: Assign deep industry expertise (e.g., "You are an elite FMCG growth strategist...").
* **Chain-of-Thought Guardrails**: Force step-by-step mathematical reasoning for reach estimation and conversion probability.
* **Structured Output Requirements**: Force JSON output schema for UI rendering consistency.

### Example Prediction Engine Prompt Structure:
\`\`\`json
{
  "role": "GrowthOS Virality Predictor",
  "context": "Industry: {industry}, Channel: {platform}, Historical Median Reach: {medianReach}",
  "task": "Evaluate hook emotional intensity, curiosity gap, and CTA strength.",
  "output_format": "JSON with viralityScore (0-100), reasoning, and 3 actionable tweaks."
}
\`\`\`
`
  },
  {
    id: 'compliance',
    title: '10. Technical Risks, GDPR & SOC2 Enterprise Compliance',
    badge: 'Security & Compliance',
    description: 'Zero anti-bot scraping policy, enterprise data privacy, and token security.',
    detailsMarkdown: `
# Enterprise Security, GDPR & SOC2 Architecture

### 1. Platform API Policy Compliance
* **Strict Official API Integrations**: Direct usage of official Meta Graph API, TikTok Display API, LinkedIn REST API, and Google Analytics Data API.
* **Zero Prohibited Behavior**: NO head-less browser scraping, NO fake engagement bots, NO automated follow/unfollow, NO credential storage.

### 2. GDPR & Enterprise Privacy Controls
* **Data Encryption at Rest & In Transit**: AES-256 encryption for database tables and TLS 1.3 for all endpoints.
* **OAuth Token Encryption**: HashiCorp Vault / AWS KMS encryption for client social refresh tokens.
* **Right to be Forgotten**: One-click client tenant data purge & automated retention windows.
* **SOC2 Type II Audit Compliance**: RBAC controls, immutable access logs, and regular penetration testing.
`
  },
];

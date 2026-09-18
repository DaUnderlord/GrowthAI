/** Honest copy for scores and AI features. Matches formulas in server/insightsEngine.ts and last-sync provider fields. */

export type MetricKey =
  | 'growthScore'
  | 'viralityScore'
  | 'engagementHealth'
  | 'sentimentScore'
  | 'conversionScore'
  | 'roiMultiplier'
  | 'healthScore'
  | 'followers'
  | 'reach'
  | 'reach24h'
  | 'impressions'
  | 'engagement'
  | 'saveRate'
  | 'saves'
  | 'shares'
  | 'likes'
  | 'comments'
  | 'clicks'
  | 'spend'
  | 'conversions'
  | 'revenue'
  | 'cac'
  | 'roas'
  | 'postStatus'
  | 'postType'
  | 'reboostFlag'
  | 'audiencePersona'
  | 'purchasingPower'
  | 'activeHours'
  | 'buyingTriggers'
  | 'preferredFormat'
  | 'predictVirality'
  | 'predictReach'
  | 'predictEngagement'
  | 'predictConversion'
  | 'predictPostingTime'
  | 'predictConfidence'
  | 'creativeVisual'
  | 'creativeGoalMatch'
  | 'creativeSuccess'
  | 'aiSignals'
  | 'aiAgents'
  | 'aiPredict'
  | 'aiOptimize'
  | 'aiCompetitors'
  | 'aiReboost'
  | 'aiCreative'
  | 'aiRecap'
  | 'aiPlaybook'
  | 'aiActions'
  | 'playbookN'
  | 'playbookConfidence';

export type MetricTipCopy = {
  title: string;
  body: string;
};

export const METRIC_TIPS: Record<MetricKey, MetricTipCopy> = {
  growthScore: {
    title: 'Growth score',
    body: 'A 0–100 workspace formula from the last Sync, not a Meta or Gemini forecast. It adds points for 24h reach, engagement rate, conversions, revenue, and average account health. A low score usually means reach, ads spend, or conversions are still 0 — not that the brand is failing.',
  },
  viralityScore: {
    title: 'Virality score',
    body: 'Workspace formula: engagement rate × 400, plus a bonus if impressions exist. On a single post it is (saves + shares) ÷ impressions-or-reach × 400, capped at 100. It is not a prediction that the post will go viral.',
  },
  engagementHealth: {
    title: 'Engagement health',
    body: 'Workspace formula from last-sync likes, comments, and saves versus reach. Sentiment score currently copies this number. It is not a brand-sentiment survey.',
  },
  sentimentScore: {
    title: 'Sentiment score',
    body: 'Currently the same as engagement health. The app does not score comments as positive/negative.',
  },
  conversionScore: {
    title: 'Conversion score',
    body: 'Workspace formula from last-sync conversions versus ads spend. Stays 0 until a Meta Ads (or other ads) account reports purchases or leads.',
  },
  roiMultiplier: {
    title: 'ROI / ROAS',
    body: 'Last-sync conversion value ÷ ads spend. 0x means no spend or no conversion value was returned — not a measured 0% return.',
  },
  healthScore: {
    title: 'Account health',
    body: 'A 0–100 heuristic from that channel’s last Sync (engagement rate for Instagram; 70 if a Facebook Page has fans but no ads impressions). Not Meta’s official Page quality score.',
  },
  followers: {
    title: 'Followers / fans',
    body: 'Instagram followers_count or Facebook Page fan_count from the last Sync. Accounts are added together on Overview, so Instagram + Facebook is a combined total, not unique people.',
  },
  reach: {
    title: 'Reach',
    body: 'Unique accounts that saw the content, from Instagram Insights on that post. Overview “24h reach” is a separate account-level day metric and can stay 0 even when posts have reach.',
  },
  reach24h: {
    title: '24h reach',
    body: 'Account-level reach Meta returned for the last day. Instagram often omits this even when post-level reach exists. 0 here does not mean nobody saw the posts.',
  },
  impressions: {
    title: 'Impressions',
    body: 'Times the content was shown. Meta has been retiring this metric on Instagram user insights; posts may show reach with impressions at 0.',
  },
  engagement: {
    title: 'Engagement',
    body: 'On Instagram this is likes + comments + saves on the last synced posts (currently up to 8), not strictly the last 24 hours despite the field name.',
  },
  saveRate: {
    title: 'Save rate',
    body: 'Saves ÷ impressions on last-sync posts. Shows as — when Meta did not return impressions, which is common on Instagram now.',
  },
  saves: {
    title: 'Saves',
    body: 'Instagram saved count from post Insights. Used to flag “underperforming” when saves are under 5.',
  },
  shares: {
    title: 'Shares',
    body: 'Instagram shares from post Insights when Meta returns that metric. Often 0 if the permission or metric is unavailable.',
  },
  likes: {
    title: 'Likes',
    body: 'like_count from the Instagram media object on last Sync.',
  },
  comments: {
    title: 'Comments',
    body: 'comments_count from the Instagram media object on last Sync. The text of comments is not analysed.',
  },
  clicks: {
    title: 'Clicks',
    body: 'Link or ads clicks from last Sync. Organic Instagram posts usually have 0 unless ads Insights are connected.',
  },
  spend: {
    title: 'Spend (30d)',
    body: 'Ads spend from the selected Meta (or Google) ad account for the last 30 days. Stays 0 until you pick an ad account on Connect Apps and Sync.',
  },
  conversions: {
    title: 'Conversions / leads',
    body: 'Purchase or lead actions from ads Insights. Organic posts do not report this. 0 means none were in the last sync, not that the hospital had no patients.',
  },
  revenue: {
    title: 'Revenue',
    body: 'Conversion value from ads Insights, not invoices or hospital billing. 0 until ads report purchase value.',
  },
  cac: {
    title: 'CAC',
    body: 'Spend ÷ conversions on that channel’s last sync. 0 when either number is missing.',
  },
  roas: {
    title: 'ROAS',
    body: 'Reported conversion value ÷ spend on that path. Unknown / 0 when ads are not selected or Meta returned no purchase value.',
  },
  postStatus: {
    title: 'Post status',
    body: 'performing if saves ≥ 20; otherwise underperforming. Reboost recommended if the post has reach but saves < 5. These are workspace rules, not Instagram labels.',
  },
  postType: {
    title: 'Post type',
    body: 'From Instagram media_type / media_product_type on the last Sync (Reel, carousel, story, feed). Unclassified until that snapshot includes those fields — Recap will not pretend every post is a Reel.',
  },
  reboostFlag: {
    title: 'Reboost recommended',
    body: 'True when the post has some reach and fewer than 5 saves. That is a heuristic for “worth testing paid”, not proof the creative will convert. Paid boost still needs a selected ads account.',
  },
  audiencePersona: {
    title: 'Audience segment',
    body: 'Top age/gender buckets from Instagram follower_demographics (or ads breakdown). The % is that bucket’s share of the breakdown Meta returned, not a custom persona interview.',
  },
  purchasingPower: {
    title: 'Purchasing power',
    body: 'Hardcoded as Medium. Meta does not send income. Do not treat this as measured spend capacity.',
  },
  activeHours: {
    title: 'Peak active hours',
    body: 'Not in the last-sync snapshot. Shows “Not reported by the provider” unless you later connect hour-of-day Insights.',
  },
  buyingTriggers: {
    title: 'Buying triggers',
    body: 'Placeholder copy (“Reported by the connected ads/social audience breakdown”). Not extracted from comments or ads.',
  },
  preferredFormat: {
    title: 'Preferred format',
    body: 'Default “Feed + Reels” (or Short-form for TikTok). Not measured from this audience.',
  },
  predictVirality: {
    title: 'Predicted virality',
    body: 'Gemini’s 0–100 guess after seeing last-sync posts. Server-capped when the model invents huge reach. Treat as a comparison to your last posts, not a guarantee.',
  },
  predictReach: {
    title: 'Estimated reach',
    body: 'Must stay near last-sync followers / 24h reach. If 24h reach is 0, the API rewrites this to “unknown as a forecast” instead of allowing a large invented range.',
  },
  predictEngagement: {
    title: 'Engagement index',
    body: 'Gemini score 0–100 for likely saves/shares versus last-sync posts. Not measured future engagement.',
  },
  predictConversion: {
    title: 'Conversion probability',
    body: 'Stays unknown unless last sync includes ads conversions. Organic likes are not treated as leads.',
  },
  predictPostingTime: {
    title: 'Best posting time',
    body: 'Always unknown. The snapshot has no hour-of-day Insights, so the server overwrites any hour Gemini suggests.',
  },
  predictConfidence: {
    title: 'Model confidence',
    body: 'Gemini’s self-score, reduced by the server when estimated reach exceeds ~2× followers or ~14× last-sync 24h reach.',
  },
  creativeVisual: {
    title: 'Visual score',
    body: 'Gemini’s 0–100 read of the uploaded image (hook, contrast, on-image text). Not a Meta quality ranking.',
  },
  creativeGoalMatch: {
    title: 'Goal match',
    body: 'How well Gemini thinks the image matches the calendar topic / brand goal you typed.',
  },
  creativeSuccess: {
    title: 'Predicted success',
    body: 'Forced to 0 when this brand has no live sync. Otherwise a model guess, not a measured CTR.',
  },
  aiSignals: {
    title: 'Signals',
    body: 'Lists last-sync provider posts (up to 8). Click a post to send its caption and metrics to Gemini Optimize. Advice is grounded in those posts; it will not invent follower counts.',
  },
  aiAgents: {
    title: 'Agents',
    body: 'One Gemini call role-playing seven specialists. They receive LIVE_CONNECTED_ACCOUNT_DATA (followers, posts, audience, data gaps). Valuable for tactics that reuse named posts. 90-day ROI is a projection, not a forecast from ads.',
  },
  aiPredict: {
    title: 'Predict',
    body: 'Compares a hook you type to last-sync posts. Reach is capped; posting hour is unknown. Useful for “does this sound like our recent winners?”, not for promising 35k reach.',
  },
  aiOptimize: {
    title: 'Optimize',
    body: 'Drafts hooks, captions, hashtags, and CTAs. Prompt tells Gemini to cite which last-sync post or metric it is copying. Best once Instagram posts exist.',
  },
  aiCompetitors: {
    title: 'Competitors',
    body: 'Public web search plus optional page fetch for the competitor. This brand’s numbers come only from last Sync. Competitor follower counts are only as good as public sources.',
  },
  aiReboost: {
    title: 'Reboost',
    body: 'Lists posts flagged by the saves < 5 rule and can write a Gemini boost brief. It does not place ads until a Meta Ads account is selected. Suggested spend is a % of the brand budget, not Meta’s recommendation.',
  },
  aiCreative: {
    title: 'Creative',
    body: 'Uploads an image to Gemini vision and compares it to last-sync posts when present. Predicted success is 0 without a live sync.',
  },
  aiRecap: {
    title: 'Recap',
    body: 'Charts from last-sync provider posts and calendar mix. No Gemini. Follower count is a point in time; 24h reach of 0 does not hide per-post reach. Best posting hour stays unknown.',
  },
  aiPlaybook: {
    title: 'Playbook',
    body: 'Ranks format × platform against the campaign goal using last-sync posts only. n < 3 is “too few to call.” This is not Meta’s ranking algorithm.',
  },
  aiActions: {
    title: 'Actions',
    body: 'Concrete calendar edits (format, hook, split topic, follow-up draft). Apply writes Content Calendar fields; status stays scheduled or draft. Growth AI never auto-posts to Instagram.',
  },
  playbookN: {
    title: 'Sample size (n)',
    body: 'How many last-sync posts sit in that format × platform bucket. Fewer than 3 is shown but not used as a rule.',
  },
  playbookConfidence: {
    title: 'Confidence',
    body: 'too few (n < 3), low (3–4), medium (5–7), useful (8+). Based only on how many posts were in the last sync, not on a model score.',
  },
};

export function metricTitle(key: MetricKey) {
  return METRIC_TIPS[key].title;
}

export function metricBody(key: MetricKey) {
  return METRIC_TIPS[key].body;
}

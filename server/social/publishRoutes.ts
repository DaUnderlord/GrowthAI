import type { Express, NextFunction, Request, Response } from 'express';
import { authOf, canManageCalendar, requireSupabaseUser } from '../authMiddleware';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { hasMetaPublishScopes, publishReadyNote } from '../../shared/calendarPublish';
import { fetchGrantedMetaScopes } from './providers';
import { publishDueCalendarItems, publishOneCalendarItem } from './publishRunner';

function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = req.header('authorization') || req.header('x-cron-secret') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === secret;
}

async function requireCronOrUser(req: Request, res: Response, next: NextFunction) {
  if (cronAuthorized(req)) {
    (req as any).cron = true;
    next();
    return;
  }
  return requireSupabaseUser(req, res, next);
}

export function registerPublishRoutes(app: Express) {
  app.get('/api/calendar/readiness', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      const clientId = String(req.query.clientId || '');
      if (!auth.orgId || !clientId) {
        res.json({ success: true, instagram: { connected: false }, facebook: { connected: false } });
        return;
      }
      const admin = getSupabaseAdmin();
      const { data: rows } = await admin
        .from('social_connections')
        .select('id, platform, status, account_name, external_id')
        .eq('org_id', auth.orgId)
        .eq('client_id', clientId)
        .in('platform', ['instagram', 'facebook']);
      const ids = (rows || []).map((row) => row.id);
      type SecretRow = { connection_id: string; scopes: string | null; access_token?: string | null };
      const { data: secrets } = ids.length
        ? await admin
            .from('social_connection_secrets')
            .select('connection_id, scopes, access_token')
            .in('connection_id', ids)
        : { data: [] as SecretRow[] };
      const secretMap = new Map<string, SecretRow>();
      for (const row of (secrets || []) as SecretRow[]) {
        secretMap.set(row.connection_id, row);
      }
      const readiness: Record<string, unknown> = {};
      for (const platform of ['instagram', 'facebook'] as const) {
        const row = (rows || []).find((item) => item.platform === platform);
        const secret = row ? secretMap.get(row.id) : undefined;
        let scopes = secret?.scopes || '';
        if (secret?.access_token) {
          const live = await fetchGrantedMetaScopes(secret.access_token).catch(() => '');
          if (live) {
            scopes = live;
            if (live !== secret.scopes) {
              await admin
                .from('social_connection_secrets')
                .update({ scopes: live, updated_at: new Date().toISOString() })
                .eq('connection_id', row!.id);
            }
          }
        }
        const canPublish = Boolean(row && hasMetaPublishScopes(platform, scopes));
        readiness[platform] = {
          connected: Boolean(row && (row.status === 'connected' || row.status === 'needs_selection')),
          accountName: row?.account_name || '',
          canPublish,
          note: publishReadyNote(platform, scopes, Boolean(row)),
        };
      }
      res.json({ success: true, ...readiness });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/calendar/due', '/api/calendar/due/'], requireCronOrUser, async (req, res) => {
    try {
      const isCron = Boolean((req as any).cron);
      const auth = isCron ? null : authOf(req);
      if (!isCron && !auth?.orgId) {
        res.status(400).json({ success: false, error: 'Complete workspace onboarding first.' });
        return;
      }
      const result = await publishDueCalendarItems({
        orgId: isCron ? undefined : auth?.orgId,
        clientId: req.body?.clientId || req.query.clientId || undefined,
        requestedBy: auth?.userId,
        source: isCron ? 'cron' : 'flush',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get(['/api/calendar/due', '/api/calendar/due/'], requireCronOrUser, async (req, res) => {
    try {
      const isCron = Boolean((req as any).cron);
      const auth = isCron ? null : authOf(req);
      if (!isCron && !auth?.orgId) {
        res.status(400).json({ success: false, error: 'Complete workspace onboarding first.' });
        return;
      }
      const result = await publishDueCalendarItems({
        orgId: isCron ? undefined : auth?.orgId,
        requestedBy: auth?.userId,
        source: isCron ? 'cron' : 'flush',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/calendar/:itemId/publish', requireSupabaseUser, async (req, res) => {
    try {
      const auth = authOf(req);
      if (!auth.orgId) {
        res.status(400).json({ success: false, error: 'Complete workspace onboarding first.' });
        return;
      }
      if (!canManageCalendar(auth)) {
        res.status(403).json({ success: false, error: 'Your role cannot publish from the calendar.' });
        return;
      }
      const result = await publishOneCalendarItem({
        itemId: String(req.params.itemId),
        orgId: auth.orgId,
        requestedBy: auth.userId,
        source: 'manual',
        force: true,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });
}

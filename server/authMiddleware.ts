import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAnonForJwt } from './supabaseAdmin';

export type AuthContext = {
  userId: string;
  email?: string;
  orgId: string | null;
  role?: string;
  privileges?: { can_manage_calendar?: boolean } | null;
};

export function canManageCalendar(auth: AuthContext) {
  if (auth.role && ['admin', 'super_admin', 'manager'].includes(auth.role)) return true;
  return Boolean(auth.privileges?.can_manage_calendar);
}

export async function requireSupabaseUser(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ success: false, error: 'Missing Authorization bearer token' });
      return;
    }

    const anon = getSupabaseAnonForJwt(token);
    const { data: userData, error } = await anon.auth.getUser();
    if (error || !userData.user) {
      res.status(401).json({ success: false, error: 'Invalid session' });
      return;
    }

    const { data: profile } = await anon
      .from('profiles')
      .select('id, email, org_id, role, privileges')
      .eq('id', userData.user.id)
      .maybeSingle();

    (req as any).auth = {
      userId: userData.user.id,
      email: userData.user.email,
      orgId: profile?.org_id || null,
      role: profile?.role,
      privileges: profile?.privileges || null,
    } as AuthContext;
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message || 'Auth failed' });
  }
}

export function authOf(req: Request): AuthContext {
  return (req as any).auth as AuthContext;
}

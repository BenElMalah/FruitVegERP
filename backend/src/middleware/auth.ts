import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const email = user.email || 'unknown@email.com';
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: user.id, email, name: email.split('@')[0], role: 'boss' })
      .select()
      .single();
    if (insertError) {
      console.error('[auth middleware] Profile insert error:', insertError);
      return res.status(401).json({ error: `Profile not found (create failed: ${insertError.message})` });
    }
    profile = newProfile;
  }

  req.user = {
    id: user.id,
    email: user.email!,
    role: profile.role,
  };

  next();
}

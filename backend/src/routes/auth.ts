import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email, password,
  });

  if (error) return res.status(401).json({ error: error.message });

  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    const { data: np, error: ie } = await supabaseAdmin
      .from('profiles')
      .insert({ id: data.user.id, email, name: email.split('@')[0], role: 'boss' })
      .select()
      .single();
    if (ie) return res.status(500).json({ error: 'Failed to create profile' });
    profile = np;
  }

  res.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: { id: data.user.id, email: data.user.email, ...profile },
  });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user!.id)
    .single();
  res.json(profile);
});

router.get('/users', authenticate, authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('name');
  if (error) return res.status(400).json({ error: error.message });
  res.json(profiles);
});

router.post('/users', authenticate, authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { email, password, name, phone, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name, and role required' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: authData.user.id, email, name, phone, role })
    .select()
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ error: profileError.message });
  }

  res.status(201).json(profile);
});

router.put('/users/:id', authenticate, authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, phone, role, status, password } = req.body;
  if (password) {
    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
    if (pwdErr) return res.status(400).json({ error: pwdErr.message });
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ name, phone, role, status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/users/:id', authenticate, authorize('boss'), async (req: AuthRequest, res: Response) => {
  await supabaseAdmin.from('profiles').delete().eq('id', req.params.id);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;

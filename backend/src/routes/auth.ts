import { Router, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (profileError || !profile) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const loginEmail = profile.email;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail, password,
  });

  if (error) return res.status(401).json({ error: 'Invalid username or password' });

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
  const { username, password, name, phone, role } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: 'username, password, name, and role required' });
  }

  const email = `${username}@fruitveg.local`;

  const { data: existingUser } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({ id: authData.user.id, email, username, name, phone, role })
    .select()
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return res.status(400).json({ error: profileError.message });
  }

  res.status(201).json(profile);
});

router.put('/users/:id', authenticate, authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, phone, role, status, password, username } = req.body;
  if (password) {
    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, { password });
    if (pwdErr) return res.status(400).json({ error: pwdErr.message });
  }

  const updateData: any = { name, phone, role, status, updated_at: new Date().toISOString() };
  if (username) updateData.username = username;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
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

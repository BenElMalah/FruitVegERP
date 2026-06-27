import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.user!.id)
    .eq('read_status', false);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ count: count || 0 });
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read_status: true })
    .eq('id', id)
    .eq('user_id', req.user!.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_status: true })
    .eq('user_id', req.user!.id)
    .eq('read_status', false);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

export default router;

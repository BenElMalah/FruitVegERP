import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { unread_only } = req.query;
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false });

  if (unread_only === 'true') {
    query = query.eq('read_status', false);
  }

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
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

router.put('/:id/read', async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_status: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

router.put('/read-all', async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_status: true })
    .eq('user_id', req.user!.id)
    .eq('read_status', false);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
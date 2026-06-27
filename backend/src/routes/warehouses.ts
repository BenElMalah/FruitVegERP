import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('warehouses')
    .select('*')
    .order('name');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabaseAdmin
    .from('warehouses')
    .insert({ name, location })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.put('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, location } = req.body;

  const { data, error } = await supabaseAdmin
    .from('warehouses')
    .update({ name, location })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authorize('boss'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('warehouses')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

export default router;

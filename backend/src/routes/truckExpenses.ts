import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const truckId = req.query.truck_id as string;
  const date = req.query.date as string;

  let query = supabaseAdmin
    .from('truck_expenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (truckId) query = query.eq('truck_id', truckId);
  if (date) query = query.eq('arrival_date', date);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { truck_id, arrival_date, label, amount } = req.body;

  if (!truck_id || !arrival_date) {
    return res.status(400).json({ error: 'truck_id and arrival_date are required' });
  }

  const { data, error } = await supabaseAdmin
    .from('truck_expenses')
    .insert({
      truck_id,
      arrival_date,
      label: label || '',
      amount: amount || 0,
      created_by: req.user!.id,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { label, amount } = req.body;

  const { data, error } = await supabaseAdmin
    .from('truck_expenses')
    .update({ label, amount })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('truck_expenses')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;

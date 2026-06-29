import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const date = req.query.date as string || new Date().toISOString().split('T')[0];
  const truckId = req.query.truck_id as string;

  let query = supabaseAdmin
    .from('daily_arrivals')
    .select('*, products(name, unit), caisse_types(name), clients(id, name, phone, address), trucks(supplier_name)')
    .eq('arrival_date', date)
    .order('created_at');

  if (truckId) query = query.eq('truck_id', truckId);

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { arrival_date, truck_id, client_id, product_id, quantity, caisse_type_id, caisse_details, weight, price, status, notes } = req.body;

  if (!client_id || !product_id) {
    return res.status(400).json({ error: 'Client and product are required' });
  }

  const { data, error } = await supabaseAdmin
    .from('daily_arrivals')
    .insert({
      arrival_date: arrival_date || new Date().toISOString().split('T')[0],
      truck_id,
      client_id,
      product_id,
      quantity: quantity || 0,
      caisse_type_id,
      caisse_details: caisse_details || [],
      weight: weight || 0,
      price: price || 0,
      status: status || 'en demand',
      notes,
      created_by: req.user!.id,
    })
    .select('*, products(name, unit), caisse_types(name), clients(id, name, phone, address), trucks(supplier_name)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { truck_id, client_id, product_id, quantity, caisse_type_id, caisse_details, weight, price, status, notes } = req.body;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('daily_arrivals')
    .select('status, weight, price')
    .eq('id', req.params.id)
    .single();

  if (existingError) return res.status(400).json({ error: existingError.message });

  const { data, error } = await supabaseAdmin
    .from('daily_arrivals')
    .update({ truck_id, client_id, product_id, quantity, caisse_type_id, caisse_details, weight, price, status, notes })
    .eq('id', req.params.id)
    .select('*, products(name, unit), caisse_types(name), clients(id, name, phone, address), trucks(supplier_name)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Status change to delivred — no auto invoice, no notifications
  // Invoices are created manually from the Invoices page

  res.json(data);
});

router.delete('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('daily_arrivals')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
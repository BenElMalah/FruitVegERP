import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { warehouse_id } = req.query;
  let query = supabaseAdmin
    .from('stock')
    .select('*, products(name, unit), warehouses(name), trucks(supplier_name, default_price, created_at, products(name))')
    .order('updated_at', { ascending: false });

  if (warehouse_id) {
    query = query.eq('warehouse_id', warehouse_id);
  }

  const { data, error } = await query;

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/movements', async (req: AuthRequest, res: Response) => {
  const { date, product_id } = req.query;
  let query = supabaseAdmin
    .from('stock_movements')
    .select('*, products(name, unit)')
    .order('created_at', { ascending: false });

  if (date) query = query.eq('movement_date', date);
  if (product_id) query = query.eq('product_id', product_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

router.post('/adjust', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { product_id, quantity, warehouse_id, truck_id, adjustment_date } = req.body;

  if (!product_id || quantity === undefined) {
    return res.status(400).json({ error: 'product_id and quantity are required' });
  }

  // Record stock movement with date
  if (adjustment_date) {
    await supabaseAdmin.from('stock_movements').insert({
      product_id,
      quantity: Number(quantity),
      movement_date: adjustment_date,
      created_by: req.user!.id,
    });
  }

  // Upsert stock
  let query = supabaseAdmin
    .from('stock')
    .select('id, quantity')
    .eq('product_id', product_id);

  if (warehouse_id) {
    query = query.eq('warehouse_id', warehouse_id);
  } else {
    query = query.is('warehouse_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const newQty = Number(existing.quantity) + Number(quantity);
    if (newQty < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
    const updateData: any = { quantity: newQty, updated_at: new Date().toISOString() };
    if (truck_id) updateData.truck_id = truck_id;
    const { error } = await supabaseAdmin
      .from('stock')
      .update(updateData)
      .eq('id', existing.id);

    if (error) return res.status(400).json({ error: error.message });
  } else {
    if (Number(quantity) < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
    const insertData: any = { product_id, quantity };
    if (warehouse_id) insertData.warehouse_id = warehouse_id;
    if (truck_id) insertData.truck_id = truck_id;
    const { error } = await supabaseAdmin
      .from('stock')
      .insert(insertData);

    if (error) return res.status(400).json({ error: error.message });
  }

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'stock_adjust',
    description: `Stock adjustment: ${quantity > 0 ? '+' : ''}${quantity}`,
    reference_type: 'stock',
    reference_id: product_id,
  });

  res.json({ success: true });
});

router.put('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { quantity, truck_id } = req.body;

  if (Number(quantity) < 0) return res.status(400).json({ error: 'Stock cannot be negative' });

  const updateData: any = { quantity, updated_at: new Date().toISOString() };
  if (truck_id !== undefined) updateData.truck_id = truck_id || null;

  const { data, error } = await supabaseAdmin
    .from('stock')
    .update(updateData)
    .eq('id', req.params.id)
    .select('*, products(name, unit)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

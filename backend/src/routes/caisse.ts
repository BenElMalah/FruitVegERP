import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/types', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('caisse_types')
    .select('*')
    .order('name');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/types', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, category, value, tare } = req.body;

  const { data, error } = await supabaseAdmin
    .from('caisse_types')
    .insert({ name, category, value, tare })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/types/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, category, value, tare } = req.body;

  const { data, error } = await supabaseAdmin
    .from('caisse_types')
    .update({ name, category, value, tare })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/types/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  // Check references before deleting
  const { count: movementsCount, error: movErr } = await supabaseAdmin
    .from('caisse_movements')
    .select('id', { count: 'exact', head: true })
    .eq('caisse_type_id', req.params.id);

  const { count: itemsCount, error: itemErr } = await supabaseAdmin
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('caisse_type_id', req.params.id);

  if (!movErr && movementsCount && movementsCount > 0) {
    return res.status(400).json({ error: `Cannot delete: ${movementsCount} caisse movement(s) reference this type. Edit or delete them first.` });
  }

  if (!itemErr && itemsCount && itemsCount > 0) {
    return res.status(400).json({ error: `Cannot delete: ${itemsCount} invoice item(s) reference this type.` });
  }

  const { error } = await supabaseAdmin
    .from('caisse_types')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

router.get('/movements', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('caisse_movements')
    .select('*, clients(name), caisse_types(name, category), profiles!caisse_movements_created_by_fkey(name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/movements', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { client_id, caisse_type_id, quantity, movement_type, notes } = req.body;

  if (!client_id || !caisse_type_id || !quantity || !movement_type) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const { data, error } = await supabaseAdmin
    .from('caisse_movements')
    .insert({
      client_id,
      caisse_type_id,
      quantity,
      movement_type,
      notes,
      created_by: req.user!.id,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: `caisse_${movement_type}`,
    description: 'Caisse ' + movement_type + ': ' + quantity + ' units',
    reference_type: 'caisse_movement',
    reference_id: data.id,
  });

  res.status(201).json(data);
});

router.put('/movements/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { client_id, caisse_type_id, quantity, movement_type, notes } = req.body;

  const { data, error } = await supabaseAdmin
    .from('caisse_movements')
    .update({ client_id, caisse_type_id, quantity, movement_type, notes })
    .eq('id', req.params.id)
    .select('*, clients(name), caisse_types(name, category)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/balance/:clientId', async (req: AuthRequest, res: Response) => {
  const { data: movements, error } = await supabaseAdmin
    .from('caisse_movements')
    .select('caisse_type_id, quantity, movement_type, created_at, id, caisse_types(name, category)')
    .eq('client_id', req.params.clientId);

  if (error) return res.status(400).json({ error: error.message });

  // Find the first return record for this client (earliest created_at)
  const returnMovements = (movements || [])
    .filter((m: any) => m.movement_type === 'return')
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const firstReturn = returnMovements.length > 0 ? returnMovements[0] : null;

  const balance = new Map<string, { name: string; category: string; out: number; returned: number; lost: number; damaged: number }>();

  movements.forEach((m: any) => {
    if (m.caisse_types?.category === 'client') return;
    const key = m.caisse_type_id;
    if (!balance.has(key)) {
      balance.set(key, { name: m.caisse_types.name, category: m.caisse_types.category, out: 0, returned: 0, lost: 0, damaged: 0 });
    }
    const b = balance.get(key)!;
    if (m.movement_type === 'out') b.out += m.quantity;
    else if (m.movement_type === 'return') {
      // Exclude the first return record from counting
      if (firstReturn && m.id === firstReturn.id) return;
      b.returned += m.quantity;
    }
    else if (m.movement_type === 'lost') b.lost += m.quantity;
    else if (m.movement_type === 'damaged') b.damaged += m.quantity;
  });

  const result = Array.from(balance.values()).map(b => ({
    ...b,
    current_balance: b.out - b.returned,
  }));

  res.json(result);
});

router.get('/missing', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { data: clients } = await supabaseAdmin.from('clients').select('id, name');

  const missing: any[] = [];

  for (const client of clients || []) {
    const { data: balance } = await supabaseAdmin
      .rpc('get_client_caisse_balance', { p_client_id: client.id });

    if (balance && balance.length > 0) {
      const totalOut = balance.reduce((sum: number, b: any) => sum + (b.total_out || 0), 0);
      const totalReturned = balance.reduce((sum: number, b: any) => sum + (b.total_returned || 0), 0);
      missing.push({ client_id: client.id, client: client.name, total_out: totalOut, total_returned: totalReturned, balance: totalOut - totalReturned });
    } else {
      missing.push({ client_id: client.id, client: client.name, total_out: 0, total_returned: 0, balance: 0 });
    }
  }

  res.json(missing);
});

export default router;

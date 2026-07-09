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

router.delete('/movements/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('caisse_movements')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

router.delete('/movements-by-client', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { client_id, notes_like } = req.body;

  if (!client_id) return res.status(400).json({ error: 'client_id required' });

  let query = supabaseAdmin.from('caisse_movements').delete().eq('client_id', client_id);
  if (notes_like) query = query.like('notes', notes_like);

  const { error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
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

router.get('/missing', async (req: AuthRequest, res: Response) => {
  const { data: clients } = await supabaseAdmin.from('clients').select('id, name');

  const missing: any[] = [];

  for (const client of clients || []) {
    const { data: movements } = await supabaseAdmin
      .from('caisse_movements')
      .select('caisse_type_id, quantity, movement_type, id, created_at')
      .eq('client_id', client.id);

    // Find first return per client to exclude
    const returns = (movements || [])
      .filter((m: any) => m.movement_type === 'return')
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstReturnId = returns.length > 0 ? returns[0].id : null;

    let totalOut = 0;
    let totalReturned = 0;

    (movements || []).forEach((m: any) => {
      if (m.movement_type === 'out') {
        totalOut += m.quantity;
      } else if (m.movement_type === 'return') {
        if (m.id !== firstReturnId) {
          totalReturned += m.quantity;
        }
      }
    });

    missing.push({
      client_id: client.id,
      client: client.name,
      total_out: totalOut,
      total_returned: totalReturned,
      balance: totalOut - totalReturned,
    });
  }

  res.json(missing);
});

export default router;

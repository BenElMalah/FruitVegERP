import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('name');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Client not found' });
  res.json(data);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, phone, address, credit_limit, notes } = req.body;

  const { data: existing } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .ilike('name', name)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'A client with this name already exists', duplicate: existing });

  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({ name, phone, address, credit_limit, notes, created_by: req.user!.id })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // If created by collector, notify managers/bosses
  if (req.user!.role === 'collector') {
    const { data: managers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['boss', 'manager'])
      .eq('status', 'active');

    if (managers && managers.length > 0) {
      const notifications = managers.map((m: any) => ({
        user_id: m.id,
        title: 'New Client Added',
        message: `${req.user!.email} added a new client: ${name}`,
        type: 'info',
        reference_type: 'client',
        reference_id: data.id,
      }));
      await supabaseAdmin.from('notifications').insert(notifications);
    }
  }

  res.status(201).json(data);
});

router.put('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, phone, address, credit_limit, notes } = req.body;

  const { data: existing } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .ilike('name', name)
    .neq('id', req.params.id)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'A client with this name already exists', duplicate: existing });

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({ name, phone, address, credit_limit, notes, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

router.post('/merge', authorize('boss'), async (req: AuthRequest, res: Response) => {
  // Find duplicates by name (case-insensitive)
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name')
    .order('created_at');

  const groups = new Map<string, any[]>();
  (clients || []).forEach(c => {
    const key = c.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  });

  const merged: string[] = [];
  for (const [_, group] of groups) {
    if (group.length <= 1) continue;
    const keep = group[0];
    const remove = group.slice(1).map((c: any) => c.id);

    // Reassign references to the kept client
    for (const table of ['invoices', 'payments', 'caisse_movements']) {
      await supabaseAdmin.from(table).update({ client_id: keep.id }).in('client_id', remove);
    }

    // Delete duplicates
    const { error } = await supabaseAdmin.from('clients').delete().in('id', remove);
    if (!error) merged.push(...remove);
  }

  res.json({ merged_count: merged.length });
});

router.get('/duplicates', authorize('boss'), async (req: AuthRequest, res: Response) => {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('id, name, created_at')
    .order('name');

  const groups = new Map<string, any[]>();
  (clients || []).forEach(c => {
    const key = c.name.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  });

  const duplicates = Array.from(groups.values()).filter(g => g.length > 1);
  res.json(duplicates);
});

router.get('/:id/invoices', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('client_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/:id/payments', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('client_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/:id/caisse-balance', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .rpc('get_client_caisse_balance', { p_client_id: req.params.id });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

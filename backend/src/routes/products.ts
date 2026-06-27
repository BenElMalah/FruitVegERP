import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const date = req.query.date as string;
  let query = supabaseAdmin.from('products').select('*');

  if (date) {
    const dayStart = date + 'T00:00:00Z';
    const dayEnd = date + 'T23:59:59Z';
    query = query.gte('created_at', dayStart).lte('created_at', dayEnd);
  }

  const { data: products, error } = await query.order('name');
  if (error) return res.status(400).json({ error: error.message });

  // Fetch average truck default_price per product for "Moy/Price"
  const { data: truckPrices } = await supabaseAdmin
    .from('trucks')
    .select('product_id, default_price');

  const avgPriceMap = new Map<string, number>();
  if (truckPrices) {
    const groups = new Map<string, { sum: number; count: number }>();
    for (const tp of truckPrices) {
      const g = groups.get(tp.product_id) || { sum: 0, count: 0 };
      g.sum += Number(tp.default_price);
      g.count++;
      groups.set(tp.product_id, g);
    }
    for (const [pid, g] of groups) {
      avgPriceMap.set(pid, g.sum / g.count);
    }
  }

  const result = (products || []).map((p: any) => ({
    ...p,
    moy_price: avgPriceMap.get(p.id) || 0,
  }));

  res.json(result);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

router.post('/', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, unit, price } = req.body;

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ name, unit, price })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.post('/backfill-from-trucks', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  // Find all trucks whose product_id doesn't exist in the products table
  const { data: trucks } = await supabaseAdmin
    .from('trucks')
    .select('id, product_id, supplier_name, default_price');

  if (!trucks || !trucks.length) return res.json({ created: 0 });

  // Get all valid product IDs
  const validIds = new Set<string>();
  for (const t of trucks) {
    if (t.product_id) validIds.add(t.product_id);
  }

  const { data: existingProducts } = await supabaseAdmin
    .from('products')
    .select('id');

  const existingIds = new Set((existingProducts || []).map((p: any) => p.id));

  const missing: { id: string; name: string; price: number }[] = [];
  for (const t of trucks) {
    if (t.product_id && !existingIds.has(t.product_id)) {
      missing.push({
        id: t.product_id,
        name: t.supplier_name || 'Unknown Truck',
        price: t.default_price || 0,
      });
    }
  }

  let created = 0;
  for (const m of missing) {
    // Check if product was already created in a previous run
    const { data: check } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', m.id)
      .maybeSingle();

    if (!check) {
      const { error } = await supabaseAdmin
        .from('products')
        .insert({ id: m.id, name: m.name, unit: 'kg', price: m.price });

      if (!error) created++;
    }
  }

  res.json({ created, total_missing: missing.length });
});

// Get all clients who purchased this product with caisses, price, weight, and due
router.get('/:id/clients', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('invoice_items')
    .select(`
      quantity, price, total_weight, net_weight,
      invoices!inner(
        id, client_id, total, paid_amount, remaining_amount, status,
        clients!inner(id, name, phone)
      )
    `)
    .eq('product_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  // Aggregate by client
  const clientMap = new Map<string, {
    client_id: string;
    client_name: string;
    phone: string;
    total_caisses: number;
    total_weight: number;
    total_price: number;
    total_due: number;
    invoices: number;
  }>();

  for (const item of data || []) {
    const inv = (item as any).invoices;
    if (!inv || !inv.clients) continue;
    const clientId = inv.client_id;
    const existing = clientMap.get(clientId) || {
      client_id: clientId,
      client_name: inv.clients.name,
      phone: inv.clients.phone || '',
      total_caisses: 0,
      total_weight: 0,
      total_price: 0,
      total_due: 0,
      invoices: 0,
    };

    existing.total_caisses += Number(item.quantity) || 0;
    existing.total_weight += Number(item.total_weight || item.net_weight || 0);
    existing.total_price += (Number(item.price) * Number(item.quantity)) || 0;
    existing.total_due += Number(inv.remaining_amount) || 0;
    existing.invoices += 1;

    clientMap.set(clientId, existing);
  }

  res.json(Array.from(clientMap.values()));
});

router.put('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { name, unit, price } = req.body;

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ name, unit, price })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authorize('boss'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;

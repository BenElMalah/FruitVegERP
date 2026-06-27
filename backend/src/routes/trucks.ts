import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('trucks')
    .select('*, products(name, unit)')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  let { supplier_name, product_id, product_name, default_price, net_weight, cost_price } = req.body;

  if (!supplier_name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  // Auto-create product if product_name is given instead of product_id
  if (!product_id && product_name) {
    const escapedName = product_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const { data: existingProducts } = await supabaseAdmin
      .from('products')
      .select('name')
      .ilike('name', escapedName + '%');

    const matchedNames: string[] = (existingProducts || []).map((p: any) => p.name);
    const exactExists = matchedNames.some(n => n.toLowerCase() === product_name.toLowerCase());

    if (exactExists) {
      const baseLower = product_name.toLowerCase() + ' ';
      let maxNum = 0;
      for (const n of matchedNames) {
        const lower = n.toLowerCase();
        if (lower.startsWith(baseLower)) {
          const suffix = lower.slice(baseLower.length).trim();
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }

      const newName = product_name + ' ' + (maxNum + 1);

      const { data: newProduct, error: createError } = await supabaseAdmin
        .from('products')
        .insert({ name: newName, unit: 'kg', price: default_price || 0 })
        .select()
        .single();

      if (createError) return res.status(400).json({ error: createError.message });
      product_id = newProduct.id;
    } else {
      const { data: newProduct, error: createError } = await supabaseAdmin
        .from('products')
        .insert({ name: product_name, unit: 'kg', price: default_price || 0 })
        .select()
        .single();

      if (createError) return res.status(400).json({ error: createError.message });
      product_id = newProduct.id;
    }
  }

  if (!product_id) {
    return res.status(400).json({ error: 'Product is required (provide product_id or product_name)' });
  }

  const { data, error } = await supabaseAdmin
    .from('trucks')
    .insert({ supplier_name, product_id, default_price: default_price || 0, net_weight: net_weight || 0, cost_price: cost_price || 0, created_by: req.user!.id })
    .select('*, products(name, unit)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'created_truck',
    description: `Truck: ${supplier_name} — ${data.products?.name || ''}`,
    reference_type: 'truck',
    reference_id: data.id,
  });

  res.status(201).json(data);
});

router.put('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { supplier_name, product_id, default_price, net_weight, cost_price } = req.body;

  const { data, error } = await supabaseAdmin
    .from('trucks')
    .update({ supplier_name, product_id, default_price, net_weight, cost_price })
    .eq('id', req.params.id)
    .select('*, products(name, unit)')
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', authorize('boss', 'manager', 'warehouse'), async (req: AuthRequest, res: Response) => {
  const { error } = await supabaseAdmin
    .from('trucks')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

export default router;
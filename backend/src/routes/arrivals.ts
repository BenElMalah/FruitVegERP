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

  // When status changes to delivred, create an invoice and send alerts to collectors
  if (status === 'delivred' && existing?.status !== 'delivred') {
    const arrival = data;

    // Use the DB row values (not req.body) since frontend may only send { status: 'delivred' }
    const clientId = arrival.client_id;
    const productId = arrival.product_id;
    const caisseDetailsFromDb = arrival.caisse_details || [];

    // Validate weight and price before creating invoice
    const weightVal = Number(arrival.weight) || 0;
    const priceVal = Number(arrival.price) || 0;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Cannot create invoice: arrival has no client assigned' });
    }
    if (weightVal <= 0 || priceVal <= 0) {
      const errorMsg = 'Cannot create invoice: weight and price must be set to values greater than 0';
      return res.status(400).json({ error: errorMsg });
    }

    try {
      // Build invoice items from daily arrival caisse details/weight/price
      const caisses = (caisseDetailsFromDb || [])
        .filter((c: any) => c.caisseTypeId || c.caisse_type_id)
        .map((c: any) => ({
          caisseTypeId: c.caisseTypeId || c.caisse_type_id,
          caisse_count: c.qty || c.caisse_count || 0,
        }));

      // Fetch tares for referenced caisse types
      const caisseTypeIds = Array.from(new Set(caisses.map((c: any) => c.caisseTypeId || c.caisse_type_id)));
      const { data: caisseTypesData } = await supabaseAdmin
        .from('caisse_types')
        .select('id, tare')
        .in('id', caisseTypeIds);

      const tareMap: Record<string, number> = {};
      for (const ct of (caisseTypesData || [])) {
        tareMap[ct.id] = Number(ct.tare) || 0;
      }

      const tareDeduction = caisses.reduce((sum: number, c: any) => sum + (c.caisse_count || 0) * (tareMap[c.caisseTypeId] || 0), 0);
      const totalWeight = weightVal;
      const netWeight = Math.max(0, totalWeight - tareDeduction);
      const unitPrice = priceVal;
      const subtotal = netWeight * unitPrice;

      const invoiceItemsPayload = [{
        product_id: productId,
        quantity: netWeight,
        price: unitPrice,
        subtotal,
        total_weight: totalWeight,
        net_weight: netWeight,
        caisses: JSON.stringify(caisses),
      }];

      const { data: invoice, error: invError } = await supabaseAdmin
        .from('invoices')
        .insert({
          client_id: clientId,
          total: subtotal,
          remaining_amount: subtotal,
          due_date: null,
          notes: arrival.notes ? `${arrival.notes} (auto from arrival #${arrival.id})` : `Auto invoice from arrival #${arrival.id}`,
          created_by: req.user!.id,
        })
        .select()
        .single();

      if (invError) {
        console.error('Failed to create invoice for arrival', arrival.id, invError);
      } else if (invoice) {
        const itemsWithInvoice = invoiceItemsPayload.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          total_weight: item.total_weight,
          net_weight: item.net_weight,
          caisses: item.caisses,
          invoice_id: invoice.id,
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('invoice_items')
          .insert(itemsWithInvoice);

        if (itemsError) {
          console.error('Failed to create invoice items for arrival', arrival.id, itemsError);
          await supabaseAdmin.from('invoices').delete().eq('id', invoice.id);
        } else {
          // Auto-create outgoing caisse movements
          for (const c of caisses) {
            if (c.caisseTypeId && c.caisse_count > 0) {
              await supabaseAdmin.from('caisse_movements').insert({
                client_id: clientId,
                caisse_type_id: c.caisseTypeId,
                quantity: c.caisse_count,
                movement_type: 'out',
                notes: `Invoice #${invoice.invoice_number}`,
                created_by: req.user!.id,
              });
            }
          }

          // Record activity for invoice creation
          await supabaseAdmin.from('activities').insert({
            user_id: req.user!.id,
            action: 'created_invoice',
            description: `Auto created Invoice #${invoice.invoice_number} from arrival #${arrival.id}`,
            reference_type: 'invoice',
            reference_id: invoice.id,
          });

          // Fetch all collectors
          const { data: collectors, error: collectorsError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'collector')
            .eq('status', 'active');

          if (collectorsError) {
            console.error('Failed to fetch collectors for arrival notification', collectorsError);
          } else if (collectors && collectors.length > 0) {
            const notifications = collectors.map((c: any) => ({
              user_id: c.id,
              title: 'New Delivery Invoice',
              message: `A new invoice #${invoice.invoice_number} was created for client "${arrival.clients?.name || 'Unknown'}" after delivery of ${totalWeight} kg (net ${netWeight} kg) for ${subtotal.toFixed(2)}.`,
              type: 'invoice',
              reference_type: 'invoice',
              reference_id: invoice.id,
              read_status: false,
            }));

            const { error: notifError } = await supabaseAdmin
              .from('notifications')
              .insert(notifications);

            if (notifError) {
              console.error('Failed to insert notifications for arrival', arrival.id, notifError);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Unexpected error during arrival invoice flow', arrival.id, err);
    }
  }

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
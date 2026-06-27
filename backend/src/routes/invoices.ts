import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(name, phone), invoice_items(*)')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/group', authorize('boss', 'manager', 'collector'), async (req: AuthRequest, res: Response) => {
  const { invoice_ids, payment_amount, payment_method, notes } = req.body;

  if (!invoice_ids?.length) {
    return res.status(400).json({ error: 'invoice_ids are required' });
  }

  const { data: sourceInvoices, error: fetchErr } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, client_id, remaining_amount, status')
    .in('id', invoice_ids);

  if (fetchErr) return res.status(400).json({ error: fetchErr.message });
  if (!sourceInvoices?.length) return res.status(400).json({ error: 'No invoices found' });

  const unpaid = sourceInvoices.filter((inv: any) => inv.status !== 'paid');
  if (unpaid.length === 0) return res.status(400).json({ error: 'All selected invoices are already paid' });

  const clientId = unpaid[0].client_id;
  if (unpaid.some((inv: any) => inv.client_id !== clientId)) {
    return res.status(400).json({ error: 'All invoices must belong to the same client' });
  }

  const totalDue = unpaid.reduce((sum: number, inv: any) => sum + Number(inv.remaining_amount), 0);

  const groupedFrom = unpaid.map((inv: any) => ({
    invoice_id: inv.id,
    invoice_number: inv.invoice_number,
    remaining_amount: Number(inv.remaining_amount),
  }));

  const { data: newInvoice, error: invError } = await supabaseAdmin
    .from('invoices')
    .insert({
      client_id: clientId,
      total: totalDue,
      remaining_amount: totalDue,
      paid_amount: 0,
      status: 'unpaid',
      notes: notes || `Grouped from ${unpaid.map((i: any) => i.invoice_number).join(', ')}`,
      grouped_from: groupedFrom,
      created_by: req.user!.id,
    })
    .select()
    .single();

  if (invError) return res.status(400).json({ error: invError.message });

  const amount = payment_amount != null ? Number(payment_amount) : totalDue;

  if (amount > 0) {
    const { error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        invoice_id: newInvoice.id,
        client_id: clientId,
        amount,
        payment_method: payment_method || 'cash',
        notes: notes || `Payment for grouped invoice`,
        received_by: req.user!.id,
      });

    if (payErr) {
      console.error('Failed to create payment for grouped invoice', payErr);
    }
  }

  for (const inv of unpaid) {
    await supabaseAdmin
      .from('invoices')
      .update({ status: 'paid', paid_amount: inv.remaining_amount, remaining_amount: 0, updated_at: new Date().toISOString() })
      .eq('id', inv.id);
  }

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'created_invoice',
    description: `Created grouped invoice from ${unpaid.map((i: any) => i.invoice_number).join(', ')}`,
    reference_type: 'invoice',
    reference_id: newInvoice.id,
  });

  const { data: fullInvoice } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(name, phone), invoice_items(*, products(*))')
    .eq('id', newInvoice.id)
    .single();

  res.status(201).json(fullInvoice || newInvoice);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(*), invoice_items(*, products(*)), payments(*)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Invoice not found' });
  res.json(data);
});

router.post('/', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { client_id, items, due_date, notes } = req.body;

  if (!client_id || !items?.length) {
    return res.status(400).json({ error: 'Client ID and items are required' });
  }

  // Fetch tare for all caisse types referenced across items
  const allCaisseTypeIds = new Set<string>();
  for (const item of items) {
    const caisses = item.caisses || (item.caisse_type_id ? [{ caisse_type_id: item.caisse_type_id, caisse_count: item.caisse_count || 0 }] : []);
    for (const c of caisses) {
      if (c.caisse_type_id) allCaisseTypeIds.add(c.caisse_type_id);
    }
  }
  const { data: caisseTypesData } = await supabaseAdmin
    .from('caisse_types')
    .select('id, tare')
    .in('id', Array.from(allCaisseTypeIds));
  const tareMap: Record<string, number> = {};
  for (const ct of (caisseTypesData || [])) {
    tareMap[ct.id] = Number(ct.tare) || 0;
  }

  let total = 0;
  const invoiceItems = items.map((item: any) => {
    const caisses = (item.caisses || (item.caisse_type_id ? [{ caisse_type_id: item.caisse_type_id, caisse_count: item.caisse_count || 0 }] : []))
      .filter((c: any) => c.caisse_type_id && c.caisse_count > 0);

    const totalWeight = item.total_weight || item.quantity || 0;
    const tareDeduction = caisses.reduce((sum: number, c: any) =>
      sum + (c.caisse_count || 0) * (tareMap[c.caisse_type_id] || 0), 0);
    const netWeight = Math.max(0, totalWeight - tareDeduction);
    const subtotal = netWeight * item.price;
    total += subtotal;

    return {
      product_id: item.product_id,
      quantity: netWeight,
      price: item.price,
      subtotal,
      total_weight: totalWeight,
      net_weight: netWeight,
      caisses,
    };
  });

  const { data: invoice, error: invError } = await supabaseAdmin
    .from('invoices')
    .insert({
      client_id,
      total,
      remaining_amount: total,
      due_date,
      notes,
      created_by: req.user!.id,
    })
    .select()
    .single();

  if (invError) return res.status(400).json({ error: invError.message });

  const itemsWithInvoice = invoiceItems.map((item: any) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    total_weight: item.total_weight,
    net_weight: item.net_weight,
    caisses: JSON.stringify(item.caisses),
    invoice_id: invoice.id,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from('invoice_items')
    .insert(itemsWithInvoice);

  if (itemsError) {
    await supabaseAdmin.from('invoices').delete().eq('id', invoice.id);
    return res.status(400).json({ error: itemsError.message });
  }

  // Auto-create outgoing caisse movements with due date
  const movDate = due_date ? new Date(due_date).toISOString() : undefined;
  for (const item of invoiceItems) {
    for (const c of (item.caisses || [])) {
      if (c.caisse_type_id && c.caisse_count > 0) {
        await supabaseAdmin.from('caisse_movements').insert({
          client_id,
          caisse_type_id: c.caisse_type_id,
          quantity: c.caisse_count,
          movement_type: 'out',
          notes: `Invoice #${invoice.invoice_number}`,
          created_by: req.user!.id,
          ...(movDate ? { created_at: movDate } : {}),
        });
      }
    }
  }

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'created_invoice',
    description: `Created Invoice #${invoice.invoice_number}`,
    reference_type: 'invoice',
    reference_id: invoice.id,
  });

  res.status(201).json(invoice);
});

router.put('/:id', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { client_id, items, due_date, notes } = req.body;

  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, client_id')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  // Fetch tare for all caisse types referenced across items
  const allCaisseTypeIds = new Set<string>();
  for (const item of items) {
    const caisses = item.caisses || (item.caisse_type_id ? [{ caisse_type_id: item.caisse_type_id, caisse_count: item.caisse_count || 0 }] : []);
    for (const c of caisses) {
      if (c.caisse_type_id) allCaisseTypeIds.add(c.caisse_type_id);
    }
  }
  const { data: caisseTypesData } = await supabaseAdmin
    .from('caisse_types')
    .select('id, tare')
    .in('id', Array.from(allCaisseTypeIds));
  const tareMap: Record<string, number> = {};
  for (const ct of (caisseTypesData || [])) {
    tareMap[ct.id] = Number(ct.tare) || 0;
  }

  let total = 0;
  const invoiceItems = items.map((item: any) => {
    const caisses = (item.caisses || (item.caisse_type_id ? [{ caisse_type_id: item.caisse_type_id, caisse_count: item.caisse_count || 0 }] : []))
      .filter((c: any) => c.caisse_type_id && c.caisse_count > 0);

    const totalWeight = item.total_weight || item.quantity || 0;
    const tareDeduction = caisses.reduce((sum: number, c: any) =>
      sum + (c.caisse_count || 0) * (tareMap[c.caisse_type_id] || 0), 0);
    const netWeight = Math.max(0, totalWeight - tareDeduction);
    const subtotal = netWeight * item.price;
    total += subtotal;

    return {
      product_id: item.product_id,
      quantity: netWeight,
      price: item.price,
      subtotal,
      total_weight: totalWeight,
      net_weight: netWeight,
      caisses,
    };
  });

  const { error: invError } = await supabaseAdmin
    .from('invoices')
    .update({
      client_id,
      total,
      remaining_amount: total,
      paid_amount: 0,
      status: 'unpaid',
      due_date,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id);

  if (invError) return res.status(400).json({ error: invError.message });

  // Replace items
  await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', req.params.id);

  const itemsWithInvoice = invoiceItems.map((item: any) => ({
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal,
    total_weight: item.total_weight,
    net_weight: item.net_weight,
    caisses: JSON.stringify(item.caisses),
    invoice_id: req.params.id,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from('invoice_items')
    .insert(itemsWithInvoice);

  if (itemsError) return res.status(400).json({ error: itemsError.message });

  // Remove old caisse movements for this invoice, then create new ones
  await supabaseAdmin
    .from('caisse_movements')
    .delete()
    .eq('notes', `Invoice #${existing.invoice_number}`);

  const movDate = due_date ? new Date(due_date).toISOString() : undefined;
  for (const item of invoiceItems) {
    for (const c of (item.caisses || [])) {
      if (c.caisse_type_id && c.caisse_count > 0) {
        await supabaseAdmin.from('caisse_movements').insert({
          client_id,
          caisse_type_id: c.caisse_type_id,
          quantity: c.caisse_count,
          movement_type: 'out',
          notes: `Invoice #${existing.invoice_number}`,
          created_by: req.user!.id,
          ...(movDate ? { created_at: movDate } : {}),
        });
      }
    }
  }

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'updated_invoice',
    description: `Updated Invoice #${existing.invoice_number}`,
    reference_type: 'invoice',
    reference_id: req.params.id,
  });

  res.json({ success: true });
});

router.patch('/:id/status', authorize('boss', 'manager'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body;

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('*, clients(*), invoice_items(*, products(*))')
    .eq('id', req.params.id)
    .single();

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);

  doc.pipe(res);

  doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).font('Helvetica').text(`#${invoice.invoice_number}`, { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(10);
  doc.text(`Client: ${invoice.clients.name}`);
  doc.text(`Phone: ${invoice.clients.phone || '-'}`);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`);
  if (invoice.due_date) doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`);
  doc.moveDown();

  const tableTop = doc.y;
  const col1 = 50, col2 = 280, col3 = 360, col4 = 420, col5 = 500;

  doc.font('Helvetica-Bold');
  doc.text('Product', col1, tableTop);
  doc.text('Qty', col2, tableTop);
  doc.text('Price', col3, tableTop);
  doc.text('Subtotal', col4, tableTop);

  doc.font('Helvetica');
  let y = tableTop + 20;

  invoice.invoice_items.forEach((item: any) => {
    doc.text(item.products?.name || 'Product', col1, y);
    doc.text(String(item.quantity), col2, y);
    doc.text(`$${item.price.toFixed(2)}`, col3, y);
    doc.text(`$${item.subtotal.toFixed(2)}`, col4, y);
    y += 20;
  });

  doc.moveDown();
  doc.font('Helvetica-Bold');
  doc.text(`Total: $${invoice.total.toFixed(2)}`, { align: 'right' });
  doc.text(`Paid: $${invoice.paid_amount.toFixed(2)}`, { align: 'right' });
  doc.text(`Remaining: $${invoice.remaining_amount.toFixed(2)}`, { align: 'right' });

  doc.end();
});

export default router;

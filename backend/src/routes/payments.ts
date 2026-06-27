import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, invoices(invoice_number), clients(name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { invoice_id, client_id, amount, payment_method, notes, proof_image_url, signature_url } = req.body;

  if (!invoice_id || !client_id || !amount) {
    return res.status(400).json({ error: 'invoice_id, client_id, and amount are required' });
  }

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      invoice_id,
      client_id,
      amount,
      payment_method: payment_method || 'cash',
      notes,
      proof_image_url,
      signature_url,
      received_by: req.user!.id,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await supabaseAdmin.from('activities').insert({
    user_id: req.user!.id,
    action: 'collected_payment',
    description: `Collected $${amount} from client`,
    reference_type: 'payment',
    reference_id: payment.id,
  });

  res.status(201).json(payment);
});

router.get('/today', async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, clients(name), invoices(invoice_number)')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/client/:clientId', async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*, invoices(invoice_number)')
    .eq('client_id', req.params.clientId)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

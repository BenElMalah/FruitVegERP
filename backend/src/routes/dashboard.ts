import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/summary', async (req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { data: todayInvoices },
    { data: unpaidInvoices },
    { data: todayPayments },
    { data: overdueClients },
    { data: recentActivities },
    { data: stockData },
    { count: unreadNotifications },
    { data: yesterdayDeliveries },
    { data: todayArrivals },
  ] = await Promise.all([
    supabaseAdmin.from('invoices').select('total').gte('created_at', today.toISOString()),
    supabaseAdmin.from('invoices').select('id, total, remaining_amount, clients(name)').in('status', ['unpaid', 'partial', 'overdue']),
    supabaseAdmin.from('payments').select('amount').gte('created_at', today.toISOString()),
    supabaseAdmin.from('invoices').select('client_id, total, remaining_amount, clients(name)').lt('due_date', today.toISOString()).in('status', ['unpaid', 'partial', 'overdue']),
    supabaseAdmin.from('activities').select('*, profiles(name)').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('stock').select('*, products(name, unit), trucks(supplier_name)').order('quantity', { ascending: false }),
    supabaseAdmin.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user!.id).eq('read_status', false),
    (async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = yesterday.toISOString().split('T')[0];
      return supabaseAdmin.from('daily_arrivals').select('weight, quantity').eq('arrival_date', yDate).eq('status', 'delivred');
    })(),
    supabaseAdmin.from('daily_arrivals').select('weight, quantity, net_weight, status').eq('arrival_date', today.toISOString().split('T')[0]),
  ]);

  const todaySales = (todayInvoices || []).reduce((sum, inv) => sum + Number(inv.total), 0);
  const todayCollected = (todayPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUnpaid = (unpaidInvoices || []).reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

  const yesterdayTotalWeight = (yesterdayDeliveries || []).reduce(
    (sum: number, d: any) => sum + Number(d.weight || 0), 0
  );
  const todayTotalWeight = (todayArrivals || []).reduce(
    (sum: number, d: any) => sum + Number(d.weight || 0), 0
  );
  const stockAlert = yesterdayTotalWeight > 0 && todayTotalWeight < yesterdayTotalWeight
    ? {
        yesterday_weight: yesterdayTotalWeight,
        today_weight: todayTotalWeight,
        deficit: yesterdayTotalWeight - todayTotalWeight,
      }
    : null;

  res.json({
    today_sales: todaySales,
    total_unpaid: totalUnpaid,
    today_collected: todayCollected,
    overdue_count: overdueClients?.length || 0,
    overdue_clients: overdueClients?.map((c: any) => ({
      name: c.clients.name,
      amount: Number(c.remaining_amount),
      total: Number(c.total),
    })) || [],
    recent_activities: recentActivities?.map((a: any) => ({
      user: a.profiles?.name || 'Unknown',
      action: a.action,
      description: a.description,
      created_at: a.created_at,
    })) || [],
    stock: (stockData || []).map((s: any) => ({
      id: s.id,
      product_name: s.products?.name || 'Unknown',
      unit: s.products?.unit || '',
      quantity: Number(s.quantity),
      truck_supplier: s.trucks?.supplier_name || null,
    })),
    unread_notifications: unreadNotifications || 0,
    stock_alert: stockAlert,
  });
});

router.get('/sales', async (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('total, created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at');

  if (error) return res.status(400).json({ error: error.message });

  const dailyMap = new Map<string, number>();
  (data || []).forEach((inv: any) => {
    const day = new Date(inv.created_at).toISOString().split('T')[0];
    dailyMap.set(day, (dailyMap.get(day) || 0) + Number(inv.total));
  });

  res.json(Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total })));
});

router.get('/stats', async (req: AuthRequest, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString();

  const [
    { data: invoices },
    { data: movements },
  ] = await Promise.all([
    supabaseAdmin.from('invoices').select('total, remaining_amount, created_at, status')
      .gte('created_at', startStr),
    supabaseAdmin.from('caisse_movements').select('client_id, id, quantity, movement_type, created_at')
      .gte('created_at', startStr),
  ]);

  // Find first return per client (earliest created_at) to exclude from counting
  const firstReturnPerClient = new Map<string, string>(); // client_id -> movement id
  (movements || [])
    .filter((m: any) => m.movement_type === 'return')
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((m: any) => {
      if (!firstReturnPerClient.has(m.client_id)) {
        firstReturnPerClient.set(m.client_id, m.id);
      }
    });

  const groupKey = (dateStr: string) => {
    const d = new Date(dateStr);
    if (days <= 14) return d.toISOString().split('T')[0];
    if (days <= 60) {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const profitsMap = new Map<string, number>();
  (invoices || []).forEach((inv: any) => {
    const key = groupKey(inv.created_at);
    profitsMap.set(key, (profitsMap.get(key) || 0) + Number(inv.total));
  });

  const outMap = new Map<string, number>();
  const returnedMap = new Map<string, number>();
  (movements || []).forEach((m: any) => {
    const key = groupKey(m.created_at);
    if (m.movement_type === 'out') {
      outMap.set(key, (outMap.get(key) || 0) + m.quantity);
    } else if (m.movement_type === 'return') {
      // Exclude the first return per client from counting
      if (firstReturnPerClient.get(m.client_id) === m.id) return;
      returnedMap.set(key, (returnedMap.get(key) || 0) + m.quantity);
    }
  });

  const dueMap = new Map<string, number>();
  (invoices || []).filter((inv: any) => inv.status !== 'paid').forEach((inv: any) => {
    const key = groupKey(inv.created_at);
    dueMap.set(key, (dueMap.get(key) || 0) + Number(inv.remaining_amount));
  });

  const allKeys = Array.from(new Set([
    ...profitsMap.keys(),
    ...outMap.keys(),
    ...dueMap.keys(),
  ])).sort();

  const profits = allKeys.map(date => ({ date, value: Math.round((profitsMap.get(date) || 0) * 100) / 100 }));
  const missingCaisses = allKeys.map(date => {
    const out = outMap.get(date) || 0;
    const returned = returnedMap.get(date) || 0;
    return { date, out, returned, missing: out - returned };
  });
  const dueAmounts = allKeys.map(date => ({ date, value: Math.round((dueMap.get(date) || 0) * 100) / 100 }));

  const totalProfits = profits.reduce((s, p) => s + p.value, 0);
  const totalMissing = missingCaisses.reduce((s, m) => s + m.missing, 0);
  const totalDue = dueAmounts.reduce((s, d) => s + d.value, 0);

  res.json({ profits, missingCaisses, dueAmounts, summary: { totalProfits, totalMissing, totalDue } });
});

export default router;

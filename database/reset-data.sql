-- ============================================
-- RESET ALL DATA — Start from 0
-- Keeps: profiles (users), caisse_types (config)
-- ============================================

DELETE FROM public.notifications;
DELETE FROM public.activities;
DELETE FROM public.payments;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.caisse_movements;
DELETE FROM public.daily_arrivals;
DELETE FROM public.stock;
DELETE FROM public.trucks;
DELETE FROM public.clients;
DELETE FROM public.products;
DELETE FROM public.warehouses;
DELETE FROM public.tasks;

SELECT pg_notify('pgrst', 'reload schema');

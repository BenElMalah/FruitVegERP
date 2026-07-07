-- ============================================
-- RESET DATABASE
-- Keep ONLY: profiles, clients, caisse_types
-- Drop everything else
-- ============================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_generate_invoice_number ON public.invoices;
DROP TRIGGER IF EXISTS trg_update_invoice_on_payment ON public.payments;
DROP TRIGGER IF EXISTS trg_notify_on_delivery ON public.daily_arrivals;

-- Drop functions
DROP FUNCTION IF EXISTS generate_invoice_number();
DROP FUNCTION IF EXISTS update_invoice_status();
DROP FUNCTION IF EXISTS notify_on_delivery();
DROP FUNCTION IF EXISTS get_client_caisse_balance(UUID);

-- Drop sequences
DROP SEQUENCE IF EXISTS invoice_seq;

-- Drop RLS policies that reference tables we're dropping
DROP POLICY IF EXISTS "profiles_select_own_or_boss" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Drop all tables (in order to respect FK constraints)
DROP TABLE IF EXISTS public.truck_expenses CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.trucks CASCADE;
DROP TABLE IF EXISTS public.daily_arrivals CASCADE;
DROP TABLE IF EXISTS public.caisse_movements CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.stock CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS invoice_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;

-- Keep caisse_category since caisse_types uses it
-- Keep profiles, clients, caisse_types tables with their data

-- Re-add basic RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_boss"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'boss')
  );

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

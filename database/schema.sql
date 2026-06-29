-- Fruit & Vegetable Wholesaler ERP - Supabase PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS (managed by Supabase Auth + custom table)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('boss', 'manager', 'collector', 'warehouse')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_clients_name ON public.clients(LOWER(name));

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'box', 'piece', 'crate', 'bag', 'ton')),
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STOCK
-- ============================================
CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_stock_product ON public.stock(product_id);

-- ============================================
-- INVOICES
-- ============================================
CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'unpaid',
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_created ON public.invoices(created_at);

-- ============================================
-- INVOICE ITEMS
-- ============================================
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS caisse_type_id UUID REFERENCES public.caisse_types(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS caisse_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS total_weight DECIMAL(12,2);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS net_weight DECIMAL(12,2);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS caisses JSONB DEFAULT '[]'::jsonb;

CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TYPE payment_method AS ENUM ('cash', 'bank_transfer', 'check');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  notes TEXT,
  proof_image_url TEXT,
  signature_url TEXT,
  received_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_payments_client ON public.payments(client_id);
CREATE INDEX idx_payments_date ON public.payments(created_at);

-- ============================================
-- CAISSE TYPES
-- ============================================
CREATE TYPE caisse_category AS ENUM ('branded', 'foreign', 'rented', 'client');

CREATE TABLE public.caisse_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category caisse_category NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  tare DECIMAL(10,3) NOT NULL DEFAULT 0,
  qr_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TRUCKS (daily delivery vehicles)
-- ============================================
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trucks_supplier ON public.trucks(supplier_name);

-- ============================================
-- CAISSE MOVEMENTS
-- ============================================
CREATE TYPE movement_type AS ENUM ('out', 'return', 'lost', 'damaged');

CREATE TABLE public.caisse_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  caisse_type_id UUID NOT NULL REFERENCES public.caisse_types(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  movement_type movement_type NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_caisse_movements_client ON public.caisse_movements(client_id);
CREATE INDEX idx_caisse_movements_type ON public.caisse_movements(movement_type);

-- ============================================
-- DAILY ARRIVALS
-- ============================================
CREATE TABLE public.daily_arrivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  caisse_type_id UUID NOT NULL REFERENCES public.caisse_types(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL;
ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS weight DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS price DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'en demand';
ALTER TABLE public.daily_arrivals ADD COLUMN IF NOT EXISTS caisse_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.daily_arrivals ALTER COLUMN caisse_type_id DROP NOT NULL;

CREATE INDEX idx_daily_arrivals_date ON public.daily_arrivals(arrival_date);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  reference_type TEXT,
  reference_id UUID,
  read_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read_status);

-- ============================================
-- ACTIVITY FEED
-- ============================================
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activities_created ON public.activities(created_at DESC);

-- ============================================
-- AUTO-GENERATE INVOICE NUMBER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  seq_num TEXT;
BEGIN
  year_prefix := to_char(NOW(), 'YYYY"-"MM');
  seq_num := lpad(nextval('invoice_seq')::TEXT, 4, '0');
  NEW.invoice_number := 'INV-' || year_prefix || '-' || seq_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- ============================================
-- AUTO-UPDATE INVOICE STATUS ON PAYMENT
-- ============================================
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total DECIMAL(12,2);
  v_paid DECIMAL(12,2);
BEGIN
  SELECT total, paid_amount INTO v_total, v_paid
  FROM public.invoices WHERE id = NEW.invoice_id;

  v_paid := v_paid + NEW.amount;

  UPDATE public.invoices SET
    paid_amount = v_paid,
    remaining_amount = v_total - v_paid,
    status = CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caisse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Boss sees everything, others see what they need
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

-- ============================================
-- CAISSE BALANCE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION get_client_caisse_balance(p_client_id UUID)
RETURNS TABLE(
  caisse_type_id UUID,
  caisse_name TEXT,
  category TEXT,
  total_out BIGINT,
  total_returned BIGINT,
  total_lost BIGINT,
  total_damaged BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
  first_return_id UUID;
  first_return_quantity BIGINT;
BEGIN
  -- Find the first return record for this client (earliest created_at)
  SELECT cm.id, cm.quantity INTO first_return_id, first_return_quantity
  FROM caisse_movements cm
  WHERE cm.client_id = p_client_id AND cm.movement_type = 'return'
  ORDER BY cm.created_at ASC
  LIMIT 1;

  RETURN QUERY
  SELECT
    ct.id,
    ct.name,
    ct.category::TEXT,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'out' THEN cm.quantity ELSE 0 END), 0)::BIGINT,
    -- Subtract first return quantity from the total returned for its caisse_type
    (COALESCE(SUM(CASE WHEN cm.movement_type = 'return' THEN cm.quantity ELSE 0 END), 0)
     - CASE WHEN first_return_id IS NOT NULL AND ct.id = (
         SELECT cm2.caisse_type_id FROM caisse_movements cm2 WHERE cm2.id = first_return_id
       ) THEN first_return_quantity ELSE 0 END
    )::BIGINT,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'lost' THEN cm.quantity ELSE 0 END), 0)::BIGINT,
    COALESCE(SUM(CASE WHEN cm.movement_type = 'damaged' THEN cm.quantity ELSE 0 END), 0)::BIGINT
  FROM caisse_types ct
  LEFT JOIN caisse_movements cm ON cm.caisse_type_id = ct.id AND cm.client_id = p_client_id
  WHERE ct.category != 'client'
  GROUP BY ct.id, ct.name, ct.category
  HAVING COALESCE(SUM(CASE WHEN cm.movement_type = 'out' THEN cm.quantity ELSE 0 END), 0) > 0
      OR COALESCE(SUM(CASE WHEN cm.movement_type = 'return' THEN cm.quantity ELSE 0 END), 0) > 0;
END;
$$;

-- Migration: add cost_price to trucks
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add warehouse_id to stock
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL;
DROP INDEX IF EXISTS idx_stock_product;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_product_warehouse ON public.stock(product_id, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'));

-- Stock must not be negative
ALTER TABLE public.stock ADD CONSTRAINT ck_stock_quantity_non_negative CHECK (quantity >= 0);

-- Migration: add truck_id to stock
ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL;

-- ============================================
-- ALERTS: notification triggers for deliveries
-- ============================================
CREATE OR REPLACE FUNCTION notify_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_collector_ids UUID[];
  v_manager_ids UUID[];
  v_title TEXT;
  v_message TEXT;
  v_client_name TEXT;
BEGIN
  -- Only trigger when status changes TO 'delivered'
  IF NEW.status = 'delivred' AND (OLD.status IS NULL OR OLD.status != 'delivred') THEN
    -- Get client name
    SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
    
    -- Get collectors
    SELECT ARRAY_AGG(id) INTO v_collector_ids
    FROM public.profiles
    WHERE role = 'collector' AND status = 'active';
    
    -- Get all managers/bosses
    SELECT ARRAY_AGG(id) INTO v_manager_ids
    FROM public.profiles
    WHERE role IN ('boss', 'manager') AND status = 'active';
    
    v_title := 'New Delivery Completed';
    v_message := 'Delivery for ' || COALESCE(v_client_name, 'client') || ' has been marked as delivered.';
    
    -- Notify collectors
    IF v_collector_ids IS NOT NULL AND array_length(v_collector_ids, 1) > 0 THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      SELECT id, v_title, v_message, 'delivery', 'daily_arrival', NEW.id
      FROM public.profiles
      WHERE id = ANY(v_collector_ids);
    END IF;
    
    -- Notify managers
    IF v_manager_ids IS NOT NULL AND array_length(v_manager_ids, 1) > 0 THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      SELECT id, v_title, v_message, 'delivery', 'daily_arrival', NEW.id
      FROM public.profiles
      WHERE id = ANY(v_manager_ids);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_delivery ON public.daily_arrivals;
CREATE TRIGGER trg_notify_on_delivery
  AFTER UPDATE ON public.daily_arrivals
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_delivery();

-- ============================================
-- TRUCK EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS public.truck_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  label TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_truck_expenses_truck_date ON public.truck_expenses(truck_id, arrival_date);

-- ============================================
-- GROUPED INVOICES (multiple invoices grouped into one)
-- ============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS grouped_from JSONB DEFAULT NULL;
-- grouped_from stores: [{ invoice_id, invoice_number, remaining_amount }]

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

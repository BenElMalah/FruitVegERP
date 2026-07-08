-- Clean fix: drop and recreate everything needed

-- Drop triggers first (before dropping their tables)
DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_notify_on_delivery ON public.daily_arrivals;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP TABLE IF EXISTS public.daily_arrivals CASCADE;
DROP TABLE IF EXISTS public.caisse_movements CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.trucks CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;

DROP TYPE IF EXISTS movement_type CASCADE;
DROP TYPE IF EXISTS invoice_status CASCADE;

CREATE TYPE movement_type AS ENUM ('out', 'return', 'lost', 'damaged');
CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.daily_arrivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  caisse_type_id UUID REFERENCES public.caisse_types(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'en demand',
  caisse_details JSONB DEFAULT '[]'::jsonb
);

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
CREATE INDEX idx_daily_arrivals_date ON public.daily_arrivals(arrival_date);

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

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  caisse_type_id UUID REFERENCES public.caisse_types(id) ON DELETE SET NULL,
  caisse_count INTEGER NOT NULL DEFAULT 0,
  total_weight DECIMAL(12,2),
  net_weight DECIMAL(12,2),
  caisses JSONB DEFAULT '[]'::jsonb
);

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

CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT pg_notify('pgrst', 'reload schema');

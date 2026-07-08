-- Recreate caisse_movements table and movement_type enum
-- (dropped during database reset)

CREATE TYPE movement_type AS ENUM ('out', 'return', 'lost', 'damaged');

CREATE TABLE IF NOT EXISTS public.caisse_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  caisse_type_id UUID NOT NULL REFERENCES public.caisse_types(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  movement_type movement_type NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caisse_movements_client ON public.caisse_movements(client_id);
CREATE INDEX IF NOT EXISTS idx_caisse_movements_type ON public.caisse_movements(movement_type);

-- Also recreate invoices table (needed by caisse route references)
CREATE TYPE invoice_status AS ENUM ('unpaid', 'partial', 'paid', 'overdue');

CREATE TABLE IF NOT EXISTS public.invoices (
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

CREATE TABLE IF NOT EXISTS public.invoice_items (
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

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trucks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  default_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_weight DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_arrivals (
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

CREATE TABLE IF NOT EXISTS public.notifications (
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

CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Re-create RLS policies for new tables
ALTER TABLE public.caisse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Refresh PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');

-- Add LCN payment method
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'lcn';

-- Add LCN date column
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS lcn_date DATE;

SELECT pg_notify('pgrst', 'reload schema');

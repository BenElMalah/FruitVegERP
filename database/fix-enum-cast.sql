-- Fix: cast text to invoice_status enum in the trigger function
-- PostgreSQL 14+ removed implicit text→enum casting

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
      WHEN v_paid >= v_total THEN 'paid'::invoice_status
      WHEN v_paid > 0 THEN 'partial'::invoice_status
      ELSE 'unpaid'::invoice_status
    END,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

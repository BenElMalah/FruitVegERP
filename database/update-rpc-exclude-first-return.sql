-- Updated RPC: excludes the first return record per client from total_returned
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

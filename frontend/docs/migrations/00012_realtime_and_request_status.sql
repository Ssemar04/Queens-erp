-- Migration: Enable realtime publication and align request statuses with the app

ALTER TABLE public.inventory_requests
  DROP CONSTRAINT IF EXISTS inventory_requests_status_check;

ALTER TABLE public.inventory_requests
  ADD CONSTRAINT inventory_requests_status_check
  CHECK (status IN ('pending', 'approved', 'partially_fulfilled', 'fulfilled', 'declined', 'cancelled'));

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'categories',
    'suppliers',
    'locations',
    'items',
    'stock_movements',
    'purchase_orders',
    'purchase_order_items',
    'inventory_requests',
    'request_items',
    'custom_field_definitions',
    'notifications'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
      WHEN undefined_object THEN
        NULL;
    END;
  END LOOP;
END $$;

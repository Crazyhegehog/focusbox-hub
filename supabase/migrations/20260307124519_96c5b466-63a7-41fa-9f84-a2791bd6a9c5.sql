-- Add address and phone fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_country TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_state TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT DEFAULT '';
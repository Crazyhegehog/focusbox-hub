-- Add Stripe-related columns to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'eur',
  ADD COLUMN IF NOT EXISTS stripe_product_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add order_items table for line items from Stripe
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order items viewable by authenticated" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Order items manageable by authenticated" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Orders insertable by anon for webhook" ON public.orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Order items insertable by anon for webhook" ON public.order_items FOR INSERT TO anon WITH CHECK (true);
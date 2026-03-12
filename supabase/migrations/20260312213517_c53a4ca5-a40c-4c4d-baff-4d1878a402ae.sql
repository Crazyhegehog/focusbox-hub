
CREATE TABLE public.partner_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  partner_type TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner types viewable by authenticated" ON public.partner_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner types insertable by authenticated" ON public.partner_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Partner types deletable by authenticated" ON public.partner_types FOR DELETE TO authenticated USING (true);

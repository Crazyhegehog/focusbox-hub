
CREATE TABLE public.partner_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner notes viewable by authenticated" ON public.partner_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner notes insertable by authenticated" ON public.partner_notes FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Partner notes deletable by author" ON public.partner_notes FOR DELETE TO authenticated USING (created_by = auth.uid());

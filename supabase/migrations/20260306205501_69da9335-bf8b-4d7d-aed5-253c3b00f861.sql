
-- New enums
CREATE TYPE public.order_status AS ENUM ('pending', 'packaged', 'sent');
CREATE TYPE public.partner_status AS ENUM ('discussion', 'no_answer', 'sent_contract', 'signed');
CREATE TYPE public.todo_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT '',
  phone_size TEXT NOT NULL DEFAULT '',
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orders viewable by authenticated" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Orders manageable by authenticated" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status partner_status NOT NULL DEFAULT 'discussion',
  last_post_date DATE,
  signed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners viewable by authenticated" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partners manageable by authenticated" ON public.partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates viewable by authenticated" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Templates manageable by authenticated" ON public.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Todos table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status todo_status NOT NULL DEFAULT 'not_started',
  responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date DATE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos viewable by authenticated" ON public.todos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Todos insertable by authenticated" ON public.todos FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Todos updatable by authenticated" ON public.todos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Todos deletable by creator" ON public.todos FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Todo participants table
CREATE TABLE public.todo_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ,
  UNIQUE(todo_id, user_id)
);
ALTER TABLE public.todo_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants viewable by authenticated" ON public.todo_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Participants manageable by authenticated" ON public.todo_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

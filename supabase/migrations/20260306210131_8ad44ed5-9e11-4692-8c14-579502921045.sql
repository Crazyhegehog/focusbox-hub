
CREATE TABLE public.todo_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.todo_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todo subtasks viewable by authenticated" ON public.todo_subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Todo subtasks manageable by authenticated" ON public.todo_subtasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

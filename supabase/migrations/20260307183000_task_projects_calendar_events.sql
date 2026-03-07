CREATE TYPE public.calendar_event_type AS ENUM ('meeting', 'deadline', 'reminder', 'personal', 'other');

CREATE TABLE public.todo_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT NOT NULL DEFAULT '#1f6feb',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todo_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todo projects viewable by authenticated"
ON public.todo_projects
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Todo projects insertable by authenticated"
ON public.todo_projects
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Todo projects updatable by authenticated"
ON public.todo_projects
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Todo projects deletable by creator"
ON public.todo_projects
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

CREATE TRIGGER update_todo_projects_updated_at
BEFORE UPDATE ON public.todo_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.todos
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.todo_projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE public.todo_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todo_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todo notes viewable by authenticated"
ON public.todo_notes
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Todo notes insertable by authenticated"
ON public.todo_notes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Todo notes deletable by author"
ON public.todo_notes
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  type public.calendar_event_type NOT NULL DEFAULT 'other',
  related_todo_id UUID REFERENCES public.todos(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calendar events viewable by authenticated"
ON public.calendar_events
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Calendar events insertable by authenticated"
ON public.calendar_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Calendar events updatable by authenticated"
ON public.calendar_events
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Calendar events deletable by creator"
ON public.calendar_events
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

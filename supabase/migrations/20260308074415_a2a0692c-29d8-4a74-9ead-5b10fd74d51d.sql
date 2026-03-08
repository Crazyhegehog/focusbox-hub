-- Add missing columns
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';
ALTER TABLE public.todo_projects ADD COLUMN IF NOT EXISTS color text DEFAULT '#64748b';

-- Create todo_notes table
CREATE TABLE public.todo_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.todo_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes viewable by authenticated"
ON public.todo_notes FOR SELECT USING (true);

CREATE POLICY "Notes insertable by authenticated"
ON public.todo_notes FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Notes deletable by author"
ON public.todo_notes FOR DELETE USING (created_by = auth.uid());
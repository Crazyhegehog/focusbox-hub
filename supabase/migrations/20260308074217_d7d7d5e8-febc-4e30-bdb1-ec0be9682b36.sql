-- Create calendar_event_type enum first
CREATE TYPE public.calendar_event_type AS ENUM ('meeting', 'deadline', 'reminder', 'personal', 'other');

-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  type public.calendar_event_type NOT NULL DEFAULT 'other',
  related_todo_id UUID,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create todo_projects table
CREATE TABLE public.todo_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update todos table to add start_date and project_id
ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.todo_projects(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
CREATE POLICY "Users can view their own calendar events"
ON public.calendar_events
FOR SELECT
USING (created_by = auth.uid());

CREATE POLICY "Users can create calendar events"
ON public.calendar_events
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own calendar events"
ON public.calendar_events
FOR DELETE
USING (created_by = auth.uid());

-- RLS Policies for todo_projects
CREATE POLICY "Anyone can view projects"
ON public.todo_projects
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create projects"
ON public.todo_projects
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_todo_projects_updated_at
BEFORE UPDATE ON public.todo_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.todos ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE public.todos ALTER COLUMN priority TYPE public.task_priority USING priority::public.task_priority;
ALTER TABLE public.todos ALTER COLUMN priority SET DEFAULT 'medium'::public.task_priority;
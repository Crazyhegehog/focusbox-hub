-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'member');

-- Create task priority enum
CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low');

-- Create task status enum
CREATE TYPE public.task_status AS ENUM ('not_started', 'in_progress', 'completed');

-- Create fulfillment status enum
CREATE TYPE public.fulfillment_status AS ENUM ('not_started', 'preparing', 'shipped', 'delivered');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT 'Member',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles viewable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign member role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'not_started',
  due_date DATE,
  assignee_id UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks viewable by authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tasks insertable by authenticated" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Tasks updatable by authenticated" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Tasks deletable by creator or admin" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Task subtasks
CREATE TABLE public.task_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subtasks viewable by authenticated" ON public.task_subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Subtasks manageable by authenticated" ON public.task_subtasks FOR ALL TO authenticated USING (true);

-- Task comments
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by authenticated" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comments insertable by authenticated" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments deletable by author" ON public.task_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Inventory items
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  current_stock INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 10,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  storage_location TEXT DEFAULT '',
  supplier_name TEXT DEFAULT '',
  supplier_contact TEXT DEFAULT '',
  supplier_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory viewable by authenticated" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inventory manageable by authenticated" ON public.inventory_items FOR ALL TO authenticated USING (true);
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product bundles
CREATE TABLE public.product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bundles viewable by authenticated" ON public.product_bundles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bundles manageable by authenticated" ON public.product_bundles FOR ALL TO authenticated USING (true);

-- Bundle components
CREATE TABLE public.bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE(bundle_id, inventory_item_id)
);
ALTER TABLE public.bundle_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bundle components viewable by authenticated" ON public.bundle_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Bundle components manageable by authenticated" ON public.bundle_components FOR ALL TO authenticated USING (true);

-- Inventory history log
CREATE TABLE public.inventory_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "History viewable by authenticated" ON public.inventory_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "History insertable by authenticated" ON public.inventory_history FOR INSERT TO authenticated WITH CHECK (true);

-- Milestones
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL,
  color TEXT DEFAULT '#1a1a1a',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones viewable by authenticated" ON public.milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Milestones manageable by authenticated" ON public.milestones FOR ALL TO authenticated USING (true);

-- Activity log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity viewable by authenticated" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activity insertable by authenticated" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
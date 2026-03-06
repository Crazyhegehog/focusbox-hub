

# LockIn Team Productivity Dashboard

## Brand & Design
- **Color palette**: Black (#1a1a1a), Charcoal (#4a4a4a), Beige (#e8e8e0), green accents for success states
- **Layout**: Collapsible sidebar navigation + main content area
- **Icons**: Lucide React throughout
- **Dark mode**: Supported via theme toggle

## Pages & Navigation (Sidebar)
1. **Dashboard** (home) — KPI cards + 3-column overview
2. **Tasks** — Full task management
3. **Calendar** — Month/week/day views
4. **Inventory** — Stock tracking & bundles
5. **Orders** — Stripe order fulfillment
6. **Team** — Member profiles & activity
7. **Settings** — App preferences

## Authentication & Roles (Supabase)
- Login/signup page with email & password
- User profiles table (name, role title like CEO/Operations/Sales, avatar)
- Role-based permissions table (admin, manager, member) controlling what each user can access
- Protected routes — redirect to login if not authenticated

## Feature 1: Dashboard Home
- KPI cards: pending orders, tasks due today, low-stock items, active team members
- 3-column layout: deadlines & alerts | today's tasks + quick-add | recent orders
- Monthly revenue trend chart, tasks completed stats
- Global search bar across tasks, inventory, and orders

## Feature 2: Task Management
- CRUD tasks with title, description, priority (High/Medium/Low), due date, assignee
- Status workflow: Not Started → In Progress → Completed
- Color-coded due dates (red=overdue, yellow=today, blue=upcoming)
- Subtask checklists within each task
- Comments on tasks for collaboration
- Filter/sort by assignee, priority, date, status
- Floating quick-add button
- Bulk actions (mark complete, delete)

## Feature 3: Calendar
- Month, week, and day views
- Shows task due dates, milestones, and order deadlines
- Color-coded by type/assignee
- Click to create events, click existing to edit
- Upcoming 7-day sidebar on dashboard

## Feature 4: Inventory System
- Inventory table: product name, stock qty, reorder threshold, unit cost, storage location, supplier info, last updated
- Quick +/- stock adjustment buttons
- **Product bundles**: Define FocusBox Standard and Premium with component lists (filament qty, packaging, circuit boards, etc.)
- Low-stock alerts when below reorder threshold
- Stock history log with timestamps and reasons
- Supplier contact details and order links

## Feature 5: Stripe Orders & Fulfillment
- Connect Stripe to pull live order data
- Order list: ID, customer, product, date, amount, payment status, fulfillment status
- Fulfillment workflow: Not Started → Preparing → Shipped (with tracking number) → Delivered
- **Auto inventory deduction**: When marked "shipped," system deducts components based on the product's bundle definition
- Filter by status, date, customer, product
- Revenue stats: monthly sales, average order value, top products

## Feature 6: Team Management
- Team member profiles with name, role, email
- Activity log showing recent actions across the app
- Permission enforcement based on admin/manager/member roles

## Feature 7: Additional Features
- Toast notifications for key events (new order, low stock, task created)
- CSV export for inventory, tasks, and orders
- Notes/attachments on tasks and orders
- Responsive design for tablet and mobile

## Database (Supabase)
Tables: profiles, user_roles, tasks, task_comments, task_subtasks, inventory_items, product_bundles, bundle_components, inventory_history, orders (synced from Stripe), milestones, activity_log

## Implementation Order
1. Supabase setup + auth + brand theming + sidebar layout
2. Task management (CRUD, filters, subtasks, comments)
3. Inventory system (items, bundles, stock adjustments, alerts)
4. Calendar views with task/milestone integration
5. Stripe integration + order fulfillment + auto inventory deduction
6. Dashboard home with KPIs and overview widgets
7. Team management + activity log + permissions
8. Polish: search, exports, notifications, responsive tweaks


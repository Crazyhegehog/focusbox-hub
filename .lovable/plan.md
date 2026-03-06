

# Restructured Sidebar: 3 Sections

## New Sidebar Structure

```text
SIDEBAR
├── 1. Packages / Inventory
│   ├── Orders Overview (default page)
│   │   - Total orders count, orders still to ship
│   │   - Table: each order with phone size
│   │   - Summary: total required per phone size
│   │   - Mark as "Packaged" / "Sent" buttons
│   └── Inventory Tracking (design-only)
│       - Shows per-box components needed (Karton, Base, NFC, Paper)
│       - Auto-calculated from packaged orders
│       - Static UI mockup, no backend wiring
│
├── 2. Partners
│   ├── Partner List (default page)
│   │   - Add partner by email
│   │   - Status pipeline: Discussion → No Answer → Sent Contract → Signed
│   │   - Last post date + day counter (days since last post, fallback to sign date)
│   ├── Email Templates
│   │   - Pre-written email templates (editable)
│   ├── Partner Brief
│   │   - Static page with partner brieflet content
│   └── Partner Contract
│       - Static page with contract content
│
├── 3. Team
│   ├── Todos (default page)
│   │   - All todos with status, responsible person, participating persons
│   │   - "Accept" action per todo (person acknowledges they've seen it)
│   └── Calendar
│       - Existing calendar page moved here
│
└── Footer: User profile + logout
```

## Database Changes (Migration)

**New tables:**
- `orders` — id, customer_name, phone_size (enum or text), status (enum: pending, packaged, sent), created_at, updated_at
- `partners` — id, email, name, status (enum: discussion, no_answer, sent_contract, signed), last_post_date, created_at, created_by
- `email_templates` — id, title, body, created_at, updated_at
- `todos` — id, title, description, status (enum: not_started, in_progress, completed), responsible_id (uuid), due_date, created_by, created_at, updated_at
- `todo_participants` — id, todo_id, user_id, accepted (boolean), accepted_at

**New enums:**
- `order_status`: 'pending', 'packaged', 'sent'
- `partner_status`: 'discussion', 'no_answer', 'sent_contract', 'signed'

RLS: All tables authenticated read/write (same pattern as existing tables).

## Pages to Create

1. **`/orders`** — Orders overview with phone size breakdown, mark packaged/sent
2. **`/inventory-tracking`** — Design-only inventory tracking (components per box)
3. **`/partners`** — Partner list with status pipeline and day counter
4. **`/email-templates`** — CRUD email templates
5. **`/partner-brief`** — Static brieflet content page
6. **`/partner-contract`** — Static contract content page
7. **`/todos`** — Enhanced todos with responsible, participants, accept
8. **`/calendar`** — Keep existing calendar (moved under Team section)

## Sidebar Changes

Replace current flat nav with 3 collapsible `SidebarGroup` sections, each with sub-items. Remove Dashboard, Settings, and old Tasks/Inventory/Orders/Team pages. Keep user footer.

## Implementation Summary

- 1 migration with 5 new tables + 2 enums
- 8 page components (2 are static/design-only)
- Updated sidebar with 3 grouped sections
- Updated App.tsx routes
- Remove unused old pages (Index, SettingsPage, old Tasks, old Orders, old Inventory, old Team)


# Responsive Layouts — VividCRM

## Layout Architecture

VividCRM uses a three-tier layout system that adapts across the three target viewports.

```
Mobile (< 768px)          Tablet (768px–1023px)       Desktop (≥ 1024px)
─────────────────         ─────────────────────        ─────────────────────
Top Header bar            Top Header bar               Fixed left Sidebar
  [Menu] [Logo] [User]      [Logo] [Search] [User]       + Top bar (breadcrumb)
──────────────────        ──────────────────────       ──────────────────────
Page content              Collapsed Sidebar + content  Expanded sidebar
  (full width)              (icon rail or overlay)       + content area
──────────────────        ──────────────────────       ──────────────────────
Bottom Navigation bar     —                            —
  (fixed, 5 tabs)
```

---

## Root Layout Shell

### Next.js Root Layout Structure

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, mono.variable, 'min-h-screen bg-background font-sans antialiased')}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

// app/(app)/layout.tsx — authenticated shell
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — visible mobile only */}
        <MobileHeader className="md:hidden" />

        {/* Desktop top bar — breadcrumb + actions */}
        <DesktopHeader className="hidden md:flex" />

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-4 md:px-6 md:py-6 lg:px-8 max-w-screen-2xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation — visible mobile only */}
      <MobileBottomNav className="md:hidden" />
    </div>
  )
}
```

---

## Page Layout Patterns

### Pattern 1 — List + Detail (Split View)

Used by: Leads, Deals, Contacts, Companies, Employees, Leave Applications

```
Mobile                    Tablet                      Desktop
──────────────────        ──────────────────────      ────────────────────────────────
[Search]                  [Search]    [Filter] [Add]  [Search]        [Filter] [Add]
[Filter] [Add]            ─────────────────────────   ────────────────────────────────
──────────────────        [Lead Card]  [Lead Detail]  [Lead List Table][Lead Detail Panel]
[Lead Card 1]             [Lead Card]  [Selected →]   [Row 1]          [Name: Rahul M.]
[Lead Card 2]             [Lead Card]  Full detail    [Row 2]  ►       [Email: ...]
[Lead Card 3]             [Lead Card]  side panel     [Row 3]          [Status: Active]
[Lead Card n...]          [Lead Card]                 [Row n...]       [Activities...]
──────────────────        ──────────────────────      ────────────────────────────────
```

**Implementation:**

```tsx
// Responsive split view
export function LeadsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="flex h-full gap-0 lg:gap-6">
      {/* List panel — full width mobile, 40% lg */}
      <div className={cn(
        'flex flex-col w-full lg:w-[400px] xl:w-[480px] flex-shrink-0',
        selectedId && 'hidden lg:flex'  // hide list when detail open on mobile
      )}>
        <LeadListToolbar />
        <LeadList onSelect={setSelectedId} selectedId={selectedId} />
      </div>

      {/* Detail panel — hidden until selection, full width mobile, flex-1 lg */}
      {selectedId && (
        <div className="flex flex-col flex-1 min-w-0">
          <LeadDetail id={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}

      {/* Empty state when nothing selected (desktop only) */}
      {!selectedId && (
        <div className="hidden lg:flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Select a lead to view details</p>
        </div>
      )}
    </div>
  )
}
```

---

### Pattern 2 — Full-Page Table

Used by: Invoices, Payroll Runs, Payslips, Mailing list, Regularisations

```
Mobile                    Tablet                      Desktop
──────────────────        ─────────────────────       ────────────────────────────────
[Search + Filter]         [Search] [Filter] [Export]  [Search] [Filter(s)] [Export] [+]
──────────────────        ─────────────────────       ────────────────────────────────
Card view:                Full table with columns:    Full table — more columns visible:
┌──────────────────┐      ┌──────┬──────┬──────────┐  ┌──────┬────┬────┬─────┬──────┐
│ INV-2025-0042    │      │ Num  │ Date │ Client   │  │ Num  │Date│Clt │Amnt │ Sts  │
│ StartupXYZ       │      ├──────┼──────┼──────────┤  ├──────┼────┼────┼─────┼──────┤
│ ₹1,18,000        │      │...   │...   │...       │  │...   │... │... │...  │...   │
│ [SENT] Due Jul 30│      └──────┴──────┴──────────┘  └──────┴────┴────┴─────┴──────┘
└──────────────────┘
```

**Mobile card layout for tables:**

```tsx
// Switch between card (mobile) and table (md+) views
export function InvoiceList({ invoices }) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {invoices.map(inv => (
          <InvoiceCard key={inv.id} invoice={inv} />
        ))}
      </div>

      {/* Tablet+: data table */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <Table>
          <InvoiceTableHeader />
          <TableBody>
            {invoices.map(inv => (
              <InvoiceTableRow key={inv.id} invoice={inv} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
```

---

### Pattern 3 — Kanban Board

Used by: Task boards

```
Mobile                    Tablet                      Desktop
──────────────────        ─────────────────────       ────────────────────────────────
Horizontal scroll →       Horizontal scroll →         All columns visible or scroll
[To Do] [In Prog] [Done]  [To Do]  [In Prog] [Done]  [To Do][In Prog][Review][Done]
  ↕card   ↕card   ↕card     ↕card    ↕card    ↕card    ↕card  ↕card   ↕card  ↕card
```

```tsx
export function KanbanBoard({ columns }: { columns: BoardColumn[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:mx-0 lg:px-0 snap-x snap-mandatory">
      {columns.map(col => (
        <div
          key={col.id}
          className="flex-shrink-0 w-[280px] sm:w-[300px] snap-start flex flex-col gap-2"
        >
          <KanbanColumnHeader column={col} />
          <div className="space-y-2 min-h-[200px]">
            {col.tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          <AddTaskButton columnId={col.id} />
        </div>
      ))}
    </div>
  )
}
```

---

### Pattern 4 — Form Page (Create / Edit)

Used by: Create Lead, Create Invoice, Edit Employee, Create Project

```
Mobile                    Tablet                      Desktop
──────────────────        ──────────────────────      ────────────────────────────────
[← Back] New Lead         [← Leads] / New Lead        [Breadcrumb: CRM / Leads / New]
──────────────────        ──────────────────────      ────────────────────────────────
Single column form:       Single column, wider:       Two-column form + sticky sidebar:
[Title]                   [Title field]               [Title]           | Summary card
[First Name]              [First Name] [Last Name]    [First Name]      | ─────────
[Last Name]               [Email] [Phone]             [Last Name]       | Value: 0
[Email]                   [Company] [Job Title]       [Email]   [Phone] | Status: New
[Phone]                   [Team]    [Assigned To]     [Company][JobTitle]| ─────────
[Company]                 [Notes]                     [Notes]           | [Save]
[Notes]                   ──────────────────────      ──────────────────| [Discard]
──────────────────                                    ────────────────────────────────
[Cancel] [Save Lead]      [Cancel]         [Save]
(full-width buttons)      (right-aligned)
```

```tsx
export function CreateLeadPage() {
  return (
    <div className="max-w-screen-lg mx-auto">
      <PageHeader title="New Lead" backHref="/leads" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Information</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadForm />
            </CardContent>
          </Card>
        </div>

        {/* Sticky sidebar — hidden on mobile, shown lg+ */}
        <div className="hidden lg:block space-y-4">
          <div className="sticky top-6 space-y-4">
            <LeadSummaryCard />
            <FormActions />
          </div>
        </div>
      </div>

      {/* Mobile sticky footer actions */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur p-4 flex gap-3">
        <Button variant="outline" className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1">Save Lead</Button>
      </div>
    </div>
  )
}
```

---

### Pattern 5 — Dashboard / Overview

Used by: Module dashboards, home dashboard

```
Mobile                    Tablet                      Desktop
──────────────────        ──────────────────────      ────────────────────────────────
[KPI Card]                [KPI][KPI][KPI][KPI]        [KPI] [KPI] [KPI] [KPI]
[KPI Card]                ──────────────────────      ────────────────────────────────
[KPI Card]                [Chart — full width]        [Revenue Chart] [Pipeline Chart]
[KPI Card]                ──────────────────────      ────────────────────────────────
──────────────────        [Activity] [Quick Tasks]    [Activity Feed] [Open Tasks] [...]
[Revenue Chart]           ──────────────────────      ────────────────────────────────
──────────────────
[Activity Feed]
[Quick tasks]
```

```tsx
export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* KPI row — 2 cols mobile, 4 cols tablet+ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Open Leads" value={42} delta="+8%" trend="up" />
        <StatCard label="Pipeline Value" value="₹24L" delta="+12%" trend="up" />
        <StatCard label="Open Tasks" value={17} delta="-3" trend="down" />
        <StatCard label="Invoices Due" value={5} delta="" />
      </div>

      {/* Charts row — stack on mobile, side by side lg+ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueChart />
        <PipelineChart />
      </div>

      {/* Activity and tasks — stack on mobile, 3-col xl+ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RecentActivityFeed className="md:col-span-2 xl:col-span-1" />
        <MyOpenTasks />
        <UpcomingEvents />
      </div>
    </div>
  )
}
```

---

### Pattern 6 — Detail Page (Record View)

Used by: Lead detail, Employee profile, Project detail, Invoice detail

```
Mobile                    Tablet                      Desktop
──────────────────        ──────────────────────      ────────────────────────────────
[← Back]                  [Breadcrumb]                [Breadcrumb]
[Name + Status]           [Name + Status]             [Name + Status]     [Actions]
[Edit] [More ▾]           [Edit] [Convert] [Delete]   [Edit][Convert][Delete]
──────────────────        ──────────────────────      ────────────────────────────────
Tabs:                     [Details][Activity][Docs]   Two-column layout:
[Details|Activity|Docs]   ──────────────────────      [Details (60%)] [Sidebar (40%)]
                          Tab content                  Activity feed
Tab content               ──────────────────────      Documents
                                                       Related deals
```

```tsx
export function LeadDetailPage({ lead }) {
  return (
    <div>
      {/* Header — always visible */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold lg:text-2xl">{lead.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <span className="text-xs text-muted-foreground">{lead.source}</span>
          </div>
        </div>
        <LeadActions lead={lead} />
      </div>

      {/* Mobile + tablet: Tabs */}
      <div className="lg:hidden">
        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">Docs</TabsTrigger>
          </TabsList>
          <TabsContent value="details"><LeadDetailsPanel lead={lead} /></TabsContent>
          <TabsContent value="activity"><ActivityFeed leadId={lead.id} /></TabsContent>
          <TabsContent value="documents"><DocumentList leadId={lead.id} /></TabsContent>
        </Tabs>
      </div>

      {/* Desktop: two-column */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
        <div className="space-y-4">
          <LeadDetailsPanel lead={lead} />
          <ActivityFeed leadId={lead.id} />
        </div>
        <div className="space-y-4">
          <LeadConversionCard lead={lead} />
          <DocumentList leadId={lead.id} />
        </div>
      </div>
    </div>
  )
}
```

---

## Grid System Reference

| Use Case | Mobile | Tablet `md:` | Desktop `lg:` | Wide `xl:` |
|---|---|---|---|---|
| KPI cards | `grid-cols-2` | `grid-cols-4` | `grid-cols-4` | `grid-cols-4` |
| Form layout | `grid-cols-1` | `grid-cols-1` | `grid-cols-2` | `grid-cols-2` |
| Dashboard charts | `grid-cols-1` | `grid-cols-1` | `grid-cols-2` | `grid-cols-2` |
| Detail page | `grid-cols-1` | `grid-cols-1` | `grid-cols-[1fr_380px]` | `grid-cols-[1fr_420px]` |
| Settings page | `grid-cols-1` | `grid-cols-[220px_1fr]` | `grid-cols-[260px_1fr]` | `grid-cols-[280px_1fr]` |
| CRM list+detail | `grid-cols-1` | `grid-cols-1` | `grid-cols-[400px_1fr]` | `grid-cols-[480px_1fr]` |
| Employee roster | `grid-cols-1` | `grid-cols-2` | `grid-cols-3` | `grid-cols-4` |

---

## Container Widths

```tsx
// Page container — use consistently across all pages
<div className="mx-auto w-full px-4 md:px-6 lg:px-8 max-w-screen-2xl">
  {children}
</div>

// Narrow form pages (create/edit forms)
<div className="mx-auto w-full max-w-screen-lg px-4 md:px-6">

// Ultra-wide content (kanban, calendar)
<div className="mx-auto w-full px-4 md:px-6 lg:px-8">  {/* No max-width */}
```

---

## Module-Specific Layout Specifications

### CRM — Pipeline Board View (Alternative to List)

```
Mobile: Vertical swipeable cards by status
Tablet: 2-column (Qualification + Proposal visible)
Desktop: 4–5 columns (all pipeline stages)

Column min-width: 280px
Column max-width: 340px
Gap between columns: 16px (gap-4)
Board padding: 24px (p-6)
```

### HRMS Attendance Grid

```
Mobile: Weekly view (7 days) — horizontal scroll
Tablet: Monthly grid, 7 columns — date headers abbreviated
Desktop: Full monthly grid with status counts per row

Cell size:
  Mobile:  40×40px
  Tablet:  48×48px
  Desktop: 56×56px
```

### Invoice Composer

```
Mobile: Stacked — header → line items → totals → notes
Tablet: Stacked — wider fields, 2-col for unit/price
Desktop: Left panel (line items, 70%) + Right panel (GST summary, totals, send — 30%)
```

### Task Board + Detail Side Panel

```
Mobile: Board only; task detail opens as bottom sheet (90vh)
Tablet: Board; task detail opens as right sheet (480px wide)
Desktop: Board (flex-1) + Task detail panel (480px, fixed right)
```

---

## Overflow and Scroll Patterns

### Horizontal Scroll (Tables, Boards)

```html
<!-- Tables that must show all columns on tablet -->
<div class="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
  <div class="min-w-[640px]">  <!-- minimum width to prevent column collapse -->
    <Table>...</Table>
  </div>
</div>
```

### Vertical Scroll (Long pages)

```html
<!-- Main content area scrolls, header and sidebar are fixed -->
<main class="flex-1 overflow-y-auto">
  <!-- Content -->
</main>
```

### Card Carousel (Mobile horizontal scroll)

```html
<!-- Horizontally scrollable card row — snap scrolling -->
<div class="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:grid md:grid-cols-2 md:overflow-visible md:mx-0 md:px-0">
  <div class="flex-shrink-0 w-[280px] snap-start md:w-auto">
    <StatCard />
  </div>
  ...
</div>
```

---

## Safe Area Insets (iOS Notch / Dynamic Island)

```css
/* globals.css — required for iOS bottom bar clearance */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
.mb-safe {
  margin-bottom: env(safe-area-inset-bottom);
}
```

```html
<!-- Bottom navigation must respect iOS safe area -->
<nav class="fixed bottom-0 left-0 right-0 border-t bg-background
            pb-safe md:hidden">
  ...
</nav>

<!-- Content must not be obscured by bottom nav on mobile -->
<main class="flex-1 overflow-y-auto pb-[64px] md:pb-0">
  <!-- 64px = bottom nav height -->
```

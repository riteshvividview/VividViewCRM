# Dashboard Guidelines — VividCRM

## Dashboard Philosophy

Every role sees a dashboard tailored to their primary responsibilities. The dashboard is not a dumping ground for all available data — it is a **decision surface**: show exactly what the user needs to act on right now, nothing more.

### Dashboard Design Rules

1. **Above the fold first** — the most critical information renders before scrolling on every viewport
2. **Actionable, not decorative** — every widget must answer a specific question or lead to an action
3. **No more than 4 KPI cards** in the top row — cognitive overload starts at 5
4. **Real data, no placeholder zeroes** — empty state widgets must explain why they're empty and what to do
5. **Load fast, update async** — skeleton screens on initial load; background refresh via TanStack Query

---

## Role-Based Dashboards

### SUPER_ADMIN Dashboard

**Primary questions:** Is the workspace healthy? Are there any critical issues?

```
┌──────────────────────────────────────────────────────────────────────┐
│  KPI: [Active Users] [Total Pipeline] [MRR] [Open Tasks]            │
├──────────────────────────────────────────────────────────────────────┤
│  [Monthly Revenue Chart]        │  [Pipeline by Stage]              │
│  (line, 12 months)              │  (horizontal bar)                 │
├──────────────────────────────────────────────────────────────────────┤
│  [Pending Approvals]   [Payroll Status]   [Recent Audit Events]     │
│  Leaves: 5             June run: DRAFT    Last 5 audit entries       │
│  Time entries: 12      Payslips: 0/42     Role changes, exports...  │
└──────────────────────────────────────────────────────────────────────┘
```

### ADMIN Dashboard

**Primary questions:** Where is the pipeline? Who owes us money? Is the team delivering?

```
┌──────────────────────────────────────────────────────────────────────┐
│  KPI: [Open Leads] [Pipeline Value] [Overdue Invoices] [Open Tasks] │
├──────────────────────────────────────────────────────────────────────┤
│  [Revenue This Month vs. Last]  │  [Pipeline Funnel]                │
│  (bar chart + target line)      │  (funnel or horizontal bars)      │
├──────────────────────────────────────────────────────────────────────┤
│  [Overdue Invoices]    │  [My Team's Open Tasks]  │  [Recent Deals] │
│  INV-0038: ₹75,000     │  Arjun: 4 tasks          │  Won: PixelCo   │
│  INV-0041: ₹32,000     │  Priya: 7 tasks          │  Lost: TechCorp │
└──────────────────────────────────────────────────────────────────────┘
```

### HR Dashboard

**Primary questions:** Who's absent today? Are there leaves to approve? Is payroll on track?

```
┌──────────────────────────────────────────────────────────────────────┐
│  KPI: [Present Today %] [On Leave] [Pending Leaves] [Payroll Status]│
├──────────────────────────────────────────────────────────────────────┤
│  [Today's Attendance Overview]  │  [Leave Applications (Pending)]   │
│  Present: 38 | Absent: 4        │  [Approve] [Reject] per row       │
│  On leave: 3 | Holiday: 0       │                                   │
├──────────────────────────────────────────────────────────────────────┤
│  [Upcoming Events]              │  [Recent Joins / Exits]           │
│  Probation: 2 employees         │  New: Arjun Nair (Jul 1)         │
│  Exit: 1 (notice period)        │  Exit: Priya K. (Jun 30)         │
└──────────────────────────────────────────────────────────────────────┘
```

### TEAM_LEAD Dashboard

**Primary questions:** What does my team need to do? Are we on track for the sprint?

```
┌──────────────────────────────────────────────────────────────────────┐
│  KPI: [Sprint Progress] [Blocked Tasks] [Pending Approvals] [Leaves]│
├──────────────────────────────────────────────────────────────────────┤
│  [Active Sprint Board Summary]  │  [Team Workload]                  │
│  Sprint 3 (ends Jul 15)         │  Arjun: 4 open, 2 blocked        │
│  Done: 8/12 tasks  ████████░░   │  Priya: 6 open, 0 blocked        │
├──────────────────────────────────────────────────────────────────────┤
│  [Pending Time Entry Approvals] │  [Pending Leave Approvals]        │
│  Arjun: 3 entries, 24h          │  Priya: EL Jul 10–14             │
└──────────────────────────────────────────────────────────────────────┘
```

### EMPLOYEE Dashboard

**Primary questions:** What tasks do I have today? Am I clocked in? What's my leave balance?

```
┌──────────────────────────────────────────────────────────────────────┐
│  KPI: [Clock Status] [Tasks Due Today] [Leave Balance] [Payslip]    │
├──────────────────────────────────────────────────────────────────────┤
│  [Clock In/Out Widget]          │  [My Tasks (this week)]           │
│  ● Clocked in — 09:02 AM        │  □ Implement login page  Due Fri  │
│  Today: 4h 32m                  │  □ Write unit tests      Due Wed  │
│  [Clock Out]                    │  ✓ API review            Done     │
├──────────────────────────────────────────────────────────────────────┤
│  [Attendance This Week]         │  [Leave Balances]                 │
│  M ✓  T ✓  W ✓  T –  F –       │  Earned: 10 days available        │
│                                 │  Sick: 8 days available           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## KPI Stat Cards

### Anatomy

```
┌──────────────────────────┐
│ Open Leads               │  ← Label: text-sm text-muted-foreground font-medium
│                          │
│  42                      │  ← Value: text-3xl font-bold tabular-nums
│                          │
│  ↑ +8 this week          │  ← Delta: text-xs + trend colour
└──────────────────────────┘
```

### Implementation

```tsx
interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  href?: string
  loading?: boolean
}

export function StatCard({ label, value, delta, trend, icon: Icon, href, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-9 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  const card = (
    <Card className={cn(href && 'cursor-pointer hover:border-primary/50 transition-colors')}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        {delta && (
          <p className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            trend === 'up' && 'text-green-600 dark:text-green-400',
            trend === 'down' && 'text-red-600 dark:text-red-400',
            trend === 'neutral' && 'text-muted-foreground',
          )}>
            {trend === 'up' && <TrendingUp className="h-3 w-3" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3" />}
            {delta}
          </p>
        )}
      </CardContent>
    </Card>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
```

### KPI Row Grid

```html
<!-- Always 2 columns on mobile, 4 on tablet+ -->
<div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
  <StatCard label="Open Leads" value={42} delta="+8 this week" trend="up" href="/leads" />
  <StatCard label="Pipeline" value="₹24L" delta="+₹3L vs last month" trend="up" />
  <StatCard label="Overdue Invoices" value={5} delta="₹1,85,000 total" trend="down" href="/invoices?status=OVERDUE" />
  <StatCard label="Open Tasks" value={17} delta="3 blocked" trend="neutral" href="/tasks/my" />
</div>
```

---

## Chart Components

Use **Recharts** (bundled with Shadcn Charts) for all visualisations. Never import other charting libraries.

### Revenue / Line Chart

```tsx
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

const chartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--primary))' },
  target:  { label: 'Target',  color: 'hsl(var(--muted-foreground))' },
}

export function RevenueChart({ data }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Monthly Revenue</CardTitle>
        <CardDescription className="text-xs">vs. target · last 12 months</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="h-[220px] sm:h-[260px] w-full">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
            <Line dataKey="target" stroke="var(--color-target)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

### Pipeline Funnel / Bar Chart

```tsx
export function PipelineChart({ data }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sales Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] sm:h-[260px] w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="status"
              width={90}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={stageColour(entry.status)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

### Donut / Ring Chart (Leave balance, attendance %)

```tsx
export function AttendanceRingChart({ present, absent, leave }) {
  const data = [
    { name: 'Present', value: present, fill: 'hsl(142 76% 36%)' },
    { name: 'Absent',  value: absent,  fill: 'hsl(0 84% 60%)' },
    { name: 'Leave',   value: leave,   fill: 'hsl(38 92% 50%)' },
  ]
  const total = present + absent + leave

  return (
    <ChartContainer config={chartConfig} className="h-[180px]">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={72}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
      </PieChart>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{Math.round(present/total*100)}%</span>
        <span className="text-xs text-muted-foreground">Present</span>
      </div>
    </ChartContainer>
  )
}
```

### Chart Rules

- **Never show a chart without data** — show an empty state illustration instead
- **Mobile chart heights:** `h-[200px]` minimum (shorter than desktop to save scroll)
- **All monetary Y-axis values:** formatted as `₹{n}L` (lakhs) or `₹{n}K` (thousands)
- **All percentage values:** one decimal place — `71.4%` not `71%`
- **Tooltips:** always include units in the tooltip label
- **Responsive:** always use `ResponsiveContainer` from Recharts or `ChartContainer` from Shadcn — never hardcode pixel widths

---

## Activity Feeds

Activity feeds appear on dashboards, CRM entity detail pages, and the notifications page.

```
┌──────────────────────────────────────────────────────────┐
│  Recent Activity                            [See all →]  │
│ ──────────────────────────────────────────────────────── │
│  [Avatar] Jane Smith converted Rahul Mehta to a Deal     │
│           2 hours ago                                    │
│ ──────────────────────────────────────────────────────── │
│  [Avatar] Arjun Nair moved task to In Review             │
│           4 hours ago                                    │
│ ──────────────────────────────────────────────────────── │
│  [Avatar] Neha HR approved leave for Priya K.            │
│           Yesterday at 2:30 PM                           │
└──────────────────────────────────────────────────────────┘
```

```tsx
export function ActivityFeedItem({ activity }) {
  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <UserAvatar user={activity.actor} size="sm" className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-medium">{activity.actor.firstName}</span>{' '}
          <span className="text-muted-foreground">{activity.description}</span>
        </p>
        <time className="text-xs text-muted-foreground mt-0.5 block">
          {formatRelativeTime(activity.createdAt)}
        </time>
      </div>
      {activity.resourceHref && (
        <Link href={activity.resourceHref} className="flex-shrink-0 self-start mt-0.5">
          <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </Link>
      )}
    </div>
  )
}
```

---

## Quick Action Widgets

Actionable widgets that surface the most common operations so the user does not need to navigate.

### Clock In/Out Widget (Employee Dashboard)

```tsx
export function ClockWidget() {
  const { data: status } = useClockStatus()
  const clockIn = useClockIn()
  const clockOut = useClockOut()

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Today</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {status?.totalMinutes ? formatDuration(status.totalMinutes) : '—'}
            </p>
            {status?.isClockedIn && (
              <p className="text-xs text-green-600 mt-1">
                ● Clocked in since {formatTime(status.clockInTime)}
              </p>
            )}
          </div>

          {status?.isClockedIn ? (
            <Button
              variant="outline"
              size="lg"
              onClick={() => clockOut.mutate()}
              disabled={clockOut.isPending}
              className="h-14 w-14 rounded-full border-2"
            >
              {clockOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => clockIn.mutate()}
              disabled={clockIn.isPending}
              className="h-14 w-14 rounded-full"
            >
              {clockIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Pending Approvals Widget (TEAM_LEAD / HR)

```tsx
export function PendingApprovalsWidget({ type }: { type: 'leaves' | 'time-entries' }) {
  const { data } = usePendingApprovals(type)

  if (!data?.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {type === 'leaves' ? 'Leave Approvals' : 'Time Entry Approvals'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">All caught up ✓</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base">
          {type === 'leaves' ? 'Leave Approvals' : 'Time Entry Approvals'}
        </CardTitle>
        <Badge variant="secondary">{data.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.slice(0, 4).map(item => (
          <ApprovalRow key={item.id} item={item} type={type} />
        ))}
        {data.length > 4 && (
          <Link href={`/hrms/${type}`} className="text-xs text-primary hover:underline block text-center pt-1">
            View all {data.length} pending
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Empty States

Every widget and list view must define an empty state.

```tsx
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-4">{description}</p>
      {action && (
        action.href ? (
          <Button size="sm" asChild>
            <Link href={action.href}><Plus className="mr-1.5 h-3.5 w-3.5" />{action.label}</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={action.onClick}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{action.label}
          </Button>
        )
      )}
    </div>
  )
}

// Empty state examples per widget
<EmptyState
  icon={UserPlus}
  title="No leads yet"
  description="Add your first lead to start building your pipeline."
  action={{ label: 'Add Lead', href: '/leads/new' }}
/>

<EmptyState
  icon={CheckSquare}
  title="No open tasks"
  description="You're all caught up. Enjoy the moment."
/>

<EmptyState
  icon={Receipt}
  title="No overdue invoices"
  description="All invoices are within payment terms."
/>
```

---

## Loading States

### Dashboard Initial Load

```tsx
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-9 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-[220px] w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-[220px] w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
```

### Widget Loading

```tsx
// Each widget manages its own loading state
export function RecentActivityFeed() {
  const { data, isLoading } = useRecentActivity()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {data.map(activity => (
              <ActivityFeedItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Dashboard Data Refresh Strategy

```tsx
// Dashboard uses stale-while-revalidate: show cached data immediately,
// refresh in the background every 60 seconds

const { data: kpiData } = useQuery({
  queryKey: ['dashboard-kpis', user.workspaceId],
  queryFn: fetchDashboardKPIs,
  staleTime: 60_000,      // treat as fresh for 60s
  refetchInterval: 120_000, // background refresh every 2 min
  refetchOnWindowFocus: true,
})

// Real-time updates: Socket.IO events trigger query invalidation
// No polling for event-driven data (task assignments, notifications)
socket.on('task.status_changed', () => {
  queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
})
```

---

## Responsive Dashboard Behaviour

### Mobile Dashboard Priority Order

On mobile, widget order is determined by priority — the most actionable widgets appear first, above the fold.

| Role | Mobile Order (top to bottom) |
|---|---|
| EMPLOYEE | Clock widget → My tasks today → Leave balance → Attendance week |
| TEAM_LEAD | Sprint progress → Pending approvals → Blocked tasks → My tasks |
| HR | Today's attendance → Pending leaves → Payroll status → Upcoming events |
| ADMIN | KPI row (2×2) → Overdue invoices → Pipeline stage counts → Recent activity |
| SUPER_ADMIN | KPI row (2×2) → Payroll status → Pending approvals → Audit events |

### Widget Visibility by Breakpoint

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
  {/* Always visible */}
  <KPIRow className="col-span-full" />

  {/* Hidden on mobile — too detailed for small screen */}
  <RevenueChart className="hidden md:block" />
  <PipelineChart className="hidden md:block" />

  {/* Visible on all screens */}
  <PendingApprovalsWidget />
  <RecentActivityFeed className="md:col-span-2 xl:col-span-1" />

  {/* Desktop only — secondary information */}
  <UpcomingEvents className="hidden xl:block" />
</div>
```

---

## Page Header Pattern

Every page inside the app uses a consistent page header structure.

```tsx
interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, backHref, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link href={backHref} className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 hidden md:block">{description}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

// Usage
<PageHeader
  title="Leads"
  description="Manage and convert your sales prospects."
  actions={
    <>
      <Button variant="outline" size="sm">
        <Download className="mr-2 h-4 w-4" /> Export
      </Button>
      <Button size="sm">
        <Plus className="mr-2 h-4 w-4" /> Add Lead
      </Button>
    </>
  }
/>
```

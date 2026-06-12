# Navigation Patterns — VividCRM

## Navigation Architecture Overview

```
                    ┌──────────────────────────────────────────────┐
                    │              Navigation System               │
                    └──────────────────────────────────────────────┘
                           │                │                │
                           ▼                ▼                ▼
                    Mobile (< 768px)   Tablet (768–1023)  Desktop (≥ 1024)
                    ─────────────────  ─────────────────  ────────────────
                    Top Header         Top Header         Fixed Sidebar
                    + Bottom Tab Nav   + Icon Rail        (expanded, 240px)
                    + Drawer (slide)   + Overlay Drawer   + Top breadcrumb bar
```

---

## Module Navigation Structure

### Primary Modules and their Sub-navigation

```
CRM
├── Overview (dashboard)
├── Leads
├── Deals
├── Contacts
├── Companies
├── Campaigns
└── Mailing

Tasks
├── My Tasks
├── Projects
│   └── [Project] → Boards / Sprints / Members / Time
└── Time Tracking

HRMS
├── Employees
├── Departments
├── Attendance
├── Leaves
│   ├── Applications
│   └── Leave Types
├── Payroll
│   ├── Runs
│   └── Salary Structures
└── Holidays

Invoices
├── All Invoices
├── Drafts
├── Overdue
├── Payments
└── Templates

Reports
├── CRM Reports
├── Task Reports
├── HR Reports
└── Financial Reports

Settings
├── Workspace
├── Users & Roles
├── Modules
├── Notifications
└── Integrations
```

---

## Desktop Navigation — Fixed Sidebar

### Sidebar Anatomy

```
┌──────────────────────────┐
│ ╔══════════╗             │  ← Logo / Workspace name (top, 64px height)
│ ║  VIVID   ║             │
│ ║  CRM     ║             │
│ ╚══════════╝             │
│                          │
│ [🔍 Search Cmd+K]        │  ← Global search shortcut
│                          │
│ ─── Main ─────────────── │
│ [◉] Dashboard            │  ← Active state: solid icon + bg
│ [ ] CRM              ▾   │  ← Module with sub-nav (collapsible)
│   ─ Leads                │
│   ─ Deals                │
│   ─ Contacts             │
│   ─ Companies            │
│ [ ] Tasks            ▾   │
│   ─ My Tasks             │
│   ─ Projects             │
│   ─ Time Tracking        │
│ [ ] HRMS             ▾   │
│   ─ Employees            │
│   ─ Attendance           │
│   ─ Leaves               │
│   ─ Payroll              │
│ [ ] Invoices         ▾   │
│ [ ] Reports              │
│                          │
│ ─── Workspace ─────────  │
│ [ ] Settings             │
│                          │
│ ─────────────────────────│
│ [Avatar] Jane Smith      │  ← User section (bottom, 64px)
│          ADMIN           │
│ [Logout]                 │
└──────────────────────────┘
```

### Sidebar Component

```tsx
export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">V</span>
          </div>
          <span className="font-semibold text-foreground">VividCRM</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <button
          className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded border">⌘K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <NavGroup label="Main">
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavGroup label="CRM" icon={Users} collapsible defaultOpen>
            <NavItem href="/leads" icon={UserPlus} label="Leads" />
            <NavItem href="/deals" icon={Handshake} label="Deals" />
            <NavItem href="/contacts" icon={Contact2} label="Contacts" />
            <NavItem href="/companies" icon={Building2} label="Companies" />
            <NavItem href="/campaigns" icon={Megaphone} label="Campaigns" />
          </NavGroup>
          <NavGroup label="Tasks" icon={CheckSquare} collapsible>
            <NavItem href="/tasks/my" icon={ListTodo} label="My Tasks" />
            <NavItem href="/projects" icon={FolderKanban} label="Projects" />
            <NavItem href="/time-entries" icon={Clock} label="Time Tracking" />
          </NavGroup>
          {/* ... etc */}
        </NavGroup>

        <NavGroup label="Workspace">
          <NavItem href="/settings" icon={Settings} label="Settings" />
        </NavGroup>
      </nav>

      {/* User */}
      <UserMenuBottom />
    </aside>
  )
}
```

### Active State Styles

```tsx
// NavItem component
const isActive = pathname === href || pathname.startsWith(href + '/')

return (
  <Link
    href={href}
    className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )}
  >
    <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
    {label}
  </Link>
)
```

### Role-Based Navigation Visibility

```tsx
const navItems = [
  { href: '/crm', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'] },
  { href: '/tasks', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'EMPLOYEE'] },
  { href: '/hrms', roles: ['SUPER_ADMIN', 'HR'] },
  { href: '/hrms/attendance', roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'] },
  { href: '/hrms/leaves', roles: ['SUPER_ADMIN', 'HR', 'TEAM_LEAD', 'EMPLOYEE'] },
  { href: '/hrms/payroll', roles: ['SUPER_ADMIN', 'HR'] },
  { href: '/invoices', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/reports', roles: ['SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD'] },
  { href: '/settings', roles: ['SUPER_ADMIN', 'ADMIN'] },
]

// Filter based on user.role
const visibleItems = navItems.filter(item => item.roles.includes(user.role))
```

---

## Tablet Navigation — Icon Rail

On tablet (`md` to `lg`), the sidebar collapses to a 64px icon-only rail with tooltips. Clicking a section icon opens a fly-out sub-menu panel.

```
┌────────────────────────────────────────────┐
│ 64px rail │  Content area                  │
│ ─────────────────────────────────────────  │
│  [Logo]   │  Page content                  │
│           │                                │
│  [Search] │                                │
│           │                                │
│  [◉ Dash] │   ◄ tooltip: "Dashboard"       │
│  [ CRM  ] │                                │
│  [ Tasks] │   ◄ on hover: fly-out label   │
│  [ HRMS ] │                                │
│  [ Invs ] │                                │
│  [ Rpts ] │                                │
│           │                                │
│  [ Sett ] │                                │
│  [Avatar] │                                │
└────────────────────────────────────────────┘
```

```tsx
// Tablet icon rail
<aside className="hidden md:flex lg:hidden w-16 flex-col border-r bg-background">
  <div className="flex h-16 items-center justify-center border-b">
    <LogoIcon className="h-8 w-8" />
  </div>

  <nav className="flex-1 px-2 py-3 space-y-1">
    {navItems.map(item => (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md mx-auto transition-colors',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ))}
  </nav>
</aside>
```

---

## Mobile Navigation

### Top Header Bar (Mobile)

```
┌─────────────────────────────────────────┐
│ [≡ Menu]   VividCRM    [🔔] [Avatar]    │  64px height
└─────────────────────────────────────────┘
```

```tsx
export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="flex h-14 items-center border-b bg-background px-4 gap-3 md:hidden">
      {/* Hamburger */}
      <button
        className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo / current module name */}
      <div className="flex-1 flex items-center">
        <span className="font-semibold text-sm">VividCRM</span>
      </div>

      {/* Right actions */}
      <NotificationBell />
      <UserAvatar size="sm" />

      {/* Navigation drawer */}
      <MobileNavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  )
}
```

### Mobile Navigation Drawer

Full-screen slide-in drawer from the left, with all navigation items and user section.

```tsx
export function MobileNavigationDrawer({ open, onClose }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[280px] p-0">
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4 gap-3">
          <LogoMark />
          <span className="font-semibold">VividCRM</span>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <UserAvatar size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="overflow-y-auto flex-1 px-2 py-3">
          {/* Same items as desktop sidebar but touching the edge */}
          <MobileNavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={onClose} />
          {/* ...etc */}
        </nav>

        {/* Bottom actions */}
        <div className="border-t p-2">
          <button className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### Bottom Tab Navigation (Mobile)

Fixed 5-tab bottom bar for the most frequently accessed destinations. Role-specific: the visible tabs change based on the user's role.

```
┌─────────────────────────────────────────┐
│  [Home]  [Tasks]  [+]  [HRMS] [Invcs]  │  64px height
└─────────────────────────────────────────┘
```

```tsx
// Tab config per role
const mobileTabsByRole: Record<Role, MobileTab[]> = {
  SUPER_ADMIN: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/crm', icon: Users, label: 'CRM' },
    { href: '/tasks/my', icon: CheckSquare, label: 'Tasks' },
    { href: '/hrms/attendance', icon: Clock, label: 'Attend.' },
    { href: '/invoices', icon: Receipt, label: 'Invoice' },
  ],
  ADMIN: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/crm', icon: Users, label: 'CRM' },
    { href: '/tasks/my', icon: CheckSquare, label: 'Tasks' },
    { href: '/invoices', icon: Receipt, label: 'Invoice' },
    { href: '/reports', icon: BarChart3, label: 'Reports' },
  ],
  HR: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/hrms/employees', icon: Users, label: 'People' },
    { href: '/hrms/attendance', icon: Clock, label: 'Attend.' },
    { href: '/hrms/leaves', icon: CalendarDays, label: 'Leaves' },
    { href: '/hrms/payroll', icon: DollarSign, label: 'Payroll' },
  ],
  TEAM_LEAD: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/tasks/my', icon: CheckSquare, label: 'Tasks' },
    { href: '/projects', icon: FolderKanban, label: 'Projects' },
    { href: '/hrms/leaves', icon: CalendarDays, label: 'Leaves' },
    { href: '/hrms/attendance/my', icon: Clock, label: 'Attend.' },
  ],
  EMPLOYEE: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { href: '/tasks/my', icon: CheckSquare, label: 'My Tasks' },
    { href: '/hrms/leaves', icon: CalendarDays, label: 'Leaves' },
    { href: '/hrms/attendance/my', icon: Clock, label: 'Attend.' },
    { href: '/profile', icon: User, label: 'Profile' },
  ],
}

export function MobileBottomNav() {
  const { user } = useAuth()
  const pathname = usePathname()
  const tabs = mobileTabsByRole[user.role]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background pb-safe md:hidden">
      <div className="flex">
        {tabs.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', active && 'text-primary')} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

---

## Top Bar (Desktop / Tablet)

```
┌──────────────────────────────────────────────────────────────────┐
│  [Breadcrumb: CRM / Leads]              [🔔 3] [Search] [User ▾]│  56px height
└──────────────────────────────────────────────────────────────────┘
```

```tsx
export function DesktopTopBar() {
  return (
    <header className="hidden md:flex h-14 items-center border-b bg-background px-6 gap-4">
      <Breadcrumb className="flex-1" />

      <div className="flex items-center gap-2">
        <GlobalSearch />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
```

---

## Breadcrumbs

Auto-generated from the current route. Always shown on tablet and desktop.

```
CRM  /  Leads  /  Rahul Mehta
```

```tsx
export function Breadcrumb() {
  const pathname = usePathname()
  const segments = buildBreadcrumbs(pathname)  // maps route segments to labels

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm">
        {segments.map((seg, i) => (
          <li key={seg.href} className="flex items-center gap-1.5">
            {i < segments.length - 1 ? (
              <>
                <Link href={seg.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {seg.label}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </>
            ) : (
              <span className="font-medium text-foreground truncate max-w-[200px]" aria-current="page">
                {seg.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

---

## Global Search

Triggered by `⌘K` on desktop, search icon on mobile.

```
┌──────────────────────────────────────────────────────┐
│ [🔍 Search leads, tasks, invoices...]            [Esc]│
├──────────────────────────────────────────────────────┤
│ Recent                                               │
│  [🧑] Rahul Mehta — Lead                            │
│  [📋] Implement login page — Task                   │
│  [📄] INV-2025-0042 — Invoice                       │
├──────────────────────────────────────────────────────┤
│ Leads (3)                                            │
│  ◉ Rahul Mehta — NEW                                │
│  ◉ Priya Iyer — QUALIFIED                           │
├──────────────────────────────────────────────────────┤
│ Tasks (2)                                            │
│  ✓ Implement login page — IN_PROGRESS               │
└──────────────────────────────────────────────────────┘
```

```tsx
export function GlobalSearch() {
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search leads, tasks, invoices, employees..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentItems.map(item => (
              <CommandItem key={item.id} onSelect={() => navigate(item.href)}>
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.leads?.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map(lead => (
              <CommandItem key={lead.id} onSelect={() => navigate(`/leads/${lead.id}`)}>
                <UserPlus className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{lead.firstName} {lead.lastName}</span>
                <LeadStatusBadge status={lead.status} className="ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {/* Tasks, Invoices, Employees groups */}
      </CommandList>
    </CommandDialog>
  )
}
```

---

## Notification Centre

```tsx
export function NotificationBell() {
  const { data } = useUnreadCount()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {data?.unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {data.unreadCount > 9 ? '9+' : data.unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={markAllRead}>
            Mark all read
          </button>
        </div>

        <ScrollArea className="max-h-[400px]">
          {notifications.map(n => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </ScrollArea>

        <div className="border-t p-2">
          <Link href="/notifications" className="flex w-full items-center justify-center text-xs text-muted-foreground hover:text-foreground py-2 rounded-md hover:bg-muted">
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

---

## User Menu (Desktop)

```tsx
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
          <UserAvatar size="sm" />
          <div className="hidden xl:block text-left">
            <p className="text-sm font-medium leading-none">{user.firstName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.role}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden xl:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><User className="mr-2 h-4 w-4" />My Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/hrms/leaves"><CalendarDays className="mr-2 h-4 w-4" />My Leaves</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/hrms/payslips"><FileText className="mr-2 h-4 w-4" />My Payslips</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## In-Page Sub-Navigation (Tabs)

Used within detail pages when content is divided into sections.

```tsx
// Tabs in a detail page
<Tabs defaultValue="overview" className="w-full">
  <TabsList className="border-b rounded-none h-auto p-0 bg-transparent w-full justify-start">
    {tabs.map(tab => (
      <TabsTrigger
        key={tab.value}
        value={tab.value}
        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium"
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
        )}
      </TabsTrigger>
    ))}
  </TabsList>

  <TabsContent value="overview" className="mt-4">
    ...
  </TabsContent>
</Tabs>
```

---

## Navigation Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open global search |
| `Esc` | Close modal / sheet / search |
| `⌘/` / `Ctrl+/` | Open keyboard shortcut help modal |
| `G then D` | Go to Dashboard |
| `G then L` | Go to Leads |
| `G then T` | Go to My Tasks |
| `G then E` | Go to Employees |
| `G then I` | Go to Invoices |
| `N` | New record (context-aware: on Leads page → New Lead) |

---

## Page Transition Animations

```tsx
// app/(app)/layout.tsx
// Wrap page content in a fade-in animation on route change
<motion.div
  key={pathname}
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
  {children}
</motion.div>
```

On mobile, use a simpler `animate-in fade-in-0` without the y offset to avoid visual jank.

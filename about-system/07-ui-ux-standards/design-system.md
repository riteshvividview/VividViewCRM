# Design System — VividCRM

## Technology Foundation

| Layer | Choice | Purpose |
|---|---|---|
| Styling | Tailwind CSS v3 | Utility-first, mobile-first, consistent spacing |
| Components | Shadcn UI | Radix primitives + Tailwind — accessible, composable |
| Icons | Lucide React | Consistent stroke-based icon set included with Shadcn |
| Fonts | Inter (body) + JetBrains Mono (code/numbers) | Variable font, clean, highly legible at small sizes |
| Theming | CSS custom properties via Shadcn | Light + dark mode via `class="dark"` on `<html>` |

---

## Colour System

### CSS Custom Properties (defined in `globals.css`)

Shadcn uses CSS variables mapped to `hsl()` values. All colours are defined once and applied through Tailwind's extended theme.

```css
/* Light mode */
:root {
  --background:        0 0% 100%;
  --foreground:        222 47% 11%;

  --card:              0 0% 100%;
  --card-foreground:   222 47% 11%;

  --popover:           0 0% 100%;
  --popover-foreground: 222 47% 11%;

  --primary:           221 83% 53%;       /* Blue 600 */
  --primary-foreground: 210 40% 98%;

  --secondary:         210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  --muted:             210 40% 96%;
  --muted-foreground:  215 16% 47%;

  --accent:            210 40% 96%;
  --accent-foreground: 222 47% 11%;

  --destructive:       0 84% 60%;          /* Red 500 */
  --destructive-foreground: 210 40% 98%;

  --border:            214 32% 91%;
  --input:             214 32% 91%;
  --ring:              221 83% 53%;

  --radius:            0.5rem;
}

/* Dark mode */
.dark {
  --background:        222 47% 11%;
  --foreground:        210 40% 98%;

  --card:              222 47% 11%;
  --card-foreground:   210 40% 98%;

  --muted:             217 33% 17%;
  --muted-foreground:  215 20% 65%;

  --primary:           217 91% 60%;
  --primary-foreground: 222 47% 11%;

  --border:            217 33% 17%;
  --input:             217 33% 17%;
}
```

### Semantic Colour Tokens

Beyond Shadcn's base tokens, VividCRM defines semantic colours for status and feedback:

```css
:root {
  /* Status — Lead / Deal / Task statuses */
  --status-new:         210 100% 56%;    /* Blue */
  --status-active:      142 76% 36%;    /* Green */
  --status-pending:     38 92% 50%;     /* Amber */
  --status-blocked:     0 84% 60%;      /* Red */
  --status-done:        142 76% 36%;    /* Green */
  --status-cancelled:   215 16% 47%;    /* Gray */
  --status-archived:    215 16% 47%;    /* Gray */

  /* Priority */
  --priority-urgent:    0 84% 60%;      /* Red */
  --priority-high:      25 95% 53%;     /* Orange */
  --priority-medium:    38 92% 50%;     /* Amber */
  --priority-low:       142 76% 36%;    /* Green */

  /* Feedback */
  --success:            142 76% 36%;
  --success-foreground: 0 0% 100%;
  --warning:            38 92% 50%;
  --warning-foreground: 0 0% 0%;
  --info:               199 89% 48%;
  --info-foreground:    0 0% 100%;
  --error:              0 84% 60%;
  --error-foreground:   0 0% 100%;
}
```

### Colour Usage Rules

| Colour | Use | Never Use For |
|---|---|---|
| `primary` | Primary CTA, selected state, links | Decorative elements, backgrounds |
| `destructive` | Delete buttons, error states | Warnings (use `warning` instead) |
| `muted` | Placeholder text, disabled labels, secondary info | Body text |
| `muted-foreground` | Secondary text on cards | Headers, primary content |
| `border` | Card borders, input borders, dividers | Text, backgrounds |
| `success` | Completed status, PAID invoice, success toasts | Generic accent use |
| `warning` | Overdue items, low balance warnings, pending states | Errors |

---

## Typography

### Font Loading (Next.js `layout.tsx`)

```ts
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})
```

### Type Scale

All sizing uses Tailwind's default type scale. Sizes below are the mobile base; they may be promoted at `md:` or `lg:` breakpoints.

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 16px | 400 | Timestamps, labels, captions, badges |
| `text-sm` | 14px | 20px | 400/500 | Body text, table cells, secondary info |
| `text-base` | 16px | 24px | 400 | Form inputs (required — prevents iOS zoom), default body |
| `text-lg` | 18px | 28px | 500/600 | Section headings, card titles |
| `text-xl` | 20px | 28px | 600 | Page headings (mobile) |
| `text-2xl` | 24px | 32px | 700 | Page headings (desktop), stat values |
| `text-3xl` | 30px | 36px | 700 | Dashboard headline numbers |
| `text-4xl` | 36px | 40px | 700 | Large KPI cards |

### Font Weight Usage

| Weight | Tailwind | Usage |
|---|---|---|
| 400 | `font-normal` | Body text, table cells |
| 500 | `font-medium` | Labels, secondary headings, nav items |
| 600 | `font-semibold` | Card titles, column headers, active states |
| 700 | `font-bold` | Page titles, large KPI numbers |

### Typography Examples

```html
<!-- Page title -->
<h1 class="text-xl font-semibold tracking-tight md:text-2xl">Leads</h1>

<!-- Section heading -->
<h2 class="text-base font-semibold md:text-lg">Recent Activity</h2>

<!-- Body text -->
<p class="text-sm text-foreground leading-relaxed">Description text here.</p>

<!-- Muted secondary text -->
<span class="text-xs text-muted-foreground">Created 2 hours ago</span>

<!-- Monetary value — use monospace -->
<span class="font-mono text-lg font-semibold tabular-nums">₹1,50,000</span>

<!-- Code / IDs -->
<code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">INV-2025-0042</code>
```

### Number Formatting Rules

- All currency: `₹1,50,000` format (Indian number system) using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`
- All percentages: one decimal place — `71.4%`
- All monetary values: `font-mono tabular-nums` — prevents layout shift as numbers update
- Dates: `15 Jun 2025` (day month year, no comma) for display; ISO 8601 for API
- Times: `09:15 AM` (12-hour with AM/PM) — workspace timezone applied

---

## Spacing System

Tailwind's default spacing scale (4px base unit). Use only values from this scale — no arbitrary values.

| Token | Size | Primary Usage |
|---|---|---|
| `space-0.5` | 2px | Tiny gaps between badge elements |
| `space-1` | 4px | Icon-to-text gap |
| `space-1.5` | 6px | Label to input gap |
| `space-2` | 8px | Compact element spacing |
| `space-3` | 12px | Form field helper text |
| `space-4` | 16px | Default padding, field spacing |
| `space-5` | 20px | — |
| `space-6` | 24px | Section spacing, card padding |
| `space-8` | 32px | Large section gaps |
| `space-10` | 40px | Page section separation |
| `space-12` | 48px | — |
| `space-16` | 64px | Hero/empty state vertical padding |

### Padding Standards

| Component | Mobile | Desktop |
|---|---|---|
| Page container | `px-4 py-4` | `px-6 py-6` or `px-8 py-8` |
| Card | `p-4` | `p-6` |
| Card header | `px-4 pt-4 pb-2` | `px-6 pt-6 pb-3` |
| Dialog | `p-4 sm:p-6` | `sm:p-6` |
| Table cell | `px-3 py-2` | `px-4 py-3` |
| Input | `px-3 py-2` (via Shadcn) | Same |
| Button sm | `px-3 py-1.5` | Same |
| Button default | `px-4 py-2` | Same |
| Button lg | `px-6 py-3` | Same |

---

## Elevation and Shadow

```css
/* Shadcn uses these shadow presets — use exactly these, no custom shadows */
shadow-none     /* Flat — borders do the job */
shadow-sm       /* Cards, dropdowns */
shadow-md       /* Popovers, tooltips */
shadow-lg       /* Modals, sheets */
shadow-xl       /* Command palette */
shadow-2xl      /* Rarely — full-screen overlays */
```

Usage map:
| Element | Shadow | Border |
|---|---|---|
| Cards | `shadow-sm` | `border` |
| Dropdown menus | `shadow-md` | `border` |
| Modals / Dialogs | `shadow-xl` | none |
| Bottom sheets | `shadow-2xl` | none |
| Tooltips | `shadow-md` | none |
| Sticky headers | `shadow-sm` when scrolled | `border-b` |

---

## Border Radius

```css
--radius: 0.5rem;  /* 8px — base, defined in globals.css */
```

| Token | Radius | Usage |
|---|---|---|
| `rounded-sm` | 4px | Badges, small chips |
| `rounded-md` | 6px | Buttons, inputs, small cards |
| `rounded-lg` | 8px | Cards, dialogs, panels |
| `rounded-xl` | 12px | Large cards, mobile bottom sheets |
| `rounded-2xl` | 16px | — |
| `rounded-full` | 9999px | Avatars, pills, toggle switches |

---

## Component Standards

### Buttons

Shadcn Button variants used in VividCRM:

| Variant | Tailwind Token | Usage |
|---|---|---|
| `default` | Primary blue | Primary action per screen (max 1 per view) |
| `secondary` | Muted background | Secondary actions alongside primary |
| `outline` | Border + transparent | Tertiary actions, cancel |
| `ghost` | Transparent | Navigation links, icon actions in tables |
| `destructive` | Red | Delete, reject, void |
| `link` | Underline text | Inline text links only |

**Button size rules:**
- Mobile: prefer `size="default"` (h-9) or larger; never `size="sm"` on primary actions
- Icon buttons: always use `size="icon"` (h-9 w-9) with `aria-label`
- Full-width on mobile for primary CTAs: `class="w-full sm:w-auto"`

```html
<!-- Primary action on mobile -->
<Button class="w-full sm:w-auto" size="default">
  <Plus class="mr-2 h-4 w-4" /> Add Lead
</Button>

<!-- Destructive with confirmation -->
<Button variant="destructive" size="sm">
  <Trash2 class="mr-2 h-4 w-4" /> Delete
</Button>

<!-- Icon-only table action -->
<Button variant="ghost" size="icon" aria-label="Edit lead">
  <Pencil class="h-4 w-4" />
</Button>
```

### Badges / Status Chips

```html
<!-- Lead status badge -->
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
             bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
  New
</span>
```

Standard status badge colours:

| Status | Light | Dark |
|---|---|---|
| NEW / TODO | `bg-slate-100 text-slate-700` | `bg-slate-800 text-slate-200` |
| IN_PROGRESS / ACTIVE | `bg-blue-100 text-blue-800` | `bg-blue-900 text-blue-200` |
| BLOCKED | `bg-red-100 text-red-800` | `bg-red-900 text-red-200` |
| IN_REVIEW / PENDING | `bg-amber-100 text-amber-800` | `bg-amber-900 text-amber-200` |
| DONE / APPROVED / PAID | `bg-green-100 text-green-800` | `bg-green-900 text-green-200` |
| CANCELLED / VOIDED | `bg-slate-100 text-slate-500` | `bg-slate-800 text-slate-400` |
| OVERDUE / REJECTED | `bg-red-100 text-red-800` | `bg-red-900 text-red-200` |
| WON / COMPLETED | `bg-emerald-100 text-emerald-800` | `bg-emerald-900 text-emerald-200` |
| LOST / TERMINATED | `bg-gray-100 text-gray-600` | `bg-gray-800 text-gray-400` |

### Cards

```html
<Card class="overflow-hidden">
  <CardHeader class="pb-3">
    <div class="flex items-start justify-between gap-4">
      <div>
        <CardTitle class="text-base font-semibold leading-tight">
          Lead Title
        </CardTitle>
        <CardDescription class="mt-1 text-xs">
          Created 2 hours ago by Jane Smith
        </CardDescription>
      </div>
      <Badge variant="secondary">New</Badge>
    </div>
  </CardHeader>
  <CardContent class="text-sm space-y-1">
    ...content...
  </CardContent>
  <CardFooter class="border-t pt-3 pb-3">
    ...actions...
  </CardFooter>
</Card>
```

### Data Tables

```html
<div class="rounded-lg border overflow-hidden">
  <Table>
    <TableHeader class="bg-muted/50">
      <TableRow class="hover:bg-transparent border-b">
        <TableHead class="h-10 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Name
        </TableHead>
        ...
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow class="border-b hover:bg-muted/50 cursor-pointer">
        <TableCell class="px-4 py-3 text-sm font-medium">Rahul Mehta</TableCell>
        ...
      </TableRow>
    </TableBody>
  </Table>
</div>
```

**Mobile table rule:** Full data tables are hidden on mobile (`hidden md:block`). Mobile shows a card list view instead.

### Form Elements

```html
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email address</FormLabel>
      <FormControl>
        <Input
          type="email"
          placeholder="rahul@startup.com"
          className="h-12 text-base"  /* h-12 for 48px height on mobile */
          {...field}
        />
      </FormControl>
      <FormDescription>Used for lead communication.</FormDescription>
      <FormMessage />  {/* Shows error */}
    </FormItem>
  )}
/>
```

### Dialogs and Sheets

**Rule:** Use `Dialog` for desktop-first interactions; use `Sheet` (bottom drawer) for mobile-native flows.

```html
<!-- On mobile: Sheet from bottom. On desktop: centered Dialog -->
<!-- Implement both and show/hide with Tailwind breakpoints -->

{/* Mobile: Sheet */}
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl md:hidden">
    <SheetHeader>
      <SheetTitle>Add New Lead</SheetTitle>
    </SheetHeader>
    <div class="overflow-y-auto pb-safe-bottom">
      <LeadForm />
    </div>
  </SheetContent>
</Sheet>

{/* Desktop: Dialog */}
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="hidden md:flex sm:max-w-lg flex-col">
    <DialogHeader>
      <DialogTitle>Add New Lead</DialogTitle>
    </DialogHeader>
    <LeadForm />
  </DialogContent>
</Dialog>
```

### Toasts / Notifications

Use Shadcn's `Sonner` for toast notifications. Always positioned `bottom-right` on desktop, `bottom-center` on mobile.

```ts
// Success
toast.success('Lead created successfully.')

// Error
toast.error('Failed to save. Please try again.')

// With action
toast.message('Deal marked as Won', {
  description: 'Project has been created automatically.',
  action: {
    label: 'View Project',
    onClick: () => router.push(`/projects/${projectId}`),
  },
})

// Loading (while async operation is in progress)
const toastId = toast.loading('Generating invoice PDF...')
// on complete:
toast.success('PDF ready for download.', { id: toastId })
```

### Skeleton Loading States

```html
<!-- Card skeleton -->
<Card class="overflow-hidden">
  <CardHeader class="pb-3">
    <Skeleton class="h-5 w-3/4" />
    <Skeleton class="h-3 w-1/2 mt-2" />
  </CardHeader>
  <CardContent class="space-y-2">
    <Skeleton class="h-4 w-full" />
    <Skeleton class="h-4 w-5/6" />
    <Skeleton class="h-4 w-4/6" />
  </CardContent>
</Card>

<!-- Table skeleton -->
{Array.from({ length: 5 }).map((_, i) => (
  <TableRow key={i}>
    <TableCell><Skeleton class="h-4 w-32" /></TableCell>
    <TableCell><Skeleton class="h-4 w-24" /></TableCell>
    <TableCell><Skeleton class="h-4 w-16" /></TableCell>
  </TableRow>
))}
```

### Empty States

Every list view must define an empty state. Never show a blank page.

```html
<div class="flex flex-col items-center justify-center py-16 px-4 text-center">
  <!-- Icon: 48px, muted colour -->
  <div class="rounded-full bg-muted p-4 mb-4">
    <Users class="h-8 w-8 text-muted-foreground" />
  </div>
  <!-- Heading: what's missing -->
  <h3 class="text-base font-semibold mb-1">No leads yet</h3>
  <!-- Description: why and what to do -->
  <p class="text-sm text-muted-foreground max-w-[280px] mb-6">
    Add your first lead to start building your sales pipeline.
  </p>
  <!-- CTA: the action that fills this empty state -->
  <Button>
    <Plus class="mr-2 h-4 w-4" /> Add Lead
  </Button>
</div>
```

---

## Icon Standards

Use Lucide React exclusively. Do not mix icon libraries.

```ts
import { Plus, Search, Trash2, Pencil, ChevronRight, MoreHorizontal } from 'lucide-react'
```

**Sizing:**
| Context | Size | Tailwind |
|---|---|---|
| Inside buttons (default) | 16px | `h-4 w-4` |
| Inside buttons (lg) | 18px | `h-[18px] w-[18px]` |
| Standalone navigation icons | 20px | `h-5 w-5` |
| Empty state illustrations | 32px | `h-8 w-8` |
| Large feature icons | 48px | `h-12 w-12` |

**Spacing:** When an icon appears left of text: `mr-2`. Right of text: `ml-2`. Never margin on icon-only buttons.

---

## Animation and Transitions

Use Tailwind's built-in transition utilities. No custom CSS animations except for Shadcn's built-in Radix animations.

```html
<!-- Hover state transitions -->
<button class="transition-colors duration-150 hover:bg-muted">

<!-- Loading spinner -->
<Loader2 class="h-4 w-4 animate-spin" />

<!-- Fade in (use Shadcn's animation classes) -->
<div class="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">

<!-- Skeleton pulse (built into Shadcn Skeleton) -->
<Skeleton class="animate-pulse" />
```

**Motion principles:**
- Duration: 150ms for hover/state changes; 200ms for appearing elements; 300ms for page transitions
- Never animate layout-affecting properties (`width`, `height`, `padding`) on the critical path — use `opacity` and `transform` only
- Reduce motion: wrap complex animations in `@media (prefers-reduced-motion: no-preference)` check

---

## Z-Index Scale

```ts
// tailwind.config.ts
extend: {
  zIndex: {
    base:    '0',
    raised:  '10',    // Cards on hover, sticky elements
    dropdown: '20',   // Dropdowns, popovers
    sticky:  '30',    // Sticky table headers, sidebar
    overlay: '40',    // Dialog backdrops
    modal:   '50',    // Dialogs, sheets
    toast:   '60',    // Toast notifications — always on top
  }
}
```

Use these tokens, never arbitrary z-index values. Shadcn's Radix components manage their own z-index within the `modal` and `overlay` range.

---

## Dark Mode

Dark mode is toggled via the `dark` class on the `<html>` element. Persist preference in `localStorage`. Follow OS preference as default.

```ts
// theme-provider.tsx (using next-themes)
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

All colour tokens are defined for both light and dark in `globals.css`. Never hardcode colour values in components — always use CSS variables (`bg-background`, `text-foreground`, `border`).

```html
<!-- ✅ Always use CSS variable tokens — works in both modes -->
<div class="bg-card text-card-foreground border rounded-lg">

<!-- ❌ Never hardcode — breaks dark mode -->
<div class="bg-white text-gray-900 border-gray-200">
```

# Mobile-First Guidelines — VividCRM

## Core Principle

**Write styles for mobile first. Add complexity upward.**

Every component, layout, and interaction is designed for a 375px viewport and then enhanced for wider screens. Never design for desktop and strip features for mobile — that is desktop-first and it always produces broken mobile UIs.

```css
/* ✅ Mobile-first — correct */
.element {
  /* Mobile base — no prefix */
  padding: 1rem;
  font-size: 0.875rem;
}
@media (min-width: 768px) { /* md: prefix in Tailwind */
  .element { padding: 1.5rem; font-size: 1rem; }
}

/* ❌ Desktop-first — wrong for this project */
.element { padding: 2rem; }
@media (max-width: 768px) { .element { padding: 1rem; } }
```

In Tailwind, this translates to:
```html
<!-- ✅ Correct: base class = mobile, prefixed = larger screens -->
<div class="p-4 text-sm md:p-6 md:text-base lg:p-8">

<!-- ❌ Wrong: no mobile base, overrides at small breakpoints -->
<div class="p-8 sm:p-4">
```

---

## Breakpoint System

Tailwind's default breakpoints — used consistently across the entire codebase:

| Token | Min Width | Target Device | CSS |
|---|---|---|---|
| (none) | 0px | Mobile phones (375–639px) | Base styles |
| `sm` | 640px | Large phones, small tablets | `@media (min-width: 640px)` |
| `md` | 768px | Tablets (768–1023px) | `@media (min-width: 768px)` |
| `lg` | 1024px | Small laptops, large tablets | `@media (min-width: 1024px)` |
| `xl` | 1280px | Desktop (1280–1535px) | `@media (min-width: 1280px)` |
| `2xl` | 1536px | Large desktop monitors | `@media (min-width: 1536px)` |

### Design Target Widths

| Screen | Design at | Notes |
|---|---|---|
| Mobile | 375px | iPhone SE / most Android phones |
| Mobile L | 390px | iPhone 14 reference device |
| Tablet | 768px | iPad mini / Android tablet |
| Tablet L | 1024px | iPad Air / large Android tablet |
| Desktop | 1280px | Standard laptop |
| Desktop L | 1440px | Most modern laptops |
| Desktop XL | 1920px | External monitors |

---

## Touch Target Standards

Every interactive element that a user might tap on mobile must meet these minimums. Failures here are the #1 cause of mobile usability complaints.

| Element | Minimum Touch Area | Minimum Visual Size |
|---|---|---|
| Button (primary) | 48×48px | 44×44px |
| Button (icon-only) | 48×48px | 40×40px |
| Link in a list | 48px height | 44px height |
| Checkbox / Radio | 44×44px | 20×20px (hit area extends via padding) |
| Toggle / Switch | 44×44px | Standard Shadcn Switch |
| Navigation tab | 48px height, full width | — |
| Table row action | 44×44px | 32×32px icon button with px-3 py-2 |
| Form input | 48px height | — |
| Select / Dropdown trigger | 48px height | — |

**Implementation pattern:**
```html
<!-- Icon-only button: visual icon is 16px, but tap area is 44×44px -->
<button class="flex items-center justify-center w-11 h-11 rounded-md hover:bg-muted">
  <MoreHorizontal class="h-4 w-4" />
</button>

<!-- List item: full-width tap area, 48px min height -->
<div class="flex items-center min-h-[48px] px-4 py-2 cursor-pointer hover:bg-muted">
  ...
</div>
```

---

## Viewport Configuration

```html
<!-- In Next.js layout.tsx — required -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
```

**Never use `maximum-scale=1` or `user-scalable=no`** — these prevent users from zooming, which is an accessibility violation and fails WCAG 1.4.4. iOS Safari ignores this restriction in iOS 10+, but it still harms Android users.

---

## Content Priority on Mobile

Desktop has space for everything simultaneously. Mobile requires prioritisation. Use this hierarchy:

### Priority Levels

**P1 — Always visible on mobile:**
- Primary data (the main thing the user came to see)
- Primary action button
- Status / key metric
- Navigation back

**P2 — Visible on scroll or secondary tab:**
- Secondary metadata
- Related records
- Activity feeds
- Filters (collapsed behind a button)

**P3 — Behind a drawer, modal, or "More" menu:**
- Advanced settings
- Bulk actions
- Secondary statistics
- Export options

### Example: Lead Detail Page

```
Mobile (375px)          Tablet (768px)          Desktop (1280px)
─────────────────       ────────────────         ──────────────────────────
[Back] Lead Name        [Breadcrumb: CRM > Lead] [Sidebar][Lead Name | Edit]
Status badge            [Edit] [Convert] [Del]   Status | Source | Created
[Edit button]           ──────────────────────── ─────────────────────────
──────────────          Name | Email | Phone      Name | Email | Phone
Name: Rahul Mehta       Company: StartupXYZ      Company: StartupXYZ
Email: rahul@...        ──────────────────────── ─────────────────────────
Phone: +91...           [Activities | Documents] [Activities]  [Documents]
──────────────          Tab content below         Side by side
[Activities]
[See all →]
```

---

## Thumb Zone Design

On mobile, users interact with thumbs. Elements requiring frequent interaction belong in the thumb zone.

```
Portrait Phone (390px wide)

     ┌─────────────────┐
     │  ╔═══════════╗  │  ← Hard to reach: settings, help
     │  ║ HARD ZONE  ║  │
     │  ╚═══════════╝  │
     │  ┌───────────┐  │
     │  │ NATURAL   │  │  ← Natural reach: primary content
     │  │ ZONE      │  │
     │  └───────────┘  │
     │  ╔═══════════╗  │  ← Easy zone: primary actions
     │  ║ EASY ZONE ║  │    (bottom nav, FAB, confirm buttons)
     │  ╚═══════════╝  │
     └─────────────────┘
```

**Application rules:**
- Bottom navigation bar lives in the **easy zone** — always reachable
- Primary CTA buttons (Save, Submit, Approve) placed at **bottom of screen** on mobile using fixed positioning or sticky footer
- Destructive actions (Delete, Reject) placed in the **hard zone** or behind a confirmation step — makes accidental triggers harder
- Filters and search: top bar is acceptable; alternative: floating bottom sheet

---

## Mobile Form Patterns

### Input Fields

```html
<!-- All inputs: 48px height, full-width by default -->
<Input class="h-12 text-base" />  <!-- text-base prevents iOS zoom on focus -->
```

**Critical:** Use `text-base` (16px) or larger on all mobile inputs. iOS Safari zooms in when an input's `font-size` is less than 16px. This disrupts the layout and frustrates users.

### Input Types — Always Specify

```html
<!-- Triggers numeric keyboard on mobile -->
<input type="tel" />       <!-- Phone numbers -->
<input type="number" />    <!-- Quantities, amounts -->
<input type="email" />     <!-- Email — triggers email keyboard -->
<input type="date" />      <!-- Date picker native to OS -->
<input type="search" />    <!-- Shows search/go key on keyboard -->
<input type="url" />       <!-- URL keyboard with . / com keys -->
```

### Autocomplete Attributes — Required

```html
<input autocomplete="email" />
<input autocomplete="name" />
<input autocomplete="tel" />
<input autocomplete="new-password" />
<input autocomplete="current-password" />
<input autocomplete="one-time-code" />  <!-- OTP fields -->
```

### Labels — Never Float on Mobile

```html
<!-- ✅ Always visible label above input -->
<div class="space-y-1.5">
  <Label htmlFor="email" class="text-sm font-medium">Email</Label>
  <Input id="email" type="email" class="h-12 text-base" />
  <p class="text-xs text-muted-foreground">We'll send notifications here.</p>
</div>

<!-- ❌ Floating label hides when filled — confusing on small screens -->
```

### Form Layout on Mobile

- **Single column always on mobile** — never two columns below `md`
- Fields stacked vertically with `space-y-4` between field groups
- Submit button at bottom, full-width: `<Button class="w-full h-12">`
- Validation errors appear immediately below the field, in red, with an icon

### Long Forms — Use Steps

Forms with more than 6 fields on mobile must be broken into steps (a stepper pattern). Never show a long scrolling form on mobile — it is overwhelming and error-prone.

```
Step 1: Basic Info    →    Step 2: Contact    →    Step 3: Review & Submit
[Progress: ●●○○]           [Progress: ●●●○]          [Progress: ●●●●]
```

---

## Gesture and Interaction Patterns

### Supported Gestures

| Gesture | Usage | Implementation |
|---|---|---|
| **Tap** | Primary interaction | Standard `onClick` |
| **Swipe left** | Delete / archive action on list items | Custom touch handler or library |
| **Swipe down** | Close bottom sheet / pull-to-refresh | Radix Dialog + CSS animation |
| **Long press** | Select mode in lists | `onTouchStart` + timeout |
| **Pinch** | Zoom on charts (Phase 2) | — |

### Swipe-to-Delete (List Items)

Swipe left on mobile list items to reveal quick actions (archive, delete). This mirrors the iOS mail/tasks pattern. Use sparingly — only on the most frequently actioned list types (tasks, notifications).

```
Normal:                     After swipe left 80px:
┌────────────────────┐      ┌─────────────────┬──────┬───────┐
│ Task: Login page   │      │ Task: Login page │ Edit │  Del  │
│ Arjun · Due Fri    │  ──▶ │ Arjun · Due Fri │  🖊  │  🗑  │
└────────────────────┘      └─────────────────┴──────┴───────┘
```

### Pull-to-Refresh

Implement on list views (Leads, Tasks, Notifications). Use TanStack Query's `refetch` triggered by a pull-down gesture.

---

## Performance — Mobile-Specific

### Image Handling

```html
<!-- Always use Next.js Image component — handles srcset + WebP + lazy load -->
<Image
  src={avatarUrl}
  alt={`${firstName} ${lastName}`}
  width={40}
  height={40}
  className="rounded-full object-cover"
/>
```

### Skeleton Loading — Never Blank Screens

```html
<!-- Show skeleton on initial load -->
{isLoading ? (
  <div class="space-y-3">
    <Skeleton class="h-12 w-full" />
    <Skeleton class="h-12 w-full" />
    <Skeleton class="h-12 w-3/4" />
  </div>
) : (
  <LeadList data={leads} />
)}
```

### Bundle Size

- No component imports from Shadcn that are not used in the page — each Shadcn component is individually imported
- No full lodash — use individual function imports or native alternatives
- Dynamic import for heavy components (rich text editor, PDF viewer, charts):

```ts
const InvoicePreview = dynamic(() => import('@/components/InvoicePreview'), {
  loading: () => <Skeleton className="h-96 w-full" />,
  ssr: false,
})
```

### Network Awareness

```ts
// TanStack Query config: fewer retries on mobile, shorter staleTime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds — reduce redundant refetches
      retry: 2,                // Mobile networks drop; retry twice
      refetchOnWindowFocus: false,  // Avoid refetch on every app switch
    },
  },
})
```

---

## Accessibility — Mobile Baseline

| Requirement | Standard | Implementation |
|---|---|---|
| Touch targets | 44×44px minimum | `min-h-[44px] min-w-[44px]` on interactive elements |
| Colour contrast | 4.5:1 for normal text, 3:1 for large | Use Shadcn's design system colours (WCAG AA compliant) |
| Focus indicators | Visible on keyboard navigation | Shadcn provides `:focus-visible` rings — never remove |
| Screen reader labels | Every icon-only button labelled | `aria-label="Delete lead"` on icon buttons |
| Dynamic content | Announced on change | Use `aria-live="polite"` for toast notifications |
| Error messages | Linked to input | `aria-describedby` + `aria-invalid` on error inputs |
| Semantic HTML | Proper heading hierarchy | `h1` per page, logical `h2`/`h3` nesting |

---

## Mobile Testing Checklist

Before shipping any screen, verify on:

- [ ] iPhone SE (375px) — the smallest supported device
- [ ] iPhone 14 (390px) — reference device
- [ ] iPad mini (768px) — tablet breakpoint
- [ ] Desktop Chrome 1280px — baseline desktop

Test scenarios:
- [ ] All form inputs: does iOS zoom trigger? (should not)
- [ ] All tap targets: can you tap accurately with a thumb at screen corners?
- [ ] All modals/sheets: can they be dismissed on mobile?
- [ ] Long text: does it wrap or overflow? Check names, email addresses, invoice numbers
- [ ] Tables: do they scroll horizontally or stack appropriately?
- [ ] Navigation: can the user reach every primary action without desktop hover states?

# Bids Page Clean Redesign - Product Requirements Document

## Overview
- **Summary**: Create a dedicated, polished `/app/bids` route page that replaces the current bids-at-`/app/orders` arrangement. The new page presents the Ugandan PPDA bids & procurement workflow with crystal-clear information hierarchy, minimal visual clutter, and premium micro-interactions — while strictly preserving the Queenstech default theme (brand gradient `from-[#003399] via-[#003399] to-[#004CCC]`, lucide-react icons, shadcn/ui components, and Tailwind utility conventions).
- **Purpose**: The current page mixes "Orders" and "Bids" terminology, shares a route with legacy sales-order semantics, and packs dense sub-workspaces (Documents/LPO/Orders/PPDA) that overwhelm first-time users. The redesign refactors everything under a dedicated `Bids` identity with focused tabs, staged information, and a "clear as new" aesthetic that makes tender status instantly legible.
- **Target Users**: Queenstech Admin, Manager, and Staff users who submit, evaluate, and track public and private bids under Ugandan PPDA (Public Procurement and Disposal of Public Assets Authority) regulations.

## Goals
- Deliver a dedicated `app.bids.tsx` route registered at `/app/bids` with a "clear as new" UI.
- Rename and re-space the page identity so every label says "Bids / Tenders / Solicitations" (not "Orders").
- Apply the standardized Hero Banner skeleton + 4 KPI cards + animated sliding tab bar pattern already used in the project.
- Reduce the tab surface to **3 focused tabs** — Pipeline (active bids), Compliance (PPDA checklist + Kanban), and Archive (awarded/declined) — replacing the current 4-tab Documents/LPO/Orders/PPDA sprawl.
- Add premium but unobtrusive micro-interactions: staggered row appearance with Framer Motion `staggerChildren`, hover lift on cards, accent left-stripes on table rows per status tone, glow indicators on KPIs with actionable hooks.
- Persist clickable-row interactions (row click → Preview dialog), `stopPropagation` guards on internal buttons, and role-based gates (Admin/Manager for advanced stage moves; Staff read-only for gated stages).
- Update every cross-reference in the codebase (Sidebar, BottomNav, Command Palette, Route Guard, Roles, Settings module picker) so "Bids" resolves to `/app/bids`.
- Keep the existing backend data contract (`SalesOrder` type, `getOrders`/`createOrder`/`updateOrder`/`deleteOrder` API) untouched — only the frontend presentation and route change.

## Non-Goals
- No backend API changes; no new database migrations.
- No changes to the actual `SalesOrder` / `OrderStatus` type definitions or values.
- No removal of existing functionality (documents, LPO accounts, PPDA compliance matrix) — only reorganization into cleaner tabs.
- No theme or color token changes; strictly the existing default theme.
- No changes to the `app.orders.tsx` route's contents other than adding a redirect from `/app/orders` → `/app/bids` (to preserve any deep links).

## Background & Context
- The Sidebar already labels the nav item "Bids" with the `Gavel` icon, but the actual route is `/app/orders`. The Settings module picker and role presets use "Bids" as the module name. This creates terminology drift the user explicitly flagged.
- Project convention (per `project_memory.md`): Hero Banners **must** use the gradient `from-[#003399] via-[#003399] to-[#004CCC]`, two `blur-3xl` ambient lighting orbs (one top-right, one bottom-left), and staggered `motion.section` entrance (`y: -6` to `0`).
- Project convention: Tab ordering for procurement pages previously required Documents → LPO → Orders. The new bids page reframes this into a more natural workflow: Pipeline → Compliance → Archive.
- Project convention: Row clicks on tables open a preview; internal buttons/selects `stopPropagation`; action buttons (Eye/Trash) use persistent ring/tint styling instead of hover-only.
- Project convention: Status color-coding follows Rose (overdue/declined), Emerald (awarded/complete/delivered), Amber (evaluation), Sky/Indigo/Violet (upstream stages: Advertised → Submitted e-GP → Bid Opened).

## Functional Requirements
- **FR-1 (Dedicated Bids Route)**: Create `app.bids.tsx` exporting `createFileRoute("/app/bids")` with `head: { title: "Bids & Tenders · Queenstech ERP" }`.
- **FR-2 (Hero Banner)**: Render a brand-gradient hero banner at the top of the page showing: (a) count of total bids + total tendered UGX value, (b) a contextual subtitle summary of active-in-evaluation / awarded-this-month / declined / overdue counts, (c) a "New Bid" CTA button.
- **FR-3 (KPI Strip)**: Render exactly 4 KPI cards directly below the hero: Total Tenders, Under Evaluation, Pipeline Stages, Compliance Gaps — each with a tone-matched tint, hover lift, and click-through jump to the relevant tab when applicable.
- **FR-4 (3-Tab Layout with Sliding Indicator)**: Render a pill-shaped tab bar with `layoutId`-based sliding indicator (Framer Motion) offering exactly three tabs: **Pipeline** (default), **Compliance**, **Archive**.
- **FR-5 (Pipeline Tab)**: Pipeline tab shows a search + status filter + overdue-toggle toolbar, then a clean table of active-pipeline bids (status in draft → contracts_cmte) with columns: LPO #, Date Received, Procuring Entity (renamed from Customer), Items Particulars, Submission Deadline, Handled By, Amount, Stage, Row Actions (Eye + Trash for Admin).
- **FR-6 (Compliance Tab)**: Compliance tab combines two sections stacked vertically: (1) PPDA 8-point statutory checklist matrix (TCC, NSSF, PPDA ROP, URSB, Audited Accts, Bid Security, PRN Fee, Declarations) with colored pill selects or badges per role, and (2) 12-stage PPDA lifecycle Kanban (draft → advertised → submitted_egp → bid_opened → tech_eval → fin_eval → evaluated → contracts_cmte → awarded → contract_signed → complete → declined), each column a scrollable mini-card with stage-move selects.
- **FR-7 (Archive Tab)**: Archive tab shows awarded, contract_signed, complete, and declined bids with a simplified, compact list-style layout (the "LPO submission history" row pattern) including compliance percentage bars, age badges, and color-coded left-stripes (emerald for success, rose for declined).
- **FR-8 (Row Clicks → Preview)**: Clicking any row in Pipeline or Archive opens the existing `OrderPreviewDialog` / `LpoSidePreviewSheet` experience; internal buttons and selects call `stopPropagation()`.
- **FR-9 (New Bid Form)**: "New Bid" in the hero and CTA in empty states open the existing `OrderFormSheet` / `CreateLpoAccountSheet` but relabel all fields to use bids terminology (e.g., "Procuring Entity" instead of "Customer", "Bid Amount" instead of "Fee / Amount").
- **FR-10 (Navigation Rebrand)**: Update Sidebar, BottomNav, Command Palette, `route-guard.ts`, `roles.ts`, and `UserAccountModal` settings select so all references to the Bids module resolve to `/app/bids`.
- **FR-11 (Legacy Redirect)**: Update `app.orders.tsx` to redirect to `/app/bids` on mount (TanStack Router `useNavigate` + `useEffect`) so deep links to `/app/orders` do not break.
- **FR-12 (Role Gates)**: Restrict (a) delete-bid button to Admin only, (b) stage-moves past "Evaluated" (contracts_cmte, awarded, contract_signed) to Admin/Manager only, (c) compliance checklist editing to Admin/Manager only, matching the existing `canManageDocs = isAdmin || isManager` pattern.

## Non-Functional Requirements
- **NFR-1 (React Hook Safety)**: All `useState`, `useMemo`, `useEffect`, `useCallback` declarations appear before any conditional early returns (guards pattern per project memory).
- **NFR-2 (Animation Performance)**: Stagger entrance animations use `Math.max(0, index)` guards to avoid negative animation delays; table rows stagger the first 80 rows only.
- **NFR-3 (Accessibility)**: Interactive elements use semantic button/select elements; status badges carry `title` attributes with full PPDA stage descriptions; colors meet 4.5:1 contrast (Rose 600, Emerald 700, Amber 600 on white).
- **NFR-4 (Type Safety)**: 100% of the new route file uses explicit TypeScript types inferred from `@/types/sales-order`; no `any` casts.
- **NFR-5 (Consistent Styling)**: Preserve explicit pixel-precise Tailwind values (e.g., `w-[480px]`, `max-w-[560px]`) matching the brand 4px/8px grid per project memory.
- **NFR-6 (Polish Density)**: Every container uses the 2xl rounded corners (`rounded-2xl`), `shadow-xs` or calculated elevation, and Framer Motion easing `[0.22, 1, 0.36, 1]` for a premium non-linear feel.

## Constraints
- **Technical**: Must use existing dependencies only (React 19, Vite 7, TanStack Router, Framer Motion 11, shadcn/ui, sonner, lucide-react). No new npm installs.
- **Business**: Ugandan PPDA 12-stage lifecycle and 8-document statutory checklist must remain intact; PPDA §16(2) Admin/Manager gate on advanced stage transitions preserved.
- **Dependencies**: Reuses `getOrders`, `createOrder`, `updateOrder`, `deleteOrder`, `getAllDocuments`, `getOrderDocuments`, `uploadOrderDocument`, `deleteOrderDocument`, `getCustomers`, `getEmployees`, `getItems` from `@/services/api`.

## Assumptions
- The existing `SalesOrder` data shape (including `ppdaCompliance`, `accountDetails`, `requiredDocumentTypes`, `complaints`) is sufficient and does not need to change.
- The existing sub-components (`OrderFormSheet`, `OrderPreviewDialog`, `DeclineReasonDialog`, `LpoSidePreviewSheet`, `CreateLpoAccountSheet`, `DocumentsWorkspace`, `PpdaComplianceWorkspace`) can be inlined or re-exported with label adjustments in the new route file; if they're defined locally in `app.orders.tsx` the same definitions will be carried forward with bids-local terminology.
- The `routeTree.gen.ts` auto-generation in Vite/TanStack Router will pick up the new `app.bids.tsx` file after it exists on disk.

## Acceptance Criteria

### AC-1: Dedicated bids route exists and is registered correctly
- **Type**: `rule`
- **Given**: The frontend codebase contains a valid TanStack Router file
- **When**: A developer opens `frontend/src/routes/app.bids.tsx`
- **Then**: The file exports `Route = createFileRoute("/app/bids")` and the page title head meta is "Bids & Tenders · Queenstech ERP"
- **Pass Condition**: File exists, route path matches `/app/bids`, title meta is set
- **Evidence**: Source code inspection of `app.bids.tsx` lines 1-40

### AC-2: Hero banner conforms to the standardized brand skeleton
- **Type**: `rule`
- **Given**: The Bids page renders in a browser
- **When**: The top section of the page is inspected
- **Then**: It uses a `motion.section` with entrance `y: -6 → 0`, the gradient `from-[#003399] via-[#003399] to-[#004CCC]`, two `blur-3xl` orbs (top-right and bottom-left), displays total-bids count and total tendered value in the h2, a contextual summary paragraph, and a white "New Bid" CTA with Gavel/Plus icon
- **Pass Condition**: All five skeleton elements match (motion section, gradient, 2 orbs, stats, CTA)
- **Evidence**: Source code inspection of the JSX block within the BidsPage return value

### AC-3: Four KPI cards render with tones and click-through jumps
- **Type**: `rule`
- **Given**: The Bids page renders with at least one bid in state
- **When**: The KPI strip below the hero is observed
- **Then**: Exactly 4 cards are present labeled Total Tenders (brand tone), Under Evaluation (amber), Pipeline Stages (blue clickable → Compliance tab), Compliance Gaps (rose if >0 else emerald clickable → Compliance tab); each card has the KpiCard tone gradient-blur accent and hover lift
- **Pass Condition**: Count is 4; labels and tones match; Pipeline and Compliance Gaps cards have non-null onClick handlers
- **Evidence**: DOM inspection (4 cards) + source code `KpiCard` invocations

### AC-4: Three-tab pill bar with sliding `layoutId` indicator renders correctly
- **Type**: `rule`
- **Given**: The Bids page is mounted
- **When**: The tab bar directly below KPIs is examined
- **Then**: It renders a rounded-full pill container with exactly three tabs in order **Pipeline, Compliance, Archive**; the active pill uses Framer Motion `layoutId="bids-tab-slider"` with spring stiffness 500 damping 40; inactive tab labels are muted-foreground; active label is white on `bg-[#003399]` pill
- **Pass Condition**: Tab count = 3, order matches, `layoutId="bids-tab-slider"` present, active style matches spec
- **Evidence**: Source code of the tab bar JSX block

### AC-5: Pipeline table has the required 9 columns and row-click preview
- **Type**: `rule`
- **Given**: The Pipeline tab is active and at least one pipeline bid exists
- **When**: The table is rendered
- **Then**: Column headers appear exactly as: LPO #, Date Received, Procuring Entity, Items, Submission Deadline, Handled By, Amount, Stage, Actions (right-aligned); clicking a table row opens the preview dialog; clicking the inline Stage select or Handled By select or Eye/Trash buttons does NOT trigger row preview
- **Pass Condition**: 9 columns with exact labels; `onClick` on `<TableRow>`; `stopPropagation()` invoked on internal interactive TDs
- **Evidence**: Table header source and per-row onClick + stopPropagation calls

### AC-6: Compliance tab contains the 8-point matrix AND 12-stage Kanban
- **Type**: `rule`
- **Given**: The Compliance tab is active
- **When**: The two sections are observed
- **Then**: Section 1 displays a table with 8 columns (TCC, NSSF, PPDA, URSB, AUD, SEC, PRN, DEC) each with ComplianceStatus pill selects or read-only badges per `canManageDocs`; Section 2 displays a horizontal auto-cols grid of exactly 12 Kanban columns matching the 12 `OrderStatus` entries in STATUS_META, each column a scrollable card with header + count chip + stage-move select on each bid card
- **Pass Condition**: Section 1 has 8 checklist columns; Section 2 has exactly 12 Kanban columns in correct stage order
- **Evidence**: Source code of Compliance tab block

### AC-7: Archive tab contains compact list with compliance bars and left-stripes
- **Type**: `rule`
- **Given**: The Archive tab is active with at least one declined or awarded bid
- **When**: The list rows are observed
- **Then**: Each row shows a left-stripe shadow tint (emerald for awarded/complete, rose for declined), an age badge ("Today" / "14d ago"), a compliance percentage bar with animated width, and a right-aligned Eye action; clicking the row opens preview
- **Pass Condition**: Left-stripe via `shadow-[inset_3px_0_0_*]`, animated motion.div compliance width >=1, Eye button present
- **Evidence**: Archive tab list row JSX

### AC-8: All navigation cross-references point to /app/bids
- **Type**: `rule`
- **Given**: A codebase-wide search for the old bids-related path
- **When**: Searching `"/app/orders"` in Sidebar, BottomNav, palette-pages, route-guard, roles, UserAccountModal
- **Then**: Every UI-facing navigation reference to the Bids module resolves to the new `/app/bids` path; the only remaining `/app/orders` reference is the redirect in `app.orders.tsx` and the auto-generated `routeTree.gen.ts`
- **Pass Condition**: Sidebar.tsx, BottomNav.tsx, palette-pages.tsx, route-guard.ts, roles.ts, UserAccountModal.tsx all use `/app/bids` for the Bids module entry; `app.orders.tsx` contains a useEffect navigate call to `/app/bids`
- **Evidence**: Grep results across the 6 files + redirect source

### AC-9: Advanced stage moves and deletes are correctly role-gated
- **Type**: `rule`
- **Given**: A non-Admin/Manager Staff user is viewing the Bids page
- **When**: They attempt to (a) stage-move a bid to contracts_cmte/awarded/contract_signed, (b) click the Trash icon, (c) edit the PPDA compliance checklist selects
- **Then**: (a) The SelectItems for those 3 gated stages have `disabled={!canManageDocs}` with a ShieldAlert badge; (b) The Trash2 button is either absent or `disabled && aria-hidden`; (c) Compliance checklist renders read-only badges instead of `<Select>` components
- **Pass Condition**: All 3 gates are present with the `canManageDocs = isAdmin || isManager` boolean
- **Evidence**: Source code gating at Trash button, gate stage disabled prop, and Compliance section conditional rendering

### AC-10: React Hook safety — no conditional hooks
- **Type**: `rule`
- **Given**: The full `app.bids.tsx` source file
- **When**: Scanning for hook declarations (`useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`) vs. conditional early returns (`if (!data) return null` patterns)
- **Then**: Every hook declaration lexically precedes every early return; no hook declared inside a branch
- **Pass Condition**: Static inspection passes; ESLint `rules-of-hooks` would accept
- **Evidence**: Source code hook ordering section; optionally `npx eslint frontend/src/routes/app.bids.tsx` with rules-of-hooks enabled

### AC-11: Visual polish and micro-interactions quality
- **Type**: `rubric`
- **Dimension**: Perceived UI clarity, motion refinement, and "clear as new" feel
- **Scale**: 1-5
- **Anchors**:
  - 1 = Barebones table, no motion, inconsistent spacing, raw labels still say "Orders/Customers"
  - 3 = Functional layout, basic spacing, a few animations, terminology half-updated
  - 5 = Crystal clear hierarchy, every micro-label says "Bid / Procuring Entity / Solicitation", staggered row entrance feels premium, hover lifts and left-stripes are subtle but present, tab slide is buttery, KPIs have ambient glow hover states
- **Pass Threshold**: >= 4
- **Evidence**: Visual comparison screenshot + source code confirmation of `staggerChildren` variants on at least Pipeline table rows and Archive list rows, `whileHover={{ y: -2 }}` on KpiCards and Kanbid bid cards, `layoutId` tab indicator spring

### AC-12: Terminology consistency across the entire Bids page
- **Type**: `rubric`
- **Dimension**: Terminology uniformity (bids/procurement language vs. legacy orders/sales language)
- **Scale**: 1-5
- **Anchors**:
  - 1 = Still says "Customer / Order / Fee Amount / Sale" in 50%+ of labels
  - 3 = Mixed: hero and buttons use "Bid", but dialogs/forms still say "Customer/Order"
  - 5 = 100% consistent: "New Bid", "Procuring Entity", "Bid Amount", "Submission Deadline", "Solicitation Stage", "Handled By (Bid Manager)", PPDA section § references intact
- **Pass Threshold**: >= 4
- **Evidence**: Grep of `app.bids.tsx` for legacy terms ("customer", "order", "sale") in user-facing strings vs. bids-native terms; count residual occurrences

## Open Questions
- [x] Should the old `/app/orders` route keep working for deep links? → **Yes** via redirect on mount.
- [x] Are the existing Documents workspace and LPO-Account creation flows still required in the new Bids page? → **Yes** — they are surfaced as secondary CTAs inside the Pipeline tab toolbar and the preview sheet, and the Compliance tab embeds the PPDA matrix + Kanban.

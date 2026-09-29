# Bids Page Clean Redesign - Implementation Plan

## Task 1: Create the new app.bids.tsx route skeleton with Hero Banner + KPI Strip + Tab Bar
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Copy the structural skeleton from `app.orders.tsx` into a new file `frontend/src/routes/app.bids.tsx`.
  - Update `createFileRoute("/app/orders")` to `createFileRoute("/app/bids")`.
  - Update page `head` title meta to "Bids & Tenders · Queenstech ERP".
  - Replace all user-facing terminology: "Customer" → "Procuring Entity", "Order" → "Bid", "LPO Account" → "Tender Account", "Fee / Amount" → "Bid Amount", "dateToBeDelivered" label → "Submission Deadline", "dateReceived" label → "Date Received / Advertised".
  - Build the Hero Banner: brand gradient `from-[#003399] via-[#003399] to-[#004CCC]`, 2 `blur-3xl` white/5 orbs, staggered `motion.section` entrance `y:-6→0`, display total bids count + total UGX value in h2, contextual summary with awarded/declined/overdue, white "New Bid" CTA with Plus/Gavel icon.
  - Build the 4 KPI cards: Total Tenders (brand tone), Under Evaluation (amber), Pipeline Stages (blue tone, click jumps to Compliance tab), Compliance Gaps (rose/emerald conditional, click jumps to Compliance tab).
  - Build the 3-tab pill bar (Pipeline → Compliance → Archive) using Framer Motion `layoutId="bids-tab-slider"` with spring transition; tab labels include live counts: `Pipeline (N)`, `Compliance`, `Awarded/Declined (A/D counts)`.
  - Ensure ALL hooks (useState, useMemo, useEffect, useCallback, useRef) are declared BEFORE any conditional early return — wrap components in outer/inner pattern if needed.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-10, AC-12
- **Test Requirements**:
  - `rule` TR-1.1: File `app.bids.tsx` exists, route registered to `/app/bids`, head title is "Bids & Tenders · Queenstech ERP". Evidence: file exists and line inspection.
  - `rule` TR-1.2: Hero banner has correct 5 skeleton parts (motion, gradient, 2 orbs, stats h2+p, CTA). Evidence: source grep.
  - `rule` TR-1.3: Exactly 4 KpiCards with tones brand/amber/blue/(rose|emerald); Pipeline and Compliance cards have non-undefined onClick that calls `setActiveTab("compliance")`. Evidence: source of KpiCard invocations.
  - `rule` TR-1.4: Tab bar has 3 tabs in order Pipeline, Compliance, Archive and `layoutId="bids-tab-slider"` with spring `stiffness:500 damping:40`. Evidence: tab map source.
  - `rule` TR-1.5: Every hook declaration precedes every early return in top-level BidsPage and every sub-component in the file. Evidence: static line-order scan.
  - `rubric` TR-1.6: Terminology consistency across skeleton (hero, kpis, tabs); scale 1-5; anchors 1=legacy terms dominate / 3=mixed / 5="Bid","Procuring Entity","Tender" throughout; threshold >= 4; evidence: grep count of legacy user-facing strings vs. new strings.

## Task 2: Implement the Pipeline tab — searchable table with stage badges, row click → preview, role-gated actions
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Set `activeTab === "pipeline"` as default.
  - Pipeline filters row: search Input with Search icon (LPO / procuring entity / quotation / handler), status Select (all statuses via STATUS_META or active-pipeline only), "Overdue only" toggle chip that appears as a dismissible Button when active.
  - Pipeline table filters bids to statuses ∈ {draft, advertised, submitted_egp, bid_opened, tech_eval, fin_eval, evaluated, contracts_cmte}.
  - Table column headers in order: LPO #, Date Received, Procuring Entity, Items, Submission Deadline, Handled By, Amount, Stage, Actions.
  - Each `<TableRow>` has `cursor-pointer group` and `onClick={() => setPreviewOrder(o)}` with the inset-3px-left accent shadow on hover (`inset_3px_0_0_rgba(0,51,153,0.5)`).
  - Overdue rows get Rose left-stripe; delivered/awarded get Emerald.
  - Handled By column: clickable inline Select (if `canManageDocs`) with avatar initials chip, else read-only avatar + label. `onClick` on the `<TableCell>` calls `e.stopPropagation()`.
  - Stage column: inline Badge-wrapped Select with `stopPropagation` on TD; advanced gated stages (contracts_cmte, awarded, contract_signed) have `disabled={!canManageDocs}` SelectItems with ShieldAlert badge PPDA §16(2).
  - Actions column (right-aligned): Eye button (persistent ring, `bg-[#003399]/5 ring-1 ring-[#003399]/15 hover:...`) opens preview; Trash2 button (role-gated to Admin only, destructive tone) calls `handleDelete(id)`. Both buttons have `onClick(e) { e.stopPropagation(); ... }`.
  - Staggered row entrance: `staggerChildren` variants with per-row delay `Math.max(0, Math.min(idx, 80)) * 0.04s`.
  - Empty state: `EmptyState` component with Gavel icon, "No active bids in pipeline" copy + "New Bid" CTA linking to the form sheet.
  - Bring forward the existing handlers: `handleCreate`, `handleStatusChange` (with DeclineReasonDialog for declined→reason), `handleUpdateOrder`, `handleHandledByChange`, `handleDelete`.
- **Acceptance Criteria Addressed**: AC-5, AC-9 (delete + stage gates), AC-11 (motion & hover)
- **Test Requirements**:
  - `rule` TR-2.1: Table has exactly 9 columns with labels as specified; `stopPropagation()` appears on Handled By TD, Stage TD, and Actions TD `onClick` wrappers. Evidence: source grep.
  - `rule` TR-2.2: Row has `onClick={() => setPreviewOrder(o)}`; Eye and Trash buttons have `e.stopPropagation()` inside their handlers. Evidence: source.
  - `rule` TR-2.3: Trash2 button wrapped in `{isAdmin && (...)}`. Evidence: source.
  - `rule` TR-2.4: Stage SelectItems for contracts_cmte / awarded / contract_signed include `disabled` gated to `!canManageDocs` and PPDA §16(2) ShieldAlert badge. Evidence: SelectItem source.
  - `rubric` TR-2.5: Row-level micro-interactions polish; scale 1-5; anchors 1=no animation/plain rows / 3=basic hover / 5=staggered entrance + left-stripe tint + hover shadow + subtle scale on chips; threshold >= 4; evidence: variants source + screenshot.

## Task 3: Implement the Compliance tab — 8-point PPDA matrix + 12-stage Kanban
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Reuse the `activeTab === "compliance"` block.
  - Section 1 header: "Section 1 · Compliance Overview — Open Tenders (N)" with ClipboardList icon + brand gradient strip. If not `canManageDocs`, show a rose-tinted "Edits restricted · PPDA §16(2)" chip with ShieldAlert.
  - Section 1 matrix: 8 checklist columns (short labels TCC, NSSF, PPDA, URSB, AUD, SEC, PRN, DEC) matching `complianceFields` keys. For each open tender row, render a `<Select>` with `chipCls` (emerald/amber/rose/slate) pill styling if `canManageDocs`, otherwise render read-only chip-badge with ShieldAlert lock. `onValueChange` writes through `handleUpdateOrder` to `ppdaCompliance[field]`.
  - Section 2 header: "Section 2 · 12-Stage PPDA Lifecycle Kanban" with FolderKanban icon + bid count monospaced.
  - Section 2 Kanban: Horizontal grid `auto-cols-[minmax(220px,1fr)]` of 12 columns matching `stageCols`. Each column: colored stage icon, label, count chip. Empty columns show dashed "Empty" placeholder. Bid mini-cards inside columns: LPO # mono, customer truncated, amount mono, inline "Move to stage →" Select. Advanced gated stages have the same `disabled={!canManageDocs}` + ShieldAlert pattern as Task 2.
  - Stagger each Kanban column entrance by `0.03 * cIdx` seconds.
  - Optional: if the previous `PpdaComplianceWorkspace` component existed, ensure it's appended below Section 2 for completeness.
- **Acceptance Criteria Addressed**: AC-6, AC-9 (compliance edit gates)
- **Test Requirements**:
  - `rule` TR-3.1: Section 1 table has 8 compliance checklist columns with short labels; admin/manager sees `<Select>` per cell, staff sees read-only `<span>` badge with ShieldAlert. Evidence: conditional render source.
  - `rule` TR-3.2: Section 2 grid has exactly 12 columns, in the exact 12-stage order. Evidence: `stageCols.length === 12` and column map matches STATUS_META keys.
  - `rule` TR-3.3: "Move to stage" Select inside Kanban mini-cards disables contracts_cmte+ stages for non-managers. Evidence: SelectItem disabled source.
  - `rubric` TR-3.4: Kanban visual density; scale 1-5; anchors 1=clipped / 3=functional but dense / 5=airy padding, hover lift on bid cards, empty dashed states, color-coded column icons; threshold >= 4; evidence: screenshot + column JSX source.

## Task 4: Implement the Archive tab — compact list with compliance progress bars, age badges, left-stripes
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1, Task 2
- **Description**:
  - `activeTab === "archive"` block.
  - Intro card: "Archive · Awarded & Closed Bids" with Trophy/XCircle icons; summary: N awarded, M declined, total value of awarded. Quick CTA: "Jump to Pipeline" (switch tab) + "Export CSV" (optional but `window.print()` friendly placeholder).
  - Compact 8-column grid rows per archived bid: grip-dot + LPO + ageBadge / Procuring Entity + amount / Handled By avatar / StatusBadge / Dates (received-MM-DD + deadline-MM-DD + days-remaining copy) / Compliance score (animated progress bar, emerald/amber/rose per %) / Eye action.
  - Left-stripe per row: `shadow-[inset_3px_0_0_rgba(16,185,129,0.6)]` for awarded/contract_signed/complete; `shadow-[inset_3px_0_0_rgba(244,63,94,0.65)]` for declined.
  - Background tint row bg: `bg-emerald-500/[0.025]` or `bg-rose-500/[0.025]` for the 2 respective tone groups.
  - Age badge logic: `ageDays === 0 → "Today" emerald chip else "Xd ago" muted chip`.
  - Compliance progress bar width animated with `motion.div initial={{ width: 0 }} animate={{ width: ${pct}% }}`.
  - Row click opens preview; Eye button `stopPropagation`.
  - Staggered entrance same as pipeline (`max(0, min(idx,80)) * 0.04`).
  - Empty state: Trophy + FileX icons → "No awarded or declined bids yet — move bids through the pipeline to archive them here."
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-4.1: Archived rows include conditional left-stripe for emerald-vs-rose tones via `shadow-[inset_3px_0_0_...]`. Evidence: className ternary source.
  - `rule` TR-4.2: Compliance score bar uses `motion.div` with width animation from 0 to score%. Evidence: motion.div + animate prop.
  - `rule` TR-4.3: Archive filter covers statuses: awarded, contract_signed, complete, declined. Evidence: filter predicate source.
  - `rubric` TR-4.4: Archive list clarity; scale 1-5; anchors 1=dense messy table / 3=readable list / 5=gap-optimized grid, age badge, date stack, color cues instantly legible; threshold >= 4; evidence: screenshot.

## Task 5: Wire up form sheets, preview dialogs, and decline-reason flow with bids-native labels
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 3, Task 4
- **Description**:
  - Reuse / bring forward the following sub-components from `app.orders.tsx` local definitions into `app.bids.tsx`, relabeling all user-facing strings:
    - `OrderFormSheet` → `BidFormSheet` (rename component, "Create Bid" title, "Procuring Entity" label for customer dropdown, "Bid Amount" label, "Submission Deadline" label, remove any "Sale/Order" copy).
    - `OrderPreviewDialog` → `BidPreviewDialog` (same relabeling; keep PPDA section).
    - `DeclineReasonDialog` (rename title to "Decline / Disqualify Bid (LPO xxx)"; placeholder text mentions failed tech evaluation, PPDA non-compliance, pricing non-responsive).
    - `LpoSidePreviewSheet` → `TenderSidePreviewSheet` (relabel Section 1: Account Financials & Timeline → Bid Financials & Submission Timeline; Fee/Amount → Bid Amount; Deadline → Submission Deadline; Sections 2/3 kept but title relabeled; footer keep status Select).
    - `CreateLpoAccountSheet` → `CreateTenderAccountSheet` (same relabeling).
  - Reuse `DocumentsWorkspace` from the existing file or inline it; add tab-switch CTA if the user needs document management (since Documents was collapsed into Compliance as a sub-section, the workspace can be either a nested section or a collapsed "Manage Documents" expander in the Compliance tab sidebar area; keep it accessible via preview sheet attachment actions).
  - Ensure form submission logic (`handleCreate`, `handleUpdateOrder`) is placed BEFORE the component's return statement per project rules (no unreachable code).
  - Ensure single-root JSX is satisfied using `React.Fragment` or `<>...</>` when multiple sheets/dialogs are siblings.
  - `migrateOrder` helper and `nextLpo` helper are brought forward unchanged (backend data contract compatibility).
  - `PpdaPreferenceBadge` (Micro-procurement / Local Preference +N% badges) keep and show next to Stage badge in Pipeline and Archive rows.
- **Acceptance Criteria Addressed**: AC-8 partially (redirect TBD), AC-9 (decline flow), AC-10 (hook order), AC-12
- **Test Requirements**:
  - `rule` TR-5.1: Each of the 5 sheet/dialog components exists in `app.bids.tsx` or is imported and re-used; every legacy user-facing "Customer"/"Order" label is replaced with bids terminology. Evidence: grep user-facing strings (JSX text nodes, labels, placeholders, titles).
  - `rule` TR-5.2: Decline status transition opens DeclineReasonDialog when reason empty; onConfirm writes declineReason to payload. Evidence: `handleStatusChange` source has `if (status === "declined" && !declineReason) setDeclineDialogTarget`.
  - `rule` TR-5.3: Submit logic of `BidFormSheet` and `CreateTenderAccountSheet` sits lexically before each component's `return (...)`. Evidence: static order check.
  - `rule` TR-5.4: Multiple root-level sheets/dialogs wrapped in Fragment or a single parent. Evidence: no "Adjacent JSX elements" issue in source.

## Task 6: Redirect old route, update all navigation cross-references (Sidebar, BottomNav, Palette, Roles, Route Guard, Settings)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Update `frontend/src/routes/app.orders.tsx`: On mount, `useEffect(() => { navigate({ to: "/app/bids", replace: true }); }, [])` using TanStack Router `useNavigate`. Keep the file a thin shim only — remove inline components to avoid duplication; optionally re-export sub-components if they are still imported elsewhere.
  - Update `frontend/src/components/layout/Sidebar.tsx`: Line 46 `{ label: "Bids", href: "/app/bids", icon: Gavel }`.
  - Update `frontend/src/components/layout/BottomNav.tsx`: Line 14 `{ label: "Bids", href: "/app/bids", icon: Gavel }`.
  - Update `frontend/src/components/command/palette-pages.tsx`: Line 34 `{ label: "Bids", path: "/app/bids", icon: <Gavel ... /> }`.
  - Update `frontend/src/lib/route-guard.ts`: Line 7 add `"/app/bids": ["admin", "manager", "staff"], // Bids` (keep the old /app/orders line for backward compat of the redirect shim if needed).
  - Update `frontend/src/lib/roles.ts`: Line 15 `{ id: "orders", name: "Bids", path: "/app/bids", ... }` (keep id stable to avoid breaking stored role presets that reference "orders").
  - Update `frontend/src/components/settings/UserAccountModal.tsx`: The SelectItem line with value="/app/orders" → value="/app/bids" label="Bids".
  - Verify in-IDE Go-To-Definition on the Gavel sidebar nav correctly resolves to `/app/bids`.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-6.1: `/app/orders` redirects to `/app/bids` on mount (navigate + replace:true). Evidence: redirect useEffect source.
  - `rule` TR-6.2: All 6 files (Sidebar, BottomNav, palette-pages, route-guard, roles, UserAccountModal) use `/app/bids` for the Bids module nav path. Evidence: per-file grep.
  - `rule` TR-6.3: roles.ts module id stays "orders" (back-compat) while path changes to "/app/bids". Evidence: roles.ts diff.

## Task 7: Verification pass — lint, typecheck, visual smoke test
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1-6
- **Description**:
  - In the `frontend/` directory, run `npm run lint` (or the configured lint command from `package.json` scripts) specifically on the new/changed files: `app.bids.tsx`, `app.orders.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `palette-pages.tsx`, `route-guard.ts`, `roles.ts`, `UserAccountModal.tsx`.
  - Run TypeScript typecheck `npx tsc --noEmit` (or `npm run typecheck`) for the frontend; ensure no new errors introduced.
  - GetDiagnostics tool run on `app.bids.tsx` to surface IDE-level issues.
  - Optionally, start the dev server (`npm run dev` from `frontend/`) and confirm the Bids nav item in Sidebar and BottomNav resolve to `/app/bids`; check that hero renders, tabs slide, clicking rows opens preview.
  - Fix any residual issues found.
- **Acceptance Criteria Addressed**: AC-10, NFR-1, NFR-4
- **Test Requirements**:
  - `rule` TR-7.1: Lint passes (exit code 0) on changed files. Evidence: terminal command output.
  - `rule` TR-7.2: TypeScript `--noEmit` passes on the frontend. Evidence: tsc output.
  - `rule` TR-7.3: GetDiagnostics for `app.bids.tsx` returns 0 errors. Evidence: diagnostics tool output.
  - `rubric` TR-7.4: Overall first-glance impression; scale 1-5; anchors 1=broken / 3=works but rough / 5=buttery motion, no flicker, correct terminologies; threshold >= 4; evidence: dev-server visual smoke test notes.

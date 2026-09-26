# Orders Page — LPO 3-status lifecycle, Decline Reason, Preview (income + complaints), New-order LPO auto-fetch

## Problem
The existing Orders page has an Orders tab, an LPO tab, and a Documents tab. The LPO tab currently renders internal Order-status values (`draft | confirmed | in_progress | delivered | cancelled`) that are designed for order-management detail work, not the procurement / accounts clerk's LPO-audit mental model of a three-phase approval cycle. The current "New sales order" flow requires manual entry of the LPO number even though every LPO in the system already lives in the same database with an associated customer name — resulting in duplicate work and mismatches. The `OrderPreviewDialog` shows particulars and totals but does not show a per-order income summary or any complaints against the order, which is the main audit surface.

## Users & Goals
- **Accounts / Records clerk**: reviews LPO history using a 3-phase Submitted → Declined (with reason) / Successful lifecycle; opens LPO preview to read income and any filed complaints; creates new sales orders by selecting an already-submitted LPO from the system (no manual typing of LPO or customer name, since those are already known).
- **Manager / Admin**: same workflow, plus authority to mark an LPO as Declined with a reason (and later edit the reason), plus an admin-only override to manually enter a free-form LPO number when needed.
- **Procurement lead**: scans the LPO audit list for successful vs declined LPOs, quickly reads the decline reason, and can monitor the per-order income/complaints signal in the preview.

## Goals
1. **Replace the global `OrderStatus` type** with the 3-value LPO lifecycle `submitted | declined | successful` everywhere: type definition, STATUS_META, Orders-tab selectors, LPO-tab KPIs, LPO-tab history badges, LPO-tab compliance tint, preview dialog header badge.
2. **Decline reason**: when setting an LPO to `declined`, require a free-text `declineReason` field (with an inline AlertDialog or input prompt) and render it in the LPO row (2nd line) + preview dialog (its own section).
3. **LPO Preview Dialog redesign**: keep existing meta/particulars/totals/timeline sections and ADD three new sections: (a) Orders under this LPO (the line-items table is already there — rename and add a header indicating these are the orders/items), (b) a "Total income" KPI hero (UGX total, +% if available), (c) a "Complaints per order" section with complaint counter, complaint add CTA, and a list of inline complaints (stored on `SalesOrder.complaints`).
4. **New sales order form flow — NO manual LPO input**: replace the manual LPO `<Input>` with a two-path flow: (path A, default) **Select existing submitted LPO from the orders database** via a searchable `<Select>` that lists all LPOs currently `status === "submitted"`; picking one auto-fills the LPO number (read-only) AND the customer name (read-only, synced from the selected LPO's customerName). (path B) **Admin-only manual override**: an admin/manager can toggle "Manual LPO entry" to input LPO number + customer name freely.
5. Apply #thinkx100 / #becreative polish throughout the new pieces: staggered entry on decline-reason modal, gradient tint orbs in income hero, complaint micro-interactions, spring-animate the LPO-customer sync lock-in, etc.

## Non-Goals
- No backend API changes; all status/reason/complaints edits optimistically update the frontend orders state (existing `updateOrder(id, updates)` flow remains the API contract). Any missing backend fields for `declineReason` / `complaints` / new statuses are tolerated with a frontend-first fallback (fields added to local types, persisted locally via the same createOrder/updateOrder PATCH flow that already exists).
- No changes to Documents workspace; keep Tasks 1–5 from prior spec intact (two-category lists unchanged).
- No changes to branch switching, employee scoping, role hooks beyond the new `isAdmin || isManager` gate on decline-reason authoring and manual LPO override.
- No separate LPO entity distinct from `SalesOrder` — LPOs are a view layer on top of SalesOrder rows with a 3-status lifecycle.

## Functional Requirements
### FR-1 OrderStatus replacement (3-value LPO lifecycle)
- **Replace type**: `OrderStatus` in [sales-order.ts](file:///d:/House/qterp/frontend/src/types/sales-order.ts#L1-L1) changes from `draft | confirmed | in_progress | delivered | cancelled` → `"submitted" | "declined" | "successful"`.
- **Add `declineReason?` field** to `SalesOrder` interface: `declineReason?: string | null;` (free text, max ~500 chars).
- **STATUS_META rewrite** in `app.orders.tsx` at [L89](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L89-L95) — all three statuses:
  - `submitted`: label "Submitted", cls amber/yellow tint, icon `Clock` / `FileText` with clock.
  - `declined`: label "Declined", cls rose/destructive tint, icon `XCircle` / `AlertTriangle` with a "Reason" micro label.
  - `successful`: label "Successful", cls emerald/success tint, icon `CheckCircle2` / `Check`.
- **Orders tab**:
  - Status dropdown selector on each row (`<Select>` at ~L635) uses the new 3 values only.
  - Status filter `<Select>` at ~L330 uses the new 3 values + "All statuses".
  - Hero dashboard stats KPIs (`dashboardStats` at ~L184) recompute using `submitted / declined / successful` counts (no draft/confirmed anymore).
- **LPO tab**:
  - 4 KPI chips at ~L952 rewrite to: Total LPOs, Submitted (status=submitted), Successful (status=successful), Declined (status=declined).
  - History row status badges/colours/compliance bars use new 3-status tints (rose=declined, emerald=successful, amber=submitted). If row is declined, show decline reason as a 2nd-line truncated rose text below the status.
  - Filter dropdown uses only the new 3 values.
- **Preview dialog header**: Status badge uses the new label/icon/tint.
- **OrderFormSheet submit() default status**: previously `"confirmed"` → now `"submitted"` (line L2032).
- **Backwards compatibility**: for any existing pre-migration orders whose stored status is one of the old 5 strings, map them at render-time with: `draft | confirmed | in_progress → submitted`; `cancelled → declined` (declineReason fallback: "Migrated from cancelled status"); `delivered → successful`. This keeps existing data readable on first load after deploy.

### FR-2 Decline reason authoring + inline display
- **Decline trigger UX**: Two entry points to set status=declined:
  1. In the Orders-tab row status dropdown `<Select>`: when user picks "declined", IMMEDIATELY open an `AlertDialog` (not a toast) that says "Decline this LPO?" with a **required** `<Textarea>`/`<Input>` for decline reason (min 4 chars). Confirm button is disabled until reason is non-empty after trim. Cancel keeps the prior status.
  2. In the LPO-tab history row: the compliance/action area already has an Eye button — ALSO add a small 3-dot action menu `DropdownMenu` with actions: Mark Submitted, Mark Successful, **Decline…** (opens same AlertDialog with reason).
- **Persistence**: Confirming decline = calls `updateOrder(id, { status: "declined", declineReason: reason.trim(), updatedAt: new Date().toISOString() })` and locally mirrors change with `setOrders`. The updatedAt timestamp is also used to show "Declined 2d ago by …" text.
- **Edit reason (post-decline)**: If an LPO is already declined and user re-opens the Decline… action, pre-fill the existing reason into the textarea and let them edit it. Confirm = PATCH with updated reason.
- **Rendering**:
  - LPO-tab row: below the rose-tinted status badge, render a clipped 1-line "Reason: …" with `MessageSquare` icon, rose-600, clickable to expand via `<Tooltip>` or hover to show the full text.
  - Orders-tab row: If declined, append a `Badge variant="outline" rose` with "Decline reason" truncate to status cell, click to view in preview.
  - Preview dialog: dedicated section with `AlertTriangle` rose icon + "Decline reason" heading + free-text block in a rounded dashed-box with rose tint, plus "Declined at …" timestamp.

### FR-3 Preview Dialog — Orders / Income / Complaints sections
- Existing sections (meta, particulars, notes, attachment, totals, timeline) are preserved but one is renamed:
  - Rename **Particulars** header to **Orders under this LPO**; keep the 4-col particulars/line-items table underneath (still SKU/desc/qty/price/amount) but add a hero strip above the table summarizing `N order items · Total item count`.
- **NEW: Total income hero** — insert a dedicated section right after meta, before Orders-under-this-LPO:
  - Large gradient card (gradient from `#003399` → to a vibrant blue) with a "Total income" eyebrow, then a huge mono `UGX amount` figure with a tiny Framer Motion count-up feel, 2nd line showing "From N line items", optional mini comparison chip if subtotal !== amount ("incl. adjustments"), plus a right-side `Banknote`/`Wallet` icon chip with hover scale.
- **NEW: Complaints per order** section — its own region below totals, before timeline:
  - Header: `MessageSquareWarning` icon + "Complaints (N)" counter + right-side "Log complaint" `<Button>` (visible to `canManageDocs = isAdmin || isManager`).
  - Each complaint row contains: summary (title), raisedBy (name), raisedAt (date), resolved badge (toggleable), resolutionNotes (optional inline edit for managers).
  - If 0 complaints: show a friendly empty state with `HandHelping` / `MessageSquare` icon + "No complaints logged for this order yet."
  - Clicking "Log complaint" opens an inline or modal micro-form (AlertDialog-like) with 3 fields: Summary `<Textarea>` required, Raised by `<Select>` of employees/customers (optional default = current), Resolved? toggle (default false). Confirm appends to the inline complaints list.
- Complaints stored on a new frontend-first `complaints?: OrderComplaint[]` array added to `SalesOrder` interface. `OrderComplaint` shape: `{ id, summary, raisedBy, raisedAt, resolved: boolean, resolutionNotes?: string }`.

### FR-4 New sales order form — LPO auto-fetch, customer sync lock
- Replace the **LPO number `<Input>` field + Customer name free-text pair** at OrderFormSheet ~L2048–L2101 with a two-path flow:
- **Path A (default, all roles)**: Select existing submitted LPO (status="submitted") from the database.
  - `<Select control>`: label **"Source LPO (from submitted LPOs)"** with a `FolderKanban` icon. Items list = all `orders.filter(o => o.status === "submitted")`, each item displays (mono) LPO number + customerName + dateReceived + amount chip. Search filter built into the Select combobox.
  - On selecting an LPO → AUTO-FILL (as read-only / locked fields with a 🔒 lock-chip):
    - LPO number = selected LPO's `lpoNumber` (rendered as a non-editable `<div>` with mono font + ring tint, not an `<Input>`, no onChange, no typing allowed)
    - Customer name = selected LPO's `customerName` (same: locked, read-only, ringed label with user icon).
    - `customerId` = if the selected LPO has one; otherwise empty (still keep customer name).
  - Spring animation: the lock-in uses a brief Framer Motion `layoutGroup` / scale pulse on the two locked field wrappers when the selected LPO changes to visibly signal "sync complete".
- **Path B (admin-only override)**: Show a small toggle / `Switch` below Path A, labelled "Manual LPO entry override" — visible only when `isAdmin || isManager`. When toggled ON, replace the Select-and-lock fields with:
  - Original manual `<Input LPO number>` (mono, editable)
  - Original customer flow (Select customer DB + free-text fallback)
  - Warning rose badge: "Manual LPO entry · Please verify against source before submitting"
- **OrderFormSheet valid** (L1903): for Path A, LPO number comes from selected LPO (non-empty check); for Path B, manual LPO must be non-empty. In both paths the valid guard behaves the same.
- When the form is submitted via Path A, the SalesOrder.status still defaults to `submitted` per FR-1 submit change; LPO `lpoNumber` matches the selected LPO exactly to prevent duplicates.

## Non-Functional Requirements
### NFR-1 Animations & Polish (#thinkx100 / #becreative)
- **Decline AlertDialog**: staggered fade-up entry for the title, body textarea, and confirm/cancel buttons; confirm button scales to `[1.02]` with ring glow when reason.length >= 4.
- **Total income hero**: gradient blur accent orbs (top-right, bottom-left), a `motion.div` count-up re-trigger on amount change, subtle y:2→0 stagger when preview dialog opens.
- **Complaint list**: staggered row entry (0.04s per complaint), resolved rows get a soft emerald left-stripe + check-chip, "Log complaint" micro CTA has a hover ring glow.
- **Form sync lock-in**: Path A LPO selection → `motion.pulse` or `scale-[1.02] then back to 1` on the LPO & customer lock-in wrappers + a check icon appearing briefly with `AnimatePresence` to confirm sync.
- All transitions ≥ easing `[0.22, 1, 0.36, 1]`; spring where appropriate (tab slider, dialog scale-in).

### NFR-2 Accessibility & Semantics
- Decline reason textarea has `required` semantics via aria-required + button disable gate.
- Income hero is a region labelled by `aria-labelledby` referencing its "Total income" header.
- Every new status badge has icon + label + tint — never colour-only.
- Keyboard navigation works through the new OrderFormSheet source paths.
- AlertDialog for Decline has focusTrapping and Escape-cancel per Radix default.

### NFR-3 Performance / Backward compat
- Status migration (old → new) happens in a single useMemo on `orders` load, once per fetch. No per-row map of strings inside hot render loops.
- The "submitted LPOs" Select list uses memoization `useMemo(() => orders.filter(o => o.status === "submitted"), [orders])`.
- Complaint rows: memoize the sorted complaints list.
- Framer Motion stagger cap: first ~30 rows, flat beyond for long lists.

## Constraints
- Single-file implementation, in `app.orders.tsx` + type edits in `sales-order.ts` ONLY. No new files.
- Existing role guard `canManageDocs = isAdmin || isManager` gates: decline-reason authoring (any manager/admin can decline), complaint logging, manual LPO override in OrderFormSheet. Staff users can still open decline reasons in read-only, view complaints, view income, and create orders via Path A (Select existing submitted LPO).
- Existing project_memory constraints: Handled by = exactly ONE employee name per row; Order action buttons persistently visible (not hover-hidden); Preview dialog particulars prioritizes line items over narrative; Branch switching locked non-admin; Document upload/delete restricted.
- Backward-compat status mapping for pre-existing orders is mandatory on first load after this code ships.

## Assumptions
- AS-1: It is acceptable and desired that the Orders-tab status list is reduced from 5 to 3 values (user explicitly chose "Replace entirely" over semantic layer). Any references to dashboard KPI tiles for "Open pipeline / Delivered" get replaced with new 3-status KPIs.
- AS-2: `complaints` and `declineReason` added to the SalesOrder type are frontend-first and persisted via the existing `updateOrder(id, updates)` PATCH call; the backend either accepts them via `partial<SalesOrder>` or ignores unknown fields gracefully.
- AS-3: "Select existing submitted LPO to create a new sales order" allows creating multiple sales order rows that share the same LPO number (no uniqueness enforcement in this iteration), since one LPO may spawn multiple orders.
- AS-4: LPO list items in the new-order Select are scoped to the current branch (same branch that's already active).
- AS-5: "Income hero" total = the same `order.amount` that already exists on SalesOrder; we display it heroically, no new aggregate value computed from backend ledger.

## Open Questions
_OIQ-1 (answered by user via explicit choices: Replace entirely / Select existing LPO + admin override / Inline complaint list) — RESOLVED, see "Approved choices" in spec history._

### rule AC-1 OrderStatus global 3-value replacement
The `OrderStatus` exported type in `sales-order.ts` equals exactly `"submitted" | "declined" | "successful"`. Every UI element that displayed or selected an `OrderStatus` enum now uses these 3 values only: Orders-tab row status Select, Orders-tab status filter Select, Orders-tab dashboard KPIs, LPO-tab KPI chips, LPO-tab filter Select, LPO-tab row status badges, preview dialog header status badge, OrderFormSheet default status. Pre-migration orders loaded with the old 5 strings are rendered correctly via a single memoized backward-compat mapping.

### rule AC-2 Decline reason field & prompt
- A `declineReason?: string | null` field exists on the `SalesOrder` interface.
- Both entry points (Orders-tab status Select → "declined", and LPO-tab row dropdown → Decline…) open an AlertDialog with a **required** textarea input for decline reason; Confirm is disabled when reason is empty after trim.
- After decline confirm, the order is PATCHed with `status: "declined"` + decline reason; decline reason is visible on the LPO row as a clipped rose 2nd line + tooltip; and it has its own section in the preview dialog. A declined LPO's reason can be edited later via the same Decline… action (pre-filled reason).

### rule AC-3 Preview dialog — income hero
When an LPO preview is open, the rendered tree contains a "Total income" hero section between the meta grid and the Orders-under-this-LPO particulars table. It displays the order `amount` in a large mono typographic style with a gradient blue brand background + accent orbs, plus a count-up or fade-in micro-animation.

### rule AC-4 Preview dialog — complaints section
When an LPO preview is open, the rendered tree contains a "Complaints (N)" section between the Totals section and the Timeline section, showing: (a) N = count of complaints (0 if none), (b) a list of rows for each complaint (summary, raised by, date, resolved flag), (c) empty state when N=0, (d) a "Log complaint" CTA button for canManageDocs users that opens a form and appends a new complaint to the order.complaints array. A new `OrderComplaint` type exists with required id/summary/raisedAt fields.

### rule AC-5 Preview dialog — orders under this LPO renamed
The "Particulars" header section inside the preview dialog is renamed to read "Orders under this LPO" (with line count) and retains the existing 4-column line-items table underneath.

### rule AC-6 New-order form — LPO auto-fetch (Path A)
In the default flow of OrderFormSheet, the form presents a `<Select>` listing all existing LPOs with `status === "submitted"`; selecting one AUTO-FILLS both the LPO number (read-only / locked, no edits) AND the customer name (read-only / locked, no edits) sourced from the selected LPO's fields. The lock-in has a visible 🔒 chip plus a spring/pulse animation that signals sync success. No manual `<Input>` for LPO number exists on Path A.

### rule AC-7 New-order form — Admin manual override (Path B)
For users where `isAdmin || isManager` is true, a Switch / toggle labelled "Manual LPO entry override" exists. When toggled ON, Path A's Select + lock fields are replaced with the original (editable) LPO `<Input>` + customer (Select + free-text) flow, with a visible rose warning badge reading "Manual LPO entry · verify before submitting". Non-admin users NEVER see this Switch.

### rubric AC-8 Creative polish (#becreative)
Scale 0–3, pass threshold ≥2.
- 0: plain static inputs, no animations, no gradient/layer polish.
- 1: basic transitions on status changes; no gradient orbs, no count-up, no lock-in pulse.
- 2 (pass): decline dialog has staggered entry; income hero has gradient orbs; lock-in uses a pulse/spring micro-interaction; compliance badges tint correctly per new status; complaints list uses row stagger.
- 3 (full): All of 2 plus — decline Confirm button glow-enable when reason ≥ 4 chars (ring spring-in); income count-up with keyed re-trigger on amount; complaints resolved-row emerald left-stripe + scale-on-hover.

## Acceptance Criteria Summary
| # | Type | Threshold |
|---|---|---|
| AC-1 | rule | binary pass |
| AC-2 | rule | binary pass |
| AC-3 | rule | binary pass |
| AC-4 | rule | binary pass |
| AC-5 | rule | binary pass |
| AC-6 | rule | binary pass |
| AC-7 | rule | binary pass |
| AC-8 | rubric | ≥ 2 / 3 |

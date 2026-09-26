# Implementation Tasks — LPO 3-Status lifecycle, Decline Reason, Income/Complaints Preview, LPO-auto-sync Create Order

All tasks target these two files ONLY (constraint from spec):
- `d:\House\qterp\frontend\src\types\sales-order.ts` (type edits only)
- `d:\House\qterp\frontend\src\routes\app.orders.tsx` (all UI implementation)

---

## Task 1: Global OrderStatus replace → 3 values + backward compat mapping + declineReason + complaints types
**Priority**: high (foundation)
**Depends on**: —
**Scope**: sales-order.ts interface edits + app.orders.tsx STATUS_META rewrite + Orders-tab/LPO-tab/KPI/selector rewrite

### Change summary
1. **`sales-order.ts`** edits:
   - Replace `export type OrderStatus` from 5 strings → `"submitted" | "declined" | "successful"`.
   - Add to `SalesOrder` interface: `declineReason?: string | null;`
   - Add new type + field for complaints:
     ```ts
     export interface OrderComplaint {
       id: string;
       summary: string;
       raisedBy?: string;
       raisedAt: string;
       resolved: boolean;
       resolutionNotes?: string;
     }
     ```
   - Add to `SalesOrder`: `complaints?: OrderComplaint[];`
2. **`app.orders.tsx` STATUS_META rewrite** (L89): New entries for submitted/declined/successful.
3. **Backward compat mapping** (single memoised pass right after `loadDatabaseOrders` success):
   ```
   (old: draft/confirmed/in_progress) → submitted; cancelled → declined with declineReason = "Migrated from cancelled status"; delivered → successful
   ```
4. **Orders tab — status filter `<Select>`** (~L330): items now: All + Submitted/Declined/Successful.
5. **Orders tab — dashboard KPIs** (~L184 `dashboardStats`): Rework the 4 tiles to Total, Submitted, Successful, Declined counts using new statuses.
6. **Orders tab — row status `<Select>`** (~L635): 3 items only, matching STATUS_META.
7. **LPO tab — 4 KPI chips** (~L952): Rework 4 tiles to Total LPOs, Submitted, Successful, Declined.
8. **LPO tab — filter `<Select>`** (~L1020): 3 statuses + all.
9. **LPO tab — row status cell**: Use new badge tints (rose for declined, emerald for successful, amber for submitted). If declined, render "Reason: …" truncated 2nd line below badge with tooltip.
10. **Preview dialog header status badge** (~L2488): Use new STATUS_META label/icon/tint.
11. **OrderFormSheet submit() default `status`** (~L2032): `"confirmed"` → `"submitted"`.
12. **`canManageDocs` guards unchanged**; Decline action (Task 2) adds its own `canManageDocs` gate.

### Local Test Requirements
- **(rule TR-1.1)** `getDiagnostics` / `tsc --noEmit` passes with 0 type errors after replacing the union literal (no stale references to draft/confirmed/in_progress/delivered/cancelled anywhere in the module that aren't caught by the compat mapping).
- **(rule TR-1.2)** STATUS_META has exactly 3 entries; Orders-tab/LPO-tab row status dropdowns show exactly 3 options (Submitted / Declined / Successful) plus "All" in the filter dropdowns.
- **(rule TR-1.3)** Pre-migration orders with old status strings (cancelled / delivered / confirmed etc.) correctly render with the new 3-status labels after the compat mapping runs (no blank badge, no `undefined` label).
- **(rule TR-1.4)** New `SalesOrder.declineReason` + `SalesOrder.complaints` + `OrderComplaint` types exist in `sales-order.ts`, no TS implied-any on any complaint accessor.
- **(rule TR-1.5)** `nextLpo(orders)` helper (~L97) continues to work with new statuses (it only parses LPO numbers, which are untouched) — no type errors from this helper.
- **(rubric TR-1.6)** Backward compat mapping happens in a single memoised pass (not inside per-row hot render). Score 0-2; pass ≥1. (0 = inline in hot render; 1 = at fetch stage, no memo; 2 = single useMemo after fetch with stable identity)

### Completion Evidence
- `tsc --noEmit` clean output.
- Screenshot of Orders tab row → status dropdown shows exactly 3 options.
- Preview dialog header shows new status badge (no old labels).

---

## Task 2: Decline reason flow — AlertDialog, 2 entry points, persistence, inline display
**Priority**: high
**Depends on**: Task 1 (status union must be 3-value, declineReason field must exist)
**Scope**: app.orders.tsx OrdersTab section (~L594–L678 status dropdown), LpoWorkspace section (~L1047+ row actions), plus a new DeclineReasonDialog inner component (or inline AlertDialog) inside OrdersPage.

### Change summary
1. **New inner component / inline JSX**: A shared `<AlertDialog>` for the decline prompt:
   - Title: "Decline LPO {lpoNumber}?"
   - Description: "Please provide a reason for this decline. It will be visible to all staff on the LPO audit row and preview."
   - Body: `<Textarea label="Decline reason" required minLength=4 maxLength=500 rows=4 placeholder="e.g. Customer rejected pricing on line items 2 & 5.">`
   - Footer: Cancel (keeps prior status) + Confirm (disabled until reason.trim().length >= 4, with a rose ring glow + scale spring when the button becomes enabled)
   - On Confirm: calls `updateOrder(id, { status: "declined", declineReason: reason.trim(), updatedAt: now })` + `setOrders(prev => prev.map(...))`. Local optimistic update first, then re-fetch silently on success.
   - If opening for an LPO already declined, pre-fill `declineReason || ""` into textarea → Confirm calls PATCH with updated reason (edits allowed).
2. **Entry point A — Orders tab row status Select** (~L634–L652 `<Select value={o.status} onValueChange>`):
   - Intercept onValueChange callback. If the new value === `"declined"` → open the AlertDialog (state: `declineDialogTargetId` + initialReason/priorStatus). If the user cancels out of the dialog → rollback the Select UI value back to prior status (controlled pattern with `setOrders` mirror is already there). If they confirm → apply PATCH.
   - Role gate: if NOT canManageDocs → disable the declined option in the Select, or restrict changing status to declined entirely.
3. **Entry point B — LPO history row actions**:
   - In the 8-col LPO row, add a small `Button size=icon variant=ghost` dropdown trigger (`MoreVertical` / 3-dots icon) at col 7 or next to Eye; inside a `DropdownMenu`:
     - "Mark as submitted" (icon Clock) — canManageDocs only
     - "Mark as successful" (icon Check) — canManageDocs only
     - "Decline…" (icon XCircle rose) — canManageDocs only, opens the shared AlertDialog.
4. **Rendering**:
   - LPO row (Task 1 step 9): if declined, render a clipped 1-line "Reason: {first 80 chars}…" with MessageSquare icon rose-600 + `<Tooltip>` with full text on hover.
   - Orders tab row (~L654): after the status Select, if declined add a small rose-outline Badge with "Decline reason" truncated text → click to open preview (already routes to same preview).
   - **Preview dialog — new Decline reason section** (insert between meta and income hero, OR near notes; between timeline and meta is reasonable too): heading "Decline reason" with AlertTriangle rose icon; dashed rose rounded box containing declineReason free-text + "Declined at {updatedAt}" timestamp line. Conditional: render section only when `status === "declined"`.
5. **Role gate on actions**: Decline dialog accessible only if canManageDocs=true.

### Local Test Requirements
- **(rule TR-2.1)** Clicking Orders-tab status → "Declined" opens the AlertDialog; dialog does NOT commit the status change until Confirm is clicked with a non-empty reason.
- **(rule TR-2.2)** Clicking Cancel on the dialog rolls back the Orders-tab row UI to its prior status (no stuck "declined" view).
- **(rule TR-2.3)** LPO row dropdown shows 3 actions (Mark submitted / Mark successful / Decline…). Role-restricted to canManageDocs only (no dropdown or disabled for non-managers).
- **(rule TR-2.4)** Declined LPO row shows truncated reason with tooltip; declined Orders-tab row shows decline reason badge; declined Preview dialog shows a dedicated "Decline reason" section with the text + timestamp.
- **(rule TR-2.5)** Editing an already-declined LPO: dialog pre-fills the existing decline reason into textarea, and confirm PATCHes with updated reason (not resetting status).
- **(rubric TR-2.6)** Decline dialog polish per AC-8: staggered entry + confirm button glow-enable when reason ≥ 4 chars. Score 0-2; pass ≥1.

### Completion Evidence
- Screenshot of Decline dialog with reason entered + confirm enabled.
- Screenshot of LPO history row showing declined status + truncated reason under badge, tooltip open with full text.
- Screenshot of Preview dialog showing the Decline reason section.
- Console log: updateOrder PATCH called with {status:"declined", declineReason:"…"} when confirm clicked.

---

## Task 3: Preview Dialog redesign — Total income hero + Orders-under-LPO header rename + Complaints section
**Priority**: high
**Depends on**: Task 1 (OrderComplaint + complaints field), Task 2 (Decline reason section in preview also wanted; but order independent so actually this can be worked in parallel after Task 1 types land)
**Scope**: app.orders.tsx `OrderPreviewDialog` function (~L2430–L2700+), existing sections meta, particulars, totals, timeline.

### Change summary
1. **"Particulars" → "Orders under this LPO"** rename (~L2541 header):
   - Replace old `Particulars` title text with `Orders under this LPO`. 2nd subtitle line continues to show line count `{N} line(s)`; update micro-copy to say "From this LPO".
2. **NEW: Decline reason section (conditional)** (shared with Task 2 — insert BEFORE meta, or after meta; before income hero): rose-tinted region only when status === "declined".
3. **NEW: Total income hero section** (insert between meta and Orders-under-this-LPO):
   - Gradient brand bg card: `bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC]` text-white.
   - Top-right + bottom-left gradient blur accent orbs (20–25% opacity blur-2xl).
   - Left side: `Wallet / Banknote` icon chip + eyebrow "Total income".
   - Centre headline: huge mono UGX amount with `motion.div key={amount}` count-up fade/re-trigger animation.
   - Sub-line: "From N line items" + (if subtotal !== amount): small adjustment chip "incl. UGX {diff} adjustments".
   - Right: hover-able Wallet chip, `group-hover:scale-[1.08]`.
4. **NEW: Complaints section** (insert between Totals section and Timeline section, before notes if exists):
   - Header: `MessageSquareWarning` icon + "Complaints (N)" (N = order.complaints?.length ?? 0) + right-side `Button "Log complaint" size=sm` (visible for canManageDocs only).
   - If N === 0 → EmptyState-mini inline (`HandHelping` icon + "No complaints logged for this order yet.").
   - If N > 0 → list of complaint rows, each row a 4-5 cell grid:
     - Left: resolved? emerald CheckCircle2 else rose AlertTriangle icon chip.
     - Summary: truncatable text (multi-line with leading-snug at 11px).
     - Raised by + date: 2 stacked lines, 10.5px muted.
     - Resolved: `<Switch>` (canManageDocs = interactive, else disabled). Toggling resolved → optimistic update to local complaints.
     - Right action: `Button size=icon variant=ghost trash` for canManageDocs to delete complaint.
     - If resolved === true → add 3px emerald `shadow-[inset_3px_0_0_rgba(16,185,129,0.6)]` left-stripe + soft emerald bg tint.
   - **"Log complaint" click → opens AlertDialog/inline form**: 3 fields: Summary `<Textarea>` required, Raised by `<Input>` (optional free text, default empty / current user), Resolved? Switch (default false). Confirm → appends complaint to `order.complaints` array; then persists via `updateOrder(order.id, { complaints: newArr, updatedAt: now })` optimistically + local `setOrders` mirror.
   - Staggered row entry: Framer Motion variants staggerChildren 0.04s.
5. **Keep existing sections intact**: meta, particulars-table, notes, attachment, totals, timeline — DO NOT regress; just reorder / insert new ones around them.

### Local Test Requirements
- **(rule TR-3.1)** Particulars section header string reads exactly "Orders under this LPO" and line-items table still renders correctly.
- **(rule TR-3.2)** "Total income" gradient hero section is visible between meta and particulars, displaying `UGX {amount}` (matching order.amount) in large mono typography, with gradient orbs.
- **(rule TR-3.3)** Complaints section header shows "(0)" count by default on orders without complaints; clicking "Log complaint" (visible for managers only) opens a form with required Summary field; submitting appends a complaint with a new random UUID id + today ISO raisedAt; count increments to (1) + list shows new row.
- **(rule TR-3.4)** Resolved toggle + delete buttons on complaint rows are disabled/hidden for non-managers (canManageDocs=false). Staff users can still view complaints but not interact.
- **(rule TR-3.5)** Complaints persisted on the local `SalesOrder.complaints` array via `updateOrder(id, { complaints })` (visible in network/console call when logging).
- **(rubric TR-3.6)** AC-8 polish on income hero + complaints: income count-up key-retrigger animation present; resolved complaints get emerald left-stripe; complaint list staggered entry. Score 0-2; pass ≥1.

### Completion Evidence
- Screenshot: preview dialog with income gradient hero visible (UGX amount large mono + orbs).
- Screenshot: complaint list with 1 resolved row (emerald stripe) + 1 open row.
- Console / network: updateOrder with complaints array payload on log complaint / resolve toggle / delete.
- Screenshot: particulars section reads "Orders under this LPO".

---

## Task 4: OrderFormSheet — LPO auto-fetch (Path A: Select submitted LPO, lock-synced LPO + customer)
**Priority**: high
**Depends on**: Task 1 (new statuses, status="submitted" defined), Task 2 (no dependence; can be done in parallel after Task 1)
**Scope**: app.orders.tsx `OrderFormSheet` function (~L1843–L2120 form JSX and state).

### Change summary
1. **New props on OrderFormSheet**: Add `orders` array to props (or it can be captured from closure since it's inside the same OrdersPage file — choose whichever keeps TS clean). Purpose: provide the source list of all orders with status="submitted" to populate the Select.
2. **Derived memo**: `const submittedLpos = useMemo(() => orders.filter(o => o.status === "submitted"), [orders])`. Scope inside OrderFormSheet.
3. **New state for Path A/Path B**:
   ```
   const [sourceType, setSourceType] = useState<"auto" | "manual">("auto");
   const [selectedLpoId, setSelectedLpoId] = useState<string>("");
   ```
   - Note: sourceType = "auto" → Path A (default). "manual" → enabled only via Task 5 admin switch gate; initially hidden / no effect until Task 5 switch activates it.
4. **Replace LPO + customer fields (~L2048–L2101)** in default Path-A render with:
   - `<Select value={selectedLpoId || ""} onValueChange={setSelectedLpoId}>`
   - Label: "Source LPO (from submitted LPOs)" with `FolderKanban` Field icon.
   - `<SelectItem>` per LPO in submittedLpos: displays `font-mono LPO# · {customerName} · {dateReceived} · UGX {amount}`.
   - When `selectedLpoId` non-empty:
     - `useEffect([selectedLpoId])` → finds `sourceLpo = orders.find(o => o.id === selectedLpoId)` → sets internal form state:
       - `setLpo(sourceLpo.lpoNumber)` (but do NOT let the user edit — use read-only display)
       - `setCustomerName(sourceLpo.customerName)` → also `setSelectedCustomerId(sourceLpo.customerId || "")`
       - Animate the lock-in: wrap the LPO readonly-display and Customer readonly-display in `motion.div` with `key={selectedLpoId}` initial scale 0.98 → animate scale 1 + opacity 0→1 to signal "sync lock".
     - **LOCKED read-only display wrappers** (NOT `<Input>` with onChange):
       - LPO block: `rounded-lg border ring-1 bg-muted/30` with mono LPO number + 🔒 Lock lock-emoji chip (size=sm) on the right, no onChange handler, no `<input>`.
       - Customer block: `rounded-lg border ring-1 bg-muted/30` with User icon + name + 🔒 Lock chip, no onChange handler, no free-text or customer-Select override available on Path A.
     - If selectedLpoId === "" → render an EmptyState-mini inline message inside the form area: "Select a submitted LPO above to auto-fill LPO and customer."
5. **Form validity** (~L1903 `valid`): Adjust valid check: when `sourceType === "auto"` → `valid` additionally requires `selectedLpoId !== ""` (which implies lpoNumber and customerName are already set by the effect above).
6. **On submit** (L2014 `submit()`): when sourceType auto → `lpoNumber` is already from the source LPO (unchanged / auto-filled); `customerName` and `customerId` are taken from the form state as before (auto-filled). status defaults to `submitted`.

### Local Test Requirements
- **(rule TR-4.1)** OrderFormSheet default view shows NO free-text LPO Input. Instead shows a `<Select>` of all `status === "submitted"` LPOs with LPO+customer+date+amount in each item.
- **(rule TR-4.2)** After picking a submitted LPO, the form shows TWO locked read-only blocks (LPO number display and Customer name display) with lock-chip. Editing via keyboard / clicking to edit → NOT possible (no `<input>`, no onChange).
- **(rule TR-4.3)** After picking a different submitted LPO, BOTH locked blocks update to the new LPO/customer values and a pulse/scale animation indicates sync.
- **(rule TR-4.4)** `valid` blocks submission when no LPO is selected in Path A; locked fields cannot be bypassed to submit empty data.
- **(rule TR-4.5)** Ordering an order via Path A → onCreate payload: `lpoNumber` matches the source LPO exactly, `customerName` matches source LPO exactly.
- **(rubric TR-4.6)** Lock-in animation polish per AC-8 (spring/pulse with brief AnimatePresence check-icon or scale). Score 0-2; pass ≥1.

### Completion Evidence
- Screenshot: OrderFormSheet Path-A with a submitted LPO selected — two locked blocks with lock-chips visible.
- Screenshot: Submitted LPO dropdown items show LPO# · customer · date · amount row display.
- Console log / toast: onCreate fired with the auto-filled lpoNumber and customerName.

---

## Task 5: OrderFormSheet — Admin manual LPO entry override (Path B) + switch guard + validation
**Priority**: medium (admin-only feature, nice to have for escape hatch)
**Depends on**: Task 4 (must be done after or together with sourceType state wiring)
**Scope**: app.orders.tsx OrderFormSheet.

### Change summary
1. **Switch toggle with role guard** rendered right-below the "Source LPO Select" (or below it):
   - Only visible + enabled when `isAdmin || isManager`. For non-admin users: entire switch does NOT render.
   - Label: "Manual LPO entry override".
   - `<Switch checked={sourceType === "manual"} onCheckedChange={(v) => setSourceType(v ? "manual" : "auto")}>`.
2. **When sourceType === "manual"** (Path B view):
   - Hide the "Select submitted LPO" `<Select>` + lock-in display blocks from Task 4.
   - Restore the original 2-column field pair: manual `<Input LPO number>` (mono, editable with onChange) + Customer flow (Select customer DB + free-text fallback) — exactly the prior fields from pre-Task 4 but kept in the same DOM location.
   - Show a persistent rose warning Badge / Alert inline: `<Alert variant="destructive" size="sm" title="Manual LPO entry" description="Please verify this LPO number against source documents before submitting.">` with AlertTriangle icon.
3. **State sync when toggling between auto/manual**: If switching auto→manual, pre-fill LPO and customer from current locked state (nice UX); if switching manual→auto, clear manual overrides and re-show Select.
4. **Valid guard** (already handled by TR-4.4 for auto; for manual: keep pre-existing `lpoNumber.trim() && customerName.trim()` behaviour).
5. **Submit** → both paths use the same `submit()` (no change needed, since state variables lpoNumber/customerName are common).

### Local Test Requirements
- **(rule TR-5.1)** Switch "Manual LPO entry override" is ONLY visible to admins/managers (staff users never see it, confirmed by hiding it with role guard).
- **(rule TR-5.2)** Toggle ON → hides Select/Lock blocks, shows editable LPO `<Input>` + original customer flow, plus a persistent rose warning alert/badge with the text "Manual LPO entry · verify before submitting".
- **(rule TR-5.3)** Toggle OFF → goes back to Path A (Select submitted LPO flow from Task 4).
- **(rule TR-5.4)** Valid + submit works in both Paths independently (no stale state leakage between toggles).
- **(rubric TR-5.5)** Role guard enforcement is clean (no hidden disabled Switch for staff; the entire block simply isn't rendered). Score 0-2; pass ≥1. (0 = rendered but disabled with staff hint; 1 = not rendered at all for staff with code path that skips branch + optional comment; 2 = not rendered + linted properly with explicit early return / conditional branch)

### Completion Evidence
- Screenshot: Admin view — Manual LPO switch visible.
- Screenshot: Path B active → editable LPO input + customer select + rose warning alert/badge.
- Staff view code confirmation (no Switch rendered at all).

---

## Task 6: Cross-cutting polish, type-check, regression, #becreative extra review
**Priority**: medium
**Depends on**: Tasks 1, 2, 3, 4, 5 all applied
**Scope**: Full module regression.

### Change summary
1. **Full type-check** (`GetDiagnostics` + `tsc --noEmit`) → resolve all TS / ESLint errors arising from the 3-status replace.
2. **Regression**:
   - Handled-by cell still works (One employee per row, no multi-select).
   - Orders-tab action buttons still persistently visible.
   - Particulars in preview still prioritize line-items > narrative (Task 3 didn't regress; the particulars table is still present under its new "Orders under this LPO" name).
   - Documents tab untouched (no regressions — only checked that no imports/types changed that broke existing DocumentsWorkspace / DocumentRow / Category section code).
   - Branch change listener `qterp:branch-changed` still triggers re-fetch after Task 1 statuses rewrite.
3. **Animation & polish review across #becreative feature set**:
   - Decline dialog: staggered entry + confirm button glow-enable.
   - Income hero: gradient orbs + count-up keyed.
   - Complaint list: stagger + emerald resolved stripe + hover icon scale.
   - Lock-in Path A: pulse/spring + check-icon brief appearance.
4. **Update the LPO-tab 4 KPI chips from Task 1 if they still show stale tone/class names** (ensure amber = submitted, emerald = successful, rose = declined toning consistent with STATUS_META).

### Local Test Requirements
- **(rule TR-6.1)** Zero TypeScript / ESLint errors from `GetDiagnostics` on `app.orders.tsx`.
- **(rule TR-6.2)** `tsc --noEmit` on frontend returns exit code 0, no errors.
- **(rule TR-6.3)** Regressions checklist: (a) Handled-by single-name, (b) Orders-tab buttons persistent, (c) Preview particulars line-items table intact after rename, (d) Documents workspace renders on tab click (no broken imports/types).
- **(rubric TR-6.4)** Overall AC-8 polish across all 4 features (decline + income + complaints + lock-in) scores 2/3. Score 0-3; pass ≥2.

### Completion Evidence
- GetDiagnostics screenshot = 0 errors.
- tsc exit code 0.
- Regression screenshots if applicable; otherwise code evidence.

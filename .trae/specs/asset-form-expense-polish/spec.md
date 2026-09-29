# Spec: Asset Form Category Icon + Expense Form Cleanup + Admin/Manager Approval Lock

Session: `asset-form-expense-polish`  
Last updated: 2026-09-27  
Approved: ⏳ Pending user approval

## Problem & Users

**Users:**
1. Assets admin/manager creating new assets — want a quick way to spin up a new asset category without leaving the New Asset sheet
2. Finance team / expense submitters / approvers — want a cleaner, less cluttered New Expense form (remove niche fields) plus clear role-gated approval so regular staff can never approve their own or any other expenses
3. Admin/manager staff in the field approves expense submissions from any device

**Current pain points (from user request + codebase inspection):**

1. **AssetFormSheet**: New Asset window has no way to add a category in-line. User must leave the sheet, navigate to… there's no Asset Category CRUD page in the codebase (ASSET_CATEGORIES is a HARDCODED constant array in assets-store.ts#L103-L111).
2. **AssetFormSheet**: `Assigned staff` attribution currently sits inside a rounded dashed panel at L235-L274 — the user wants it "below" (moving the panel after Notes / before footer) to reduce the visual weight of the dashed card between core fields.
3. **ExpenseFormSheet**: Contains 4 fields the user wants removed: Department (L70-L75), Currency (L77-L82), Payment method (L83-L95), and the `Reimbursable to employee` Switch (L126-L129) should become a radio button.
4. **Expense approval**: The `approve`/`reject` DropdownMenu actions in ExpensesTable (L147-L150) are visible to ANY authenticated user; `onDecide` callback in app.expenses.tsx (L114) passes hardcoded "Faith Njeri" as the actor. Backend `decide_expense` endpoint (expenses_routes.py#L144-L158) only requires `require_current_user`, no `require_manager_user`. Staff users can approve their own expenses — a real audit/compliance bug.
5. **Database persistence**: Everything (new asset categories, form submissions, approvals) must be written correctly to the SQLite DB — not just optimistic frontend state.

## Non-Goals (out of scope)

1. **Do NOT introduce a dedicated Asset Categories CRUD page** — user said "in the new asset window", solve it in-sheet only
2. **Do NOT change the Expense `type`, `travel`, `recurring` fields** — keep these intact exactly
3. **Do NOT add Asset `Manufacturer`, `Location`, `Assigned To`, `Salvage Value`, `Condition`, `Insurance Expiry`** — already explicitly excluded per project_memory constraints
4. **Do NOT add new asset DB columns or migrations** — categories are frontend-only for now (ASSET_CATEGORIES constant appended client-side, backed by localStorage or in-memory store write-back)
5. **Do NOT touch the reimbursement / reimbursed flow** — only the boolean input field's shape changes from Switch → radio, plus role-gate on approval
6. **Do NOT change asset branch isolation logic** — existing middleware in guards.py handles it

## Functional Requirements (FR)

### FR-1: Asset Form — in-line Category Add button
In `AssetFormSheet`, to the right of the `Category` field's `SelectTrigger`, add an **icon-only `Button` variant="outline" size="icon"** (plus-tag icon, e.g. `TagPlus` from lucide-react). When clicked:
- Opens a **small Dialog** (sheet is unnecessary; a compact centered Modal is enough) with one Input "New category name", Cancel / Add buttons
- **Admin + Manager only**: the button is disabled/hidden for Staff roles. Use `useRole().isAdmin || isManager` gating exactly per RoleContext semantics (L33-34 RoleContext.tsx).
- On successful "Add":
  - Pushes the new category name into the runtime `ASSET_CATEGORIES` array (mutate it in-place — arrays are mutable by reference, this is intentional for live list)
  - Sets it as the currently selected `f.category` on the form
  - Toasts: `Category "<NAME>" added`
  - (Backed by localStorage key `qterp:asset-categories` to survive refreshes; on app boot merge stored + ASSET_CATEGORIES defaults)
- Dialog content follows the Hero Banner brand skeleton micro-interactions: fade in, Enter=submit, Esc=cancel, auto-focus input

### FR-2: Asset Form — Staff field position
Move the Assigned staff dashed panel (currently L235-L274 in AssetFormSheet.tsx) to **AFTER** the Notes field (L226-L233) and **BEFORE** the footer Cancel/Submit button row (L276). Keep:
- All existing logic (employee lookup, manual custom input fallback, dashed card wrapper, person svg icon badge)
- All existing styling rules (dashed border, tinted gradient bg)
- Reorder only. No other field-level changes.

### FR-3: Expense Form — remove 3 selector fields + Currency hardcode to UGX
Delete from `ExpenseFormSheet` UI **and** default initializer:
- **Department** selector (current L70-L75) — remove the field entirely
- **Currency** selector (current L77-L82) — remove UI selector; hard-code `currency: "UGX"` in the submit() payload (L28-L45) AND in mkInitial (L157)

Hard-coding to UGX is intentional: this is an Ugandan LPO/ERP project per project_memory. Save the department / currency / payment method columns in the DB EXISTING STATE (don't drop schema — leave nullable) but **stop writing user-entered values** for:
  - `department`: in submit() payload, set `department: ""` (empty string, which backend already accepts via `data.get("department") or ""`)
  - `paymentMethod`: in submit() payload, set `paymentMethod: "cash"` (fixed default, already a VALID_PAYMENT_METHODS entry per expenses_service.py L8)

### FR-4: Expense Form — Reimbursable switch → radio button group
Replace the current `Switch` component (L126-L129):
```tsx
<div>Switch: Reimbursable to employee [toggle]</div>
```
With a **two-option segmented radio group** using the `Label + RadioGroupItem + RadioGroup` shim if available, or if no shim exists, fall back to lucide-check/empty-circle buttons styled like Badge chips:
- Option 1 "Reimbursable" (selected → `form.reimbursable = true`)
- Option 2 "Not reimbursable" (selected → `form.reimbursable = false`)
- Active option uses `bg-[#003399]/10 + ring-1 + ring-[#003399]/30 + text-[#003399] + CheckCircle2`
- Inactive option uses `bg-white + border-border + text-muted-foreground + CircleIcon`
- Radio items follow the existing "rounded-lg border px-3 py-2" pattern similar to the Preset filter button row in AssetDetailSheet FinanceTab
- Staggered animation on mount (Framer Motion: 0.06 + 0.12 delay)

### FR-5: Expense approval — Admin / Manager ONLY (frontend + backend)
**Double-gated role check on BOTH frontend AND backend**:

**5a. Backend — expenses_routes.py `/api/expenses/<id>/decision`**:
- Replace `require_current_user()` → `require_manager_user()` (already implemented in guards.py#L39-L48, returns 403 when role not in {"admin","manager"})
- If role OK, continue to `expenses_service.decide`

**5b. Backend — expenses_routes.py `/api/expenses/<id>/reimburse`**:
- Same upgrade → `require_manager_user()` since marking reimbursed is a finance approval action

**5c. Backend — validate expense payload — NEW role gating on status=approved**:
- In `validate_expense_payload`, IF data contains status="approved" or status="rejected" AND the user's role (from `get_current_user()`) is not admin/manager → 403 "Approval requires Manager or Admin role"

This prevents direct API tampering (Staff user POSTing to `/api/expenses/<id>` with `{status: "approved"}` bypassing /decision route).

**5d. Frontend — ExpensesTable Approve/Reject items**:
- Wrap Approve + Reject DropdownMenuItems in `ExpensesTable.tsx` L147-L150 with `const { isAdmin, isManager } = useRole()` → gate with `{(isAdmin || isManager) && (...) }`
- Staff users still see "Submit for approval" and "Mark reimbursed" (if enabled + already approved) but never Approve/Reject
- Additionally, wrap the `onDecide` prop call site in app.expenses.tsx L114 to pass the actual logged-in user's name (from `useAuth` hook: `user.user_metadata.full_name || user.email.split('@')[0]`) as the actor, NOT hardcoded "Faith Njeri"

**5e. Frontend — ExpensesTable Disabled indicator**:
- Keep Approve/Reject DOM hidden for Staff (don't render disabled buttons; hide them to avoid confusion).

### FR-6: DB persistence contract
Every change that writes data MUST hit the backend SQLite database and be round-trip verifiable:

1. **New asset creation**: `POST /api/assets` → writes row to `assets` table. Category name goes into `category` column as-is (no FK relation yet, it's a free string column). Staff attribution goes into `staff` column. Asserts: after save → `GET /api/assets/:id` returns category matching user selection.
2. **Expense submission** (after FR-3): writes `currency = "UGX"`, `payment_method = "cash"`, `department = ""` to DB, plus `reimbursable: 1|0`. Asserts: round-trip `GET /api/expenses/:id` matches fixed fields exactly.
3. **Expense approval** (after FR-5): backend `decide` → `expenses.approved_by` column receives the manager/admin username. Asserts: non-admin POST to `/decision` returns 403, DB unchanged.

## Non-Functional Requirements

1. **NFR-1 Hook safety**: All new hooks (`useRole`, `useState` for dialog open, etc.) declared BEFORE any conditional return statements.
2. **NFR-2 Resilience**: Expense form submit never fails if hidden fields' defaults are missing; hardcoded fallback always present.
3. **NFR-3 Build cleanliness**: Zero TypeScript / ESLint errors on touched files post-change.
4. **NFR-4 Zero new migrations**: DB schema for expenses already has all required columns (`department`, `currency`, `payment_method`, `approved_by`). Leave schema as-is, simply stop accepting user values.
5. **NFR-5 Micro-interactions**: Every modal/button group entry uses Framer Motion staggered animations (per #becreative tag). Reuse Hero Banner spring patterns from project_memory.

## Constraints & Dependencies

1. `useRole()` returns `{ isAdmin, isManager, isStaff, role, permissions, setRole, setDemoRole }` (RoleContext.tsx#L5-L14)
2. `PermissionGate` exists but a lighter `isAdmin || isManager` in-line is preferred here since ExpensesTable already imports `useRole`-like patterns elsewhere (TransactionsTable.tsx L128 uses it)
3. ExpenseStatus enum in expenses-store.ts contains `"draft" | "submitted" | "approved" | "rejected" | "reimbursed" | "paid"` — no new statuses needed
4. Backend `require_manager_user` exists and is tested — reuse it

## Open Questions

1. ✅ Q: Does the Asset category add need a backend category table? A: No, localStorage + runtime array push is sufficient per spec NG-4 (no migrations).
2. ✅ Q: Payment method hardcoded? A: Yes → "cash" always (simplest valid member of VALID_PAYMENT_METHODS).
3. ✅ Q: Department column drop or just no UI? A: Leave DB column, write empty string only — schema unchanged (NG-4).

## Acceptance Criteria (AC)

### Rule AC (binary pass/fail)

- **AC-1.1**: AssetFormSheet Category field has an icon `+` button positioned immediately to the right of the SelectTrigger
- **AC-1.2**: Clicking add category opens a compact modal/dialog with text input, Cancel, and Add buttons
- **AC-1.3**: New category name instantly becomes selected in f.category; submitted asset's stored category equals user's typed name
- **AC-1.4**: Admin/Manager roles ONLY see the add-category icon button; Staff see button disabled or hidden (nothing clicks)
- **AC-1.5**: After page refresh, new custom category still present in dropdown (localStorage persistence)
- **AC-2.1**: Staff dashed card appears AFTER Notes and BEFORE Cancel/Submit buttons in DOM order
- **AC-2.2**: All existing staff-select logic (employee list auto-select, manual input fallback, "custom" option) unchanged and still works
- **AC-3.1**: ExpenseFormSheet has NO Department field rendered anywhere
- **AC-3.2**: ExpenseFormSheet has NO Currency selector rendered anywhere; submitted expenses always have `currency === "UGX"` in backend DB row
- **AC-3.3**: ExpenseFormSheet has NO Payment method selector rendered anywhere; submitted expenses always have `payment_method === "cash"` (valid value)
- **AC-3.4**: Submitted expense has `department === ""` in backend DB (empty string or NULL acceptable)
- **AC-4.1**: "Reimbursable to employee" replaced with radio group of 2 options (Reimbursable / Not reimbursable)
- **AC-4.2**: Selecting Reimbursable radio → form.reimbursable === true; Not reimbursable → false
- **AC-5.1**: Backend `/api/expenses/<id>/decision` endpoint returns 403 for Staff user; only Admin/Manager get 200+ updated record
- **AC-5.2**: Backend `/api/expenses/<id>/reimburse` endpoint returns 403 for Staff user
- **AC-5.3**: Direct PATCH `/api/expenses/<id>` with body `{status: "approved"}` fails 403 for Staff
- **AC-5.4**: Frontend ExpensesTable hides Approve + Reject DropdownMenuItems for Staff users
- **AC-5.5**: Approval actor field (expenses.approved_by) receives the actual logged-in user name, not hardcoded "Faith Njeri"
- **AC-6.1**: Every backend write is persisted (decide → approved_by column, expense create → UGX/cash/department empty)
- **AC-6.2**: No new DB migration files are produced
- **AC-7.1**: All hooks in new/refactored functions declared BEFORE conditional returns (passes grep-based hook audit)
- **AC-7.2**: Post-change GetDiagnostics 0 errors for every touched file

### Rubric AC (0-2 scale; ≥1 pass threshold)

- **AC-8.1 Micro-interactions**: Do the category add modal + radio reimbursement group have pleasant, polished staggered entry animations?  
  *0=no animation, 1=basic fade, 2=spring staggered + active tints match Hero Banner brand 003399 violet accents, check-circle pop-in*
- **AC-8.2 Layout clarity**: After moving staff field + removing 3 expense selectors, are both forms less cluttered and visually balanced?  
  *0=fields cramped/jumbled, 1=acceptable, 2=visual weight balanced, dashed staff card feels rightfully-placed as attribution footer*
- **AC-8.3 Audit & role clarity**: Is role gating obvious AND complete (no approve buttons for staff + backend 403s)?  
  *0=approve still visible to Staff, 1=either frontend hidden OR backend 403 present, 2=BOTH frontend invisible AND backend 403 + approval actor real name*

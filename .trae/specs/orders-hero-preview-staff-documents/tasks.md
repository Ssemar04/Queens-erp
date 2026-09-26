# Tasks: Orders Page Hero Banner, Row-Level Preview UX, Single-Staff Handled-By, and Uganda-Compliant LPO Documents Sub-Page

Spec: `spec.md` in the same folder.
Review: `review.md` in the same folder (not yet created — produced during Review phase).

---

## Task 1: Orders Hero Banner + Dashboard KpiCard Grid

**Priority:** high
**Parent ACs:** AC-1, AC-2, partially AC-11 (motion timing)

**Scope:** `frontend/src/routes/app.orders.tsx` (top of return JSX + new helpers/memos)
Scope notes:
- Add `sectionIndex(key: string)` helper + `sections` string list with keys `hero`, `kpis`, `table`, `tabs`, `documents`.
- Compute `dashboardStats` useMemo over orders array:
  - `totalOrders`, `totalValue`, `openValue` (draft + confirmed + in_progress sum of `amount`), `pipelineCount` (confirmed + in_progress), `pipelineValue`, `overdueCount`, `overdueValue`, `deliveredThisMonth`, `deliveredThisMonthValue`.
  - Overdue calculation: `status !== delivered && status !== cancelled && new Date(dateToBeDelivered) < todayISO()`.
- Add todayISO() helper if file doesn't already export one.
- Hero motion section with gradient #003399→#004CCC, blur orbs, Sparkles chip "Orders hub", 1-week-activity count chip if any.
- Hero headline uses totalOrders + openValue + overdueCount rose inline tag.
- Hero actions (right): **New order** CTA (white bg / #003399 text, same as catalog New item).
- Copy the 4-KpiCard 2×2→md:4 grid from catalog verbatim (tones: brand, blue, rose, emerald) and place immediately after hero, before the tab bar.
- Move the existing top action row buttons (CSVExportButton, Import, New Item) — since these don't exist for orders (orders has only New order button) — keep the single New order CTA in hero (no second button above banner to avoid what user explicitly removed from catalog last session).
- Keep the existing EmptyState fallback (when `orders.length === 0`) as-is below the Kpi grid (no hero needed above empty state).
- The filter/search bar (`Input` with Search + Status + Date filter Selects) relocates to render BETWEEN the KpiCard grid and the table (not above the hero).
- Import missing icons: `Sparkles`, `Package`, `TrendingUp`, `AlertTriangle`, `TrendingDown`, `Boxes` from lucide-react if not already present (read existing first).

**Test Requirements:**
- TR 1.1 — rule: Hero present at top of JSX when orders.length >= 0 path; contains gradient banner with "Orders hub" chip + headline with totalOrders and openValue (code inspection + visual verify on localhost).
- TR 1.2 — rule: Four KpiCards rendered with correct tones: brand (Total orders), blue (Pipeline count/value), rose (Overdue, has onClick that sets status filter or equivalent), emerald (Delivered this month).
- TR 1.3 — rule: Search/filter bar is below KpiCard grid, not above hero (JSX order inspection).
- TR 1.4 — rubric (scale 0-2, threshold ≥ 2, AC-11 partial): motion fidelity. Score 2 = hero delay matches `0.02 * sectionIndex("hero")`, kpis delay `0.03 * sectionIndex("kpis")`, KpiCards use `whileHover={{ y: -2 }}` with matching cubic-bezier; otherwise partial score.
- TR 1.5 — rule: No TypeScript diagnostics (GetDiagnostics clean on app.orders.tsx).

---

## Task 2: Row-wide click preview + always-visible icon actions + stopPropagation bubbling guard

**Priority:** high
**Parent ACs:** AC-4, AC-5, partially AC-11 (row hover inset shadow)

**Scope:** `frontend/src/routes/app.orders.tsx` — `<TableRow key={o.id}>` block and its children (lines ~318 to ~427 in the current file).
Changes:
- TableRow: add `className="group cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[inset_3px_0_0_rgba(0,51,153,0.5),0_4px_20px_-8px_rgba(0,0,0,0.1)] hover:border-[#003399]/30"` (matches TransactionsTable exactly).
- TableRow: wrap row cells with an `onClick={() => setPreviewOrder(o)}` directly on the row, not on individual cells.
- Eye button: remove `opacity-0 group-hover:opacity-100 transition-all`, make opacity-100 permanent. Keep `h-7 w-7`. Keep hover shadow `[0_0_0_3px_rgba(59,130,246,0.12)]`. Add `onClick={(e) => e.stopPropagation()}` (to prevent row preview when explicitly clicking Eye — it already calls `setPreviewOrder(o)`, but stopPropagation prevents double-fire and any future nested logic).
- Trash2 button: identical opacity change, add `stopPropagation`.
- Status `<Select>` root (SelectTrigger or wrapping onClick): add `onClick={(e) => e.stopPropagation()}` on the trigger's wrapper so clicking status doesn't fire row preview.
- Handled-by `<Select>`: identical stopPropagation on trigger. If the inline Select uses a trigger that would swallow clicks, add the bubbling guard on the parent `<TableCell>` wrapper as `onClick={(e) => e.stopPropagation()}`.
- If any row has LPO, customer, items, amount that currently are plain text — leave them plain (they receive cursor via row class).

**Test Requirements:**
- TR 2.1 — rule: `TableRow` element has `cursor-pointer` class and `onClick={setPreviewOrder}` wiring (code inspection).
- TR 2.2 — rule: Eye button className has NO `opacity-0` (code search for `opacity-0` under action buttons → returns 0 matches for Eye/Trash).
- TR 2.3 — rule: Eye, Trash, Status Select, Handled-by Select all call `stopPropagation()` (or a cell ancestor does). Code inspection for `stopPropagation` in row block ≥ 4 instances.
- TR 2.4 — rule: Clicking row preview dialog opens for that order when clicking on e.g. LPO number cell (manual test or code check).
- TR 2.5 — rubric (scale 0-2, threshold ≥ 1, AC-11 partial): row hover visual. Score 2 = shadow class string EXACTLY matches TransactionsTable row (inset brand + outer negative spread shadow, same cubic-bezier duration). Score 1 = similar but different. Score 0 = no hover style.

---

## Task 3: OrderPreviewDialog Particulars sync (customerQuotation + full description + dedupe notes)

**Priority:** high
**Parent ACs:** AC-3

**Scope:** `frontend/src/routes/app.orders.tsx` — `OrderPreviewDialog` component (lines ~998 to ~1375, particulars block and notes block).
Changes:
- In Particulars header block (currently line ~1181–1250):
  - When `order.customerQuotation` is truthy AND `lineItems.length > 0`: insert a top banner block BEFORE the particulars line list — a rounded-lg border-dashed border-#003399/20 bg-#003399/[0.025] px-3 py-2 block with the "Customer quotation" chip heading (10-px uppercase) plus the full `customerQuotation` text as whitespace-pre-wrap.
  - When `lineItems.length === 0`: keep existing empty state but swap its body to show JUST the customerQuotation banner; remove "From customer quotation" sub-caption duplication.
  - Line item descriptions: remove the `line-clamp-2` class from line item description cell. Render full content. Add title attribute for hover anyway.
- In Notes section block (lines ~1253–1284): remove `order.customerQuotation` rendering — ONLY keep internal `order.notes`.
  - Update `sections` array from `...(order.customerQuotation || order.notes ? ["notes" as const] : [])` to only include notes when `order.notes` is truthy.
  - Update `sectionIndex` if the sections array changed (it won't functionally matter since customerQuotation is absorbed into particulars).
- Receipt print/export for orders: do NOT touch. Spec non-goal.

**Test Requirements:**
- TR 3.1 — rule: When customerQuotation non-empty + lineItems non-empty, particulars block starts with customer quotation banner (code inspection for banner inside particulars).
- TR 3.2 — rule: Line item particulars description no longer has `line-clamp-2` (grep for that class inside particulars block returns 0).
- TR 3.3 — rule: Notes section only renders when `order.notes` present (sections array excludes notes when only customerQuotation present, no duplicate customerQuotation rendering in notes section).
- TR 3.4 — rule: GetDiagnostics clean.

---

## Task 4: Handled By → single-staff semantics + new-order auto-default

**Priority:** high
**Parent ACs:** AC-6

**Scope (2 files):**
1. `frontend/src/routes/app.orders.tsx` — `OrderFormSheet` component AND order preview timeline copy.
2. New shared helper OR inline logic matching `AddSaleSheet.tsx`. DO NOT mutate `AddSaleSheet.tsx`; read it first and mirror its 4-step fallback algorithm into orders.

Steps:
- Examine `AddSaleSheet.tsx` default-staff fallback (memory says auth email → name inclusion → user_metadata → first branch employee). If uncertain, read the file and copy the pattern verbatim.
- Inside `OrderFormSheet`, add new `useEffect` or state initializer that pre-sets `setHandledBy(defaultStaffName)` using the mirrored fallback when the sheet opens AND handledBy is empty.
- In preview timeline: change the "Assigned to " + order.handledBy string literal to "Handled by " + order.handledBy. Remove the "Current ownership assignment" description line (optional, but keep description empty to align with transaction receipt style) — the spec just says copy-to "Handled by X".
- Preview totals block handledBy line (line ~1370): single name, no comma-join, no changes needed if already single-name.
- Orders table handledBy display: keep single-select (already correct), no multi.

**Test Requirements:**
- TR 4.1 — rule: New Order form opens with handledBy pre-filled (non-placeholder) when a match exists via the 4-step fallback (code inspection + dev run).
- TR 4.2 — rule: Order preview timeline event for handledBy uses copy exactly `"Handled by " + order.handledBy` (string search for "Handled by " in preview returns ≥ 1, "Assigned to " returns 0 in preview block).
- TR 4.3 — rule: HandledBy field everywhere stores single non-empty string (no arrays, no splits). Handled-by display never renders a comma-joined list.

---

## Task 5: Tab bar (Orders / Documents sub-pages) + document workspace layout

**Priority:** high
**Parent ACs:** AC-7, AC-8, AC-9 (UI side), partially AC-11

**Scope:** `frontend/src/routes/app.orders.tsx` — add state `activeTab: "orders" | "documents"` and tab segmented control, conditionally render `DocumentsWorkspace` inline component or keep existing Orders table.
- Tab bar: positioned BETWEEN KpiCard grid AND search filter bar (or, when tab="documents", between KpiCard grid and the DocumentsWorkspace). Use a Framer Motion `motion.div` with `layoutId="orders-tab-slider"` for the active pill.
- Tab bar styling: pill container bg-muted/40 rounded-full p-1 flex max-w-md mx-auto. Each tab button px-4 py-1.5 rounded-full text-sm font-medium transition-colors. Active: bg-#003399 text-white shadow. Inactive: text-muted-foreground hover:text-foreground.
- Add new inline `DocumentsWorkspace()` component inside OrdersPage (keeps scope on one file, avoids new routing). Props: orders, currentBranchId, isAdmin, isManager, inventoryItems, employees, customerNameMap.
- DocumentsWorkspace UI:
  - Top row: Sales Order selector (controlled select of ALL orders with search/chip filter — use Select component with LPO number + customer name as display; when selected show the chosen order as a chip).
  - When NO order selected: show empty chip picker with dashed hint.
  - 10 document-type cards in a responsive grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
  - For each type (keep ordered list):
    1. `lpo_signed` — Signed LPO / Purchase Order
    2. `tax_invoice_efris` — Tax Invoice (EFRIS compliant)
    3. `delivery_grn` — Delivery Note / Goods Received Note (GRN)
    4. `waybill_transport` — Waybill / Transport Document
    5. `tcc_ura` — Tax Compliance Certificate (TCC)
    6. `business_registration` — Certificate of Incorporation / Business Registration
    7. `supplier_quotation` — Supplier Quotation
    8. `payment_receipt` — Payment Confirmation / Receipt
    9. `inspection_quality` — Inspection / Quality Report
    10. `insurance_transit` — Insurance Certificate (Goods in Transit)
  - Every card (missing state): dashed-border, muted chip "Missing" rose. Upload drop zone + Upload file button (admin/manager only).
  - Every card (uploaded state): solid border, emerald chip "Uploaded", file name, size, uploaded by + date; Preview/Eye + Download/Download (always) + Replace/Upload new (admin/manager) + Delete/Trash (admin/manager).
  - Remarks textarea for each card at bottom (admin/manager editable, staff disabled).
- IMPORTANT: Role gating in UI (just a layer, backend enforces): `canManageDocs = isAdmin || isManager`. If `!canManageDocs`: Upload/Replace/Delete buttons are hidden, remarks is read-only. Preview + Download always visible.

**Test Requirements:**
- TR 5.1 — rule: Tab bar with "Orders" and "Documents" exists and switches activeTab state (code search for "Orders" / "Documents" labels in new segmented control block).
- TR 5.2 — rule: activeTab="orders" renders the orders search/table; activeTab="documents" renders DocumentsWorkspace (conditional render inspection).
- TR 5.3 — rule: DocumentsWorkspace renders exactly 10 doc cards matching the ordered list of titles (code array with 10 entries, titles exactly per AC-8 spec).
- TR 5.4 — rule: Preview + Download actions appear for all roles (no canManageDocs guard). Replace + Delete + remarks edit guarded by `isAdmin || isManager` in JSX.
- TR 5.5 — rubric (scale 0-2, threshold ≥ 2, AC-11 partial): tab & doc card polish. Score 2 = tab slider layoutId animation works, missing cards use dashed border with glow on hover, uploaded cards use emerald ring-1 + checkmark badge burst, remarks inputs match the shadcn/ui Textarea brand, enter animations are staggered per index * 0.04.

---

## Task 6: Backend `sales_order_documents` table + service + routes + role guard

**Priority:** high
**Parent ACs:** AC-10, NFR-2 (branch)

**Scope (4 files):**
1. `backend/services/database.py` — in `initialize_database()`, add idempotent CREATE TABLE for `sales_order_documents` (after the existing `sales_orders` and `purchase_orders` tables, keep pattern). Columns:
   - `id TEXT PRIMARY KEY`
   - `sales_order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE`
   - `document_type TEXT NOT NULL`
   - `file_name TEXT NOT NULL DEFAULT ''`
   - `file_type TEXT NOT NULL DEFAULT ''`
   - `data_url TEXT NOT NULL DEFAULT ''`
   - `size_bytes INTEGER NOT NULL DEFAULT 0`
   - `uploaded_by TEXT NOT NULL DEFAULT ''`
   - `uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
   - `remarks TEXT NOT NULL DEFAULT ''`
   - Also add UNIQUE for `(sales_order_id, document_type)` since one slot per type per order.
2. `backend/services/orders_service.py` — new functions `list_order_docs(order_id)`, `upsert_order_doc(data)` (or insert + update pair), `delete_order_doc(doc_id)`. Always join via `sales_orders.branch_id` or if sales_orders has no branch column, use the branch via service context pattern as other tables do. Actually since `sales_orders` is already branch-filtered via `X-Branch-ID` header in list_orders (check list_orders — if it has no filter currently but notes database is per-branch sub-file we can simplify: no need for explicit branch WHERE because each branch sub-sqlite is separate per prior memory). Given that pattern, the documents table just needs the `sales_order_id` FK.
3. `backend/routes/guards.py` — add helper `require_admin_or_manager()` returning `(user, error)`. Implementation: use the existing `require_current_user()` pattern then check `user["role"]` for admin/manager. If staff → return (None, jsonify with 403 and `Forbidden: Admin or Manager required.`).
4. `backend/routes/orders_routes.py` — new endpoints:
   - `GET /api/orders/<order_id>/documents` → `require_current_user()` → returns array of docs for order.
   - `POST /api/orders/<order_id>/documents` → `require_admin_or_manager()` → insert/replace (upsert by document_type for slot) or insert only (if doc_id client-supplied then insert). Use JSON body with `{documentType, fileName, fileType, dataUrl, sizeBytes, remarks}`.
   - `PATCH /api/orders/<order_id>/documents/<doc_id>` → `require_admin_or_manager()` → edit remarks / filename / re-upload.
   - `DELETE /api/orders/<order_id>/documents/<doc_id>` → `require_admin_or_manager()` → delete.
5. Bonus: seed `Signed LPO / Purchase Order` slot automatically from the existing `order.quotationAttachment` when document slot is empty and attachment exists — service layer OR frontend initial render does a "pre-seed" upload (frontend is simpler: if slot is empty but order has quotationAttachment, show a banner "Use existing quotation as signed LPO?" with a one-click promote button handled by manager/admin).

**Test Requirements:**
- TR 6.1 — rule: `sales_order_documents` CREATE TABLE present in database.init (code grep).
- TR 6.2 — rule: 4 new endpoints exist in orders_routes.py (GET/POST/PATCH/DELETE). GET uses require_current_user; POST/PATCH/DELETE use a manager-or-admin-role gate.
- TR 6.3 — rule: `require_admin_or_manager()` helper defined in guards.py or inline equivalent that returns 403 for staff (code inspection of the role check).
- TR 6.4 — rule: New service functions exist in orders_service.py or a dedicated documents_service.py (either is fine) that do DB CRUD.
- TR 6.5 — rule: Flask dev server starts without import/syntax errors (run `cd backend && python routes/orders_routes.py` import check OR via the normal start script — whichever project uses).

---

## Task 7: Frontend API bindings + `services/api.ts` + DocumentsWorkspace data flow

**Priority:** high
**Parent ACs:** AC-9, AC-8 (data loading), AC-10 (frontend integration)

**Scope (2 files):**
1. `frontend/src/services/api.ts` — add new functions:
   - `getOrderDocuments(orderId: string): Promise<OrderDocument[]>`
   - `uploadOrderDocument(orderId: string, doc: OrderDocumentInput): Promise<OrderDocument>`
   - `updateOrderDocument(orderId: string, docId: string, updates: Partial<OrderDocumentInput>): Promise<OrderDocument>`
   - `deleteOrderDocument(orderId: string, docId: string): Promise<void>`
2. `frontend/src/types/sales-order.ts` — new interfaces:
   - `type SalesDocumentType = "lpo_signed" | "tax_invoice_efris" | "delivery_grn" | "waybill_transport" | "tcc_ura" | "business_registration" | "supplier_quotation" | "payment_receipt" | "inspection_quality" | "insurance_transit";`
   - `interface OrderDocument { id: string; salesOrderId: string; documentType: SalesDocumentType; fileName: string; fileType: string; dataUrl: string; sizeBytes: number; uploadedBy: string; uploadedAt: string; remarks: string; }`
   - `interface OrderDocumentInput = Omit<OrderDocument, "id" | "salesOrderId" | "uploadedAt">` (or near equivalent).
3. `DocumentsWorkspace` (inside app.orders.tsx from Task 5) — data wiring:
   - Use react-query `useQuery(["orderDocuments", selectedOrderId])` to fetch docs on order change.
   - Use `useQueryClient` + `useMutation` for upload/update/delete with cache invalidation.
   - File picker with accept filter for common types `.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx` but accept anything ≤ 10 MB. Sonner toast reject if over 10 MB.
   - Preview rendering: if image `<img>` inline, if PDF `<iframe>` h-64 w-full, otherwise file-type download fallback.
   - File size pretty formatter: `(b) => b < 1024 ? b+" B" : b < 1024*1024 ? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(2)+" MB"`
   - Uploaded-by display: if employeeId matches → `employees.find(e => e.id === uploadedBy)?.name || uploadedBy || "Unknown"`

**Test Requirements:**
- TR 7.1 — rule: api.ts has the four new exported functions (code inspection).
- TR 7.2 — rule: types/sales-order.ts exports `OrderDocument` and `SalesDocumentType`.
- TR 7.3 — rule: DocumentsWorkspace uses react-query with cache invalidation; upload mutation calls Sonner toast on success/error (toast.success / toast.error).
- TR 7.4 — rule: File picker rejects files >10MB with a toast (code inspection of the onFileChange handler with `size > 10*1024*1024` guard).
- TR 7.5 — rule: GetDiagnostics clean on api.ts, sales-order.ts, app.orders.tsx.

---

## Task 8: Integration pass, polish touch-ups, AC-11 final sweep

**Priority:** medium
**Parent ACs:** AC-11 full fidelity, AC-12 (regression)

Scope — final integration sweep across files:
1. Ensure `OrderFormSheet` + `OrderPreviewDialog` + `DocumentsWorkspace` import all icons added.
2. Order empty state (orders.length === 0) still shows `EmptyState` with action Label correctly.
3. Apply the project rule: every new Button that uses an `h-7 w-7` icon button follows `size="icon" variant="ghost"` pattern.
4. Verify motion transitions throughout — ALL `motion.div` / `motion.section` / `motion.button` use the shared easing `[0.22, 1, 0.36, 1]` (copy cat catalog). Avoid negative `delay` values — guard with `Math.max(0, …)`.
5. Fix any negative animation delay edge cases from `sectionIndex` (if `sections.indexOf` returns -1, guard returns 0).
6. Ensure brand styling for Orders preview dialog band matches spec (kept at #003399 → #004CCC; no B/W forced for orders preview per spec — B/W rule applies only to receipt exporters print/canvas).

**Test Requirements:**
- TR 8.1 — rule: `GetDiagnostics` on `app.orders.tsx` → 0 diagnostics.
- TR 8.2 — rule: `GetDiagnostics` on `api.ts` → 0 diagnostics.
- TR 8.3 — rule: `GetDiagnostics` on `sales-order.ts` → 0 diagnostics.
- TR 8.4 — rule (AC-12): orders existing flows work (create/edit/delete/status/handledBy/preview) via manual spot check or existing unit-like end-to-end smoke steps (typecheck success counts as evidence sufficient if no test suite exists).
- TR 8.5 — rubric (scale 0-2, threshold ≥ 2, AC-11 holistic). Score 2 = every section of spec rubric checklist checked (stagger enter, hover lift, tab slider, dashed-doc hover, status burst, row inset shadow all confirmed present in code with classes/layoutId strings).

---

## Task 9: Independent review (Review phase only)

**Priority:** high (phase gate)
**Parent ACs:** all ACs (AC-1 → AC-12)
**Note:** This task is produced during Review. Create `review.md` then delegate a read-only independent review of spec + tasks + implementation artifacts to a fresh subagent (or separate read pass), producing Review Result = pass / fail / blocked. If fail, translate findings from Review into NEW pending remediation tasks appended to tasks.md AFTER this task (task numbers 10, 11, …) with Status: pending; remediation tasks are then processed in Implement phase and drain queue before re-review.

**Reviewer contract:**
- Must check each AC independently with separate evidence lines.
- Must confirm AC-6 (handledBy default) actually matches AddSaleSheet logic BY reading the file contents — not just trusting implementer.
- Must confirm Task 6 role gating on POST/PATCH/DELETE is enforced in routes (not just frontend UI).
- Must confirm AC-4 row click + stopPropagation for Eye/Trash/Selects are present and not leaking.
- Must confirm AC-3 dedup of customerQuotation from notes section (no double rendering).
- Rubric AC-11 scored 0-2 with concrete score + justification. Threshold ≥ 2.

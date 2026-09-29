# Sidebar: Orders → Bids Rebrand + Ugandan PPDA Bids Law Compliance
## Implementation Plan

## Task 1: Sidebar / BottomNav / Command Palette terminology + icon rebrand
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `Sidebar.tsx`: Confirm Operations nav-group label `Bids` and icon `Gavel` (with `ClipboardList` fallback if `Gavel` isn't exported from lucide-react). Ensure Purchases entry in Procurement group uses `ShoppingBag` unchanged.
  - `BottomNav.tsx`: NAV_ITEMS entry for `/app/orders` → label `Bids`, icon `Gavel` / fallback. Update imports.
  - `palette-pages.tsx`: Pages entry for `/app/orders` → label `Bids` (not "Bids & Procurement"), icon `Gavel` / fallback. Update imports and JSX.
  - Verify `Gavel` import resolution — if missing, use `ClipboardList` (already in app.orders.tsx L29 import set) to avoid the TagPlus import error from project memory lessons.
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-1.1: `cd frontend ; npx tsc --noEmit` exits 0. Evidence: exit code 0.
  - `rule` TR-1.2: `grep -n` confirms Sidebar Operations group / BottomNav / palette-pages contain label "Bids" and do NOT contain label "Orders" (except as part of the URL path `/app/orders`). Evidence: grep output.
  - `rule` TR-1.3: Sidebar Procurement-group Purchases entry still icon ShoppingBag. Evidence: Sidebar.tsx L77-80 grep.
  - `rubric` TR-1.4: Icon semantic appropriateness. Scale 1-5; 1=ShoppingBag; 3=different but non-obvious; 5=Gavel/ClipboardList well-known legal/procurement icon, renders h-4 w-4. Threshold >= 4. Evidence: rendered DOM snapshot.

## Task 2: Roles + RouteGuard + UserAccountModal + FAQ + ItemDetailSheet terminology cleanup
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `roles.ts`: In 5 arrays, change `"Orders"` → `"Bids"`: L61 (ACCESS_ROLE_PRESETS manager allowedModules), L70 (cashier), L77 (inventory clerk), L120 (SYSTEM_ROLES.manager accessibleModules), L131 (SYSTEM_ROLES.staff accessibleModules). ALL_SYSTEM_MODULES L15 is already correct (`name: "Bids"`).
  - `route-guard.ts` L7: Change comment `// Orders` → `// Bids` (visual / documentation only).
  - `UserAccountModal.tsx` L552: Change SelectItem label `Sales Orders` → `Bids`.
  - `faq-data.ts` L32 FAQ title: `Sales, transactions & orders` → `Sales, transactions & bids`. L37 FAQ answer: `"On the Orders page you can attach a detailed quotation as text plus an image or PDF file. Customers receive the same document you store."` → `"On the Bids page you can attach a detailed tender quotation as text plus an image or PDF file. Procuring entities receive the same document set you store."`.
  - `ItemDetailSheet.tsx`: L426 span `Sales Orders` → `Bids & Tenders`; L442 comment + L445 span `Sales Orders Containing` → `Bids & Tenders Containing`; L454 description `When sales orders are created containing this product, the LPO breakdown and income will automatically populate here.` → `When bids are created containing this product, the LPO breakdown and contract income will automatically populate here.`.
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `rule` TR-2.1: `grep -cE '"Orders"|// Orders|Sales Orders|On the Orders page' frontend/src/lib/roles.ts frontend/src/lib/route-guard.ts frontend/src/components/settings/UserAccountModal.tsx frontend/src/lib/faq-data.ts frontend/src/components/catalog/ItemDetailSheet.tsx` = 0 hits. Evidence: grep stdout.
  - `rule` TR-2.2: `npx tsc --noEmit` 0 errors in frontend/. Evidence: exit code.
  - `rule` TR-2.3: For each of 6 roles, the allowedModules/accessibleModules cardinality is unchanged pre vs post edit (Admin = all, Manager = 15, Cashier = 5, Inventory = 7, Accountant = 8, Staff = 6). Evidence: manual line count.

## Task 3: app.orders.tsx internal legacy strings — Decline dialogs, Form titles, Empty states, Placeholders
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `DeclineReasonDialog` title (L196): `Decline Order / LPO ({order.lpoNumber})` → `Decline Bid / Tender ({order.lpoNumber})`.
  - `DeclineReasonDialogBody` description (L198-199): `"Please provide a reason for declining this order from <span>…</span>"` → `"Please provide a reason for disqualifying / declining this bid from <span>…</span>"`.
  - Decline textarea placeholder (L209): Replace with PPDA-aware text: `State why this bid / tender / LPO is disqualified, withdrawn or declined (e.g., failed technical evaluation, missing PPDA clearances, pricing non-responsive, cancelled by procuring entity)…`.
  - `OrderFormSheet` SheetTitle (L3442): `New sales order` → `New Bid & Tender Submission`.
  - `OrderFormSheet` SheetDescription (L3443): `Register a Local Purchase Order received from a customer.` → `Register a tender, LPO, or bid submission received from a procuring and disposing entity (PDE) under the PPDA Act.`.
  - `EmptyState` messages in Tenders & Bids tab (around L698): title `Loading orders` → `Loading bids`; title `No orders yet` → `No bids yet`; description `Create your first sales order…` → `Create your first bid…`; actionLabel `New order` → `New Bid`.
  - Check any remaining UI strings (not variable / function names) containing case-insensitive "sales order" or "orders" that clearly refer to the bid workspace, not to suppliers purchase orders. Specifically leave references like `getPurchaseOrders` in the suppliers module untouched.
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TR-3.1: Case-insensitive grep of app.orders.tsx for the regex pattern `(\bDecline Order\b|\bNew sales order\b|\bNo orders yet\b|\bLoading orders\b|\byour first sales order\b|\bsales order\b)` returns 0 matches in JSX strings / string literals (not imports, function names, or identifiers in comments referencing the type `SalesOrder`). Evidence: grep output.
  - `rule` TR-3.2: `tsc --noEmit` 0 errors after edits. Evidence: exit code.

## Task 4: Backend VALID_STATUSES + ppda_compliance column migration + serializer + create/update binding
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `orders_service.py` L8 VALID_STATUSES: extend set to include all 12 PPDA literals: `{"draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte","awarded","contract_signed","complete","declined"}`. Retain legacy aliases `"successful"→"awarded"`, `"confirmed"→"submitted_egp"`, `"in_progress"→"tech_eval"`, `"delivered"→"awarded"`, `"cancelled"→"declined"` with a runtime normalisation helper `_normalize_status(s)` applied before INSERT/UPDATE at create_order L101 and update_order L100 (so coerce invalid status like frontend legacy strings, rather than silently substituting the default, which is the current behaviour that causes data loss).
  - `database.py` sales_orders CREATE TABLE (L740-762): add `ppda_compliance TEXT,` column. In the init/startup migration sequence (find the existing migrate helper that runs ALTER TABLE for prior upgrades), add a guarded `try: ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS ppda_compliance TEXT; except: …` with a PRAGMA table_info(sales_orders) fallback, matching the project migration style.
  - `serializers.py` sales_order_from_row (L284-349): add JSON-safe getter for `ppda_compliance` → deserialize via `json.loads` default `{}` / None; bind to key `ppdaCompliance` on returned dict (camelCase to match frontend SalesOrder type convention, same pattern as `lpoNumber`, `dateReceived`).
  - `orders_service.py` update_order L168-188 column_map: add `"ppdaCompliance": "ppda_compliance"`, and when building UPDATE params, JSON-dumps the value (consistent with how `complaints` and `account_details` are handled — wrap None as None, otherwise `json.dumps(val)`).
  - `orders_service.py` create_order INSERT L81-112: Add `ppda_compliance` to the column list and bind `json.dumps(data.get("ppdaCompliance")) if data.get("ppdaCompliance") else None`. Consistent with `complaints` / `account_details` style. Also wrap `data.get("status")` via the `_normalize_status()` helper defined above at L101 before binding (to handle legacy frontend literals).
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-4.1: VALID_STATUSES includes all 12 PPDA literals plus 5 legacy alias literals kept for coercion (via the normalize helper). Evidence: source of orders_service.py VALID_STATUSES + normalize helper.
  - `rule` TR-4.2: database.py migration adds ppda_compliance column idempotently without error on repeat runs AND serializers.py returns ppdaCompliance key. Evidence: source diff + `python -c "from services.database import get_db; db=get_db(); cols=[r[1] for r in db.execute('PRAGMA table_info(sales_orders)').fetchall()]; print('ppda_compliance' in cols)"` returns `True` on fresh init.
  - `rule` TR-4.3: create_order / update_order both serialize ppdaCompliance JSON to the column. update_order column_map includes the mapping. Evidence: source diff.
  - `rule` TR-4.4: `python -m py_compile backend/routes/orders_routes.py backend/services/orders_service.py backend/services/database.py backend/models/serializers.py backend/routes/guards.py` exits 0. Evidence: exit code.

## Task 5: Frontend types — OrderStatus union review + PpdaComplianceDetails audit (ensure 8 checklist + 2 committee + 6 timestamps + 4 preference present)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - `sales-order.ts` L1-13: Replace `OrderStatus` union (which currently already has the 12-stage pipeline in types per exploration L1-13) to confirm EXACTLY: `"draft" | "advertised" | "submitted_egp" | "bid_opened" | "tech_eval" | "fin_eval" | "evaluated" | "contracts_cmte" | "awarded" | "contract_signed" | "complete" | "declined"`. Remove old `successful` alias from the frontend type (leave legacy coercion in migrateOrder only, not in type itself). If the type still has 3 values, expand to 12.
  - `PpdaComplianceDetails` (L95-130): Audit the interface and ADD any of the following fields that are currently missing:
    ```ts
    uraTccStatus?: ComplianceStatus;
    nssfClearanceStatus?: ComplianceStatus;
    ppdaCertStatus?: ComplianceStatus;       // PPDA ROP registration
    ursbStatus?: ComplianceStatus;           // URSB incorporation
    auditedAccountsStatus?: ComplianceStatus;
    bidSecurityStatus?: ComplianceStatus;
    prnProofStatus?: ComplianceStatus;       // PRN fee proof
    declarationsStatus?: ComplianceStatus;   // Anti-corruption declarations
    bidOpenedAt?: string;
    techEvaluatedAt?: string;
    finEvaluatedAt?: string;
    awardedAt?: string;
    contractSignedAt?: string;
    standstillEndDate?: string;
    evaluationCommittee?: string[];  // employee names
    contractsCommittee?: string[];   // employee names
    domesticContentPct?: number;
    preferenceMarginPct?: number;
    evaluatedPriceAdjusted?: number;
    ```
    The `ComplianceStatus` type at L93 is already defined `"valid" | "pending" | "expired" | "not_required"` — reuse it for all 8 checklist fields.
  - Confirm `ProcurementMethod` L86-91 includes all 5 values: open_domestic, open_international, restricted_bidding, request_for_quotation, micro_procurement. Add any missing.
- **Acceptance Criteria Addressed**: AC-5, AC-6
- **Test Requirements**:
  - `rule` TR-5.1: OrderStatus has exactly 12 members; successful literal is removed from the type (exists only as coerced runtime alias in migrateOrder). Evidence: type definition + tsc --noEmit 0 errors.
  - `rule` TR-5.2: PpdaComplianceDetails includes 8 checklist status fields, 6 lifecycle timestamps, 2 committee string arrays, and 4 preference/price fields, all typed optional (?:). Evidence: interface definition diff.
  - `rule` TR-5.3: `npx tsc --noEmit` 0 errors after edits. Evidence: exit code.

## Task 6: migrateOrder + STATUS_META rebuild (3 → 12 stages) with semantic colours and icons
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - In `app.orders.tsx` around L125-150:
    - Rewrite `STATUS_META` to have entries for ALL 12 OrderStatus members with labels, colour classes, icons:
      - draft: Slate bg-slate-500/10 text-slate-600 dark:text-slate-500 icon FilePlus label "Draft"
      - advertised: Sky bg-sky-500/10 text-sky-600 dark:text-sky-500 icon Megaphone label "Advertised / Invited"
      - submitted_egp: Indigo bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 icon Send label "Submitted on e-GP"
      - bid_opened: Violet bg-violet-500/10 text-violet-600 dark:text-violet-500 icon FolderOpen label "Bid Opened (Public)"
      - tech_eval: Amber bg-amber-500/10 text-amber-600 dark:text-amber-500 icon ClipboardCheck label "Under Technical Evaluation"
      - fin_eval: Orange bg-orange-500/10 text-orange-600 dark:text-orange-500 icon Calculator label "Under Financial Evaluation"
      - evaluated: Teal bg-teal-500/10 text-teal-600 dark:text-teal-500 icon CheckSquare label "Evaluated (BEB Shortlist)"
      - contracts_cmte: Blue bg-blue-500/10 text-blue-600 dark:text-blue-500 icon Users2 label "Contracts Committee"
      - awarded: Emerald bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 icon Trophy label "Awarded (BEB Notice)"
      - contract_signed: Emerald-700 bg-emerald-600/15 text-emerald-700 dark:text-emerald-600 icon Signature label "Contract Signed"
      - complete: Emerald-900 bg-emerald-800/15 text-emerald-800 dark:text-emerald-700 icon CheckCircle2 label "Complete / Delivered"
      - declined: Rose bg-destructive/10 text-destructive dark:text-rose-400 icon XCircle label "Declined / Disqualified"
    - Rewrite `OLD_STATUS_MAP` + `migrateOrder` to map: draft→draft, confirmed→submitted_egp, in_progress→tech_eval, delivered→awarded, cancelled→declined, submitted→submitted_egp, successful→awarded, decline→declined.
    - Ensure migrateOrder still accepts unknown strings (returns "submitted_egp") to avoid uninitialised-status crashes.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-6.1: STATUS_META has exactly 12 entries with non-empty label/cls/icon tuples for every OrderStatus literal. Evidence: object literal diff.
  - `rule` TR-6.2: migrateOrder is called at page load and returns typed OrderStatus (not string / any) for a representative legacy fixture with each of the 9 old literals. Evidence: TypeScript inference success via `tsc --noEmit` 0 errors.
  - `rubric` TR-6.3: Colour and icon semantic fidelity with FR-13. Scale 1-5; 1=random colors; 3=half match; 5=exact scheme per FR-13 mapping (slate→draft→FilePlus, sky→advertised→Megaphone, indigo→submitted_egp→Send, violet→bid_opened→FolderOpen, amber→tech_eval→ClipboardCheck, orange→fin_eval→Calculator, teal→evaluated→CheckSquare, blue→contracts_cmte→Users2, emerald→awarded→Trophy, em-700→signed→Signature, em-900→complete→CheckCircle2, rose→declined→XCircle). Threshold >= 4. Evidence: STATUS_META cls + icon.

## Task 7: PpdaPreferenceBadge component + Micro-procurement badge + Evaluated-price detail sheet section
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 4, 5
- **Description**:
  - Create `PpdaPreferenceBadge(order: SalesOrder)` in `app.orders.tsx`:
    - Returns `React.Fragment` with 0-2 badges.
    - Badge A — Micro-procurement: if `amount < 5_000_000` OR (works-bid heuristic from items, fall back if unk: `amount < 10_000_000` && `isUgandanLocalContent == true` works path) → render a slate/neutral Badge `"Micro-procurement"` with `Info` Tooltip: `"PPDA Act Schedule 4 (2023 Amendment) — Micro-procurement threshold: < UGX 5M supplies/services, < UGX 10M works. No bidding documents or Contracts Committee required."`
    - Badge B — Local preference margin: if `ppdaCompliance?.isUgandanLocalContent === true` AND `(ppdaCompliance?.domesticContentPct ?? 0) > 30`:
      - If items are dominated by physical goods (heuristic: non-asset or inventory items) → `"15% Local Preference"` Emerald Badge + tooltip `PPDA Act Schedule 3 — Domestically manufactured goods preference (value-add ≥30%): 15% margin added to the evaluated price of foreign-manufactured bids.`
      - If works/services (heuristic: large-format, fargo-printer, digital-printer asset services or items without an inventory itemId) → `"7% Local Preference"` Emerald Badge + tooltip `PPDA Act Schedule 3 — Domestic works & services preference: 7% margin added to the evaluated price of foreign-provider bids.`
  - Insert `PpdaPreferenceBadge(o)` into the Tenders & Bids tab TableRow cell alongside LPO number and Amount — place before the amount cell (or in Status cell before status badge — chosen for visual balance).
  - In `OrderPreviewDialog` / bid preview detail sheet (choose the sheet that shows the bid amount line), add a new card `"Evaluated Price (PPDA Schedule 3)"` immediately after Amount, with 3 rows:
    - (1) Base bid amount → mono font `UGX {amount}`
    - (2) Foreign supplier adjustment → if `isUgandanLocalContent === false` AND bid is eligible for preference: show bold `+15% / +7%` for foreign adjustment with `line-through` on the local-bid adjusted zero-line to indicate non-application for this bid.
    - (3) Adjusted evaluated price → HERO bold mono font `UGX {adjusted}`, with `adjusted = amount * (1 + preferenceMarginPct/100)` computed from preferenceMarginPct (0 / 7 / 15) stored on ppdaCompliance.
  - Stagger entrance for the evaluated-price card using Framer `motion.div` 0.04 delay matching existing sheet animations.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-7.1: PpdaPreferenceBadge renders Micro-procurement badge for amount <5M with correct threshold tooltip; renders 15%/7% badge only when local-content flag true AND domestic-content >30%. Evidence: JSX conditionals + tooltip literal strings.
  - `rule` TR-7.2: Evaluated-price card in the preview sheet has 3 rows (base, adjustment line, bold adjusted total) with correct math using preferenceMarginPct. Evidence: JSX fragment + calc formula.
  - `rubric` TR-7.3: Badge and evaluated-section clarity and fidelity. Scale 1-5; 1=no badges present; 3=badges present no tooltips; 5=Micro badge + 15%/7% badges with correct Schedule 3/4 tooltip text, evaluated-price section uses brand card style (rounded-xl, border, bg-white/5), Framer stagger entrance. Threshold >= 4. Evidence: Snapshot of bid row and detail sheet.

## Task 8: PPDA Compliance Tab (#4) — Compliance Overview Grid + 12-Stage Lifecycle Kanban Timeline
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 5, 6
- **Description**:
  - Tab bar: Confirm activeTab enum is `"documents" | "lpo" | "orders" | "ppda"` (L248). Update tab L597-623 labels to tab array order 0=Documents, 1=LPO & Awarded, 2=Tenders & Bids (filtered.length count), 3=PPDA Compliance with label "PPDA Compliance" (NOT the current "Documents/LPO/Orders/ppda" set of labels — rename orders-tab label to Tenders & Bids per FR-17).
  - PPDA Workspace Section 1 — Compliance Overview Grid (role-gated):
    - For each open bid (status NOT IN complete/declined), a compact row. Columns: LPO #, Customer, Bid Stage (STATUS_META badge), then 8 clickable status chips for URA TCC / NSSF / PPDA ROP / URSB / Audited / BidSec / PRN / Declarations using `ComplianceStatus` color scheme Emerald valid, Amber pending, Rose expired, Slate not_required.
    - Clicking a chip opens a Select dropdown picker ONLY for Admin/Manager roles (canManageDocs flag already computed L489); staff renders a disabled `ShieldAlert` inline `"Restricted to Admin / Manager — PPDA §16(2) Contracts Committee"`.
    - On-select → call `updateOrder(id, { ppdaCompliance: { ...existing, field: newValue } })` using the handleUpdateOrder helper.
  - PPDA Workspace Section 2 — Lifecycle Timeline Kanban (12-stage vertical columns):
    - 12 named column headers using STATUS_META.label, each with a `rounded-full` count Badge of bids in that stage.
    - Per-stage column: list bid chips `LPO # / Customer / Amount` small cards with Framer stagger entrance.
    - NO drag-and-drop (no new npm packages). Instead, each bid chip renders a small `Move to stage →` dropdown with the 12 statuses; dropdown role-gated Admin/Manager → enabled; staff → disabled ShieldAlert. On-select → `handleStatusChange(id, newStatus)`.
    - Wrap grid/timeline with motion.div stagger.
- **Acceptance Criteria Addressed**: AC-7, AC-9
- **Test Requirements**:
  - `rule` TR-8.1: Tab bar label Tenders & Bids (not "Orders" / "Bids" alone), tab order Documents / LPO / Tenders & Bids / PPDA Compliance. activeTab "ppda" renders both grid + kanban, tsc 0 errors. Evidence: JSX tab labels + rendering fragments.
  - `rule` TR-8.2: For a staff role, the compliance-chip edit select and the per-bid stage move dropdown are disabled with ShieldAlert + PPDA §16(2) text; Admin/Manager users see full edit. Evidence: role-gate JSX conditional.
  - `rubric` TR-8.3: PPDA tab visual polish. Scale 1-5; 1=raw divs; 3=plain table; 5=Emerald/Amber/Rose/Slate status chips, 12-stage kanban with count badges, Framer stagger (staggerChildren 0.04 delayChildren 0.03), hover tint on bid chips. Threshold >= 4. Evidence: Snapshot.

## Task 9: New Bid form sheet — PPDA Classification Card + Compliance Status Card + Evaluation & Award Attribution Card
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 4, 5
- **Description**:
  - In `OrderFormSheet` (L3136), add three `motion.div` cards after the existing Bid Amount section and before Footer action buttons, with brand dashed-border gradient style mirroring AssetFormSheet classification card (rounded-xl border-[#003399]/25 dashed ring-1 bg-gradient-to-br from-[#003399]/[0.03] via-white to-white shadow-xs stagger 0.04 0.08 0.12).
  - **Card 1 — PPDA Classification**:
    - Procurement Method: Select bound to `ppdaCompliance.procurementMethod` using enum ProcurementMethod (open_domestic → "Open Domestic Bidding (≥ UGX 500M, Sched 4)", open_international → "Open International Bidding", restricted_bidding → "Restricted Bidding (Shortlisted Providers)", request_for_quotation → "Request for Quotation", micro_procurement → "Micro-Procurement (< UGX 5M / 10M works)").
    - Preference Scheme Eligibility: Checkbox toggling `isUgandanLocalContent` + `isMsmeReservationScheme`.
    - Domestic Content %: Input type=number min=0 max=100 binding `domesticContentPct`. Info icon tooltip: `"Must exceed 30% domestic value-add for manufactured goods to qualify for the 15% preference margin (PPDA Act Schedule 3)."`
    - Bid Security: Switch toggling `bidSecurityRequired`. When toggled on → reveal number inputs `bidSecurityAmount` (UGX), `bidSecurityValidityDays` (days), `bidSecurityIssuer` (text: bank / insurer name). Default: false.
  - **Card 2 — Compliance Status (Pending by Default)**:
    - Grid 2×4 of Selects (8) for each checklist field: uraTccStatus, nssfClearanceStatus, ppdaCertStatus (label "PPDA ROP Status"), ursbStatus (label "URSB Incorporation"), auditedAccountsStatus, bidSecurityStatus, prnProofStatus (label "PRN Fee Proof"), declarationsStatus (label "Anti-Corruption Declarations"). Each has options valid / pending / expired / not_required. Default pending for all 8.
  - **Card 3 — Evaluation & Award Attribution**:
    - Evaluation Committee: Multi-Select (use Checkbox list or Select multi if the UI already has a multi-select primitive; if no multi-select exists, use a comma-split textarea labelled "Employee names, comma-separated" binding evaluationCommittee string[] by splitting on submit) from current branch employees.
    - Contracts Committee: Same multi-select pattern. Info icon tooltip: `"Contracts Committee (PPDA Regs 2023) = 5 members (Chair + 3 + Secretary); Central Govt PDEs require 1 external lawyer. Quorum = 3/5."`
    - Standstill End Date: `Input type="date"` binding standstillEndDate; Info tooltip `"PPDA Section 91A / Admin Review Regs 2023: MANDATORY 10 WORKING DAYS after BEB notice publication before contract signature or LPO execution."`
    - Lifecycle dates (5): Bid Opened At, Tech Evaluated At, Fin Evaluated At, Awarded At, Contract Signed At — 5 date inputs bound to the corresponding timestamp fields on PpdaComplianceDetails.
  - **Submit handler**: In submit() around L3412, collect the local form state of the 3 cards and merge into `onCreate({ ...existingPayload, ppdaCompliance: mergedCompliance })` where mergedCompliance includes existing fields plus all the new card-bound fields. Ensure existing fields like procurementMethod that the user already set are preserved.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-9.1: New Bid sheet renders 3 cards (Classification / Compliance Status / Evaluation & Award) after Bid Amount and before footer buttons, with all 20+ editable controls present. Evidence: DOM snapshot of full sheet.
  - `rule` TR-9.2: Form submit handler merges ppdaCompliance nested object into onCreate payload. Evidence: submit handler source diff.
  - `rule` TR-9.3: `tsc --noEmit` 0 errors after form edits. Evidence: exit code.
  - `rubric` TR-9.4: Card visual fidelity with AssetFormSheet brand. Scale 1-5; 1=raw inputs; 3=card containers no dashed; 5=rounded-xl dashed border-[#003399]/25, 3-gradient cards stagger 0.04/0.08/0.12, info icons with correct tooltips, domestic-content 30% threshold, 10-WD standstill hint, Contracts Cmte 5-member + lawyer + quorum. Threshold >= 4. Evidence: Side-by-side snapshot vs AssetFormSheet Classification card.

## Task 10: Tenders & Bids tab label + Row interactions (hover tint + click to preview + action stopPropagation + role-gated advanced stage moves)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 2, 6
- **Description**:
  - Tab L603 label update: `Bids (${filtered.length})` → `Tenders & Bids (${filtered.length})`.
  - TableRow cursor-pointer className + `onClick={() => setPreviewOrder(o)}` and `transition-all hover:bg-[#003399]/[0.025]` already partly present; ensure it's consistently applied.
  - Inner button onClick stopPropagation: Eye button L841, Trash button L851, Status Select L814, HandledBy Select L774 — each already has `onClick={(e) => e.stopPropagation()}` on wrapper — VERIFY none are missing (especially status badge cell wrapper L813 and handled by cell wrapper L773 which both contain Selects that would otherwise trigger the row preview on open).
  - Add role-gated stage-move restriction: the per-row Status Select (L814-831) that currently allows ALL 3 statuses → now allows the full 12 statuses BUT for non Admin/Manager users, the advanced-stage options (evaluated, contracts_cmte, awarded, contract_signed) are rendered with `disabled` + `ShieldAlert` suffix text `(Admin/Manager only — PPDA §16(2) Contracts Cmte)` in the SelectItem label. Users CAN still move bid between draft, advertised, submitted_egp, bid_opened, tech_eval, fin_eval, complete, declined. Only the 4 restricted stages are locked.
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `rule` TR-10.1: Tab label reads `Tenders & Bids (N)` — exact string. Evidence: JSX literal.
  - `rule` TR-10.2: Row onClick triggers preview; inner buttons Eye/Trash/Status Select/HandledBy Select each stop propagation. Evidence: onClick + stopPropagation on each wrapper.
  - `rule` TR-10.3: For non-Admin/Manager role, the 4 advanced stage options (evaluated, contracts_cmte, awarded, contract_signed) are disabled in Status Select with ShieldAlert suffix; other 8 stages enabled. Evidence: JSX conditional rendering disabled={!canManageDocs && [4 restricted stages].includes(val)}.

## Task 11: Hero KPI strip update — 4 cards with PPDA counters and Rose/Emerald compliance-gap toggle
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 5, 6
- **Description**:
  - Update dashboardStats useMemo (L336) to add 2 new computed fields for the new KPIs:
    - `evalCount = orders.filter(o => o.status === 'tech_eval' || o.status === 'fin_eval').length` + `evalValue` (sum of amounts)
    - `stagesInProgressCount = orders.filter(o => ['draft','advertised','submitted_egp','bid_opened','tech_eval','fin_eval','evaluated','contracts_cmte'].includes(o.status)).length`
    - `complianceGapCount`: iterate open bids (same list as stagesInProgressCount), for each collect the 8 statuses, count how many are pending or expired → total.
  - Update the 4 KPI cards (L555-587):
    - Card 1: label "Total Tenders" (keeps icon Package / Gavel), hint "UGX X lifetime" → tone brand
    - Card 2: label "Under Evaluation" (Clock), value evalCount, hint UGX evalValue tendered → tone amber
    - Card 3: label "Stages In Progress" (GripVertical / FolderKanban), value stagesInProgressCount, hint stagesInProgressCount >0 ? "Draft through Contracts Cmte" : "Pipeline idle"; onClick: setActiveTab("ppda"), setOverdueOnly(false); tone blue
    - Card 4: label "Compliance Gaps", value complianceGapCount, tone ROSE if complianceGapCount>0 else EMERALD; hint complianceGapCount>0 ? `${complianceGapCount} pending / expired items` : "All clear — statutory checklist complete"; onClick: setActiveTab("ppda") (jump to compliance grid). When complianceGapCount=0 show icon ShieldCheck; when >0 show icon ShieldAlert.
  - Preserve existing gradient Hero brand skeleton + motion.section y:-6→0 stagger animations + blur-3xl orbs + badge text "Bids & PPDA Procurement Hub".
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-11.1: 4 KPI cards with correct titles; evalCount = tech+fin sum; stagesInProgressCount includes 8 open pipeline stages; complianceGapCount counts pending+expired across checklist of open bids; compliance-gaps card toggles class tone Rose if count>0 else Emerald with "All clear" label. Evidence: useMemo calculations + cls bindings.
  - `rubric` TR-11.2: Hero brand fidelity. Scale 1-5; 1=wrong gradient; 3=correct gradient no stagger entrance; 5=gradient from-[#003399] via-[#003399] to-[#004CCC], blur-3xl orbs, motion.section y:-6→0 stagger 0.02×sectionIndex. Threshold >= 4. Evidence: Hero JSX class strings.

## Task 12: PpdaComplianceWorkspace (existing 3-tile banner component) — e-GP 2.0 2026 upgrades
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 6, 7
- **Description**:
  - Update overview banner badge (L4870-4872): `PPDA Act 2003 / 2023 Guidelines` → `PPDA Act (Cap 205) · 2023 Regs · e-GP 2.0 — July 2026`
  - Tile 1 — Statutory Clearances (L4884-4906): add a 4th entry for `PPDA Register of Providers (ROP)` with Badge "Active Provider" alongside the 3 existing. Under the tiles add L4903 a small italic hint: `Circular 6/2025 — Amended Standard Bidding Documents (SBD 2025) now in force.`.
  - Tile 2 — Local Content Preference (L4908-4923): add a sub-badge below the 15% Margin line: `Badge variant=outline bg-violet-50 text-violet-700 border-violet-200 MSME Reservation · Women/Youth/PWD Preferences`. Update Hint L4916-4917 to: `Ugandan National & Resident Provider reservation margins automatically applied to competitive tenders under Section 50 of the PPDA Act + MSME reservation scheme for Women/Youth/PWDs under e-GP 2.0.`
  - Tile 3 — Standstill (L4925-4941): Add a live countdown line: `Countdown: {computeWorkingDaysRemaining()} working days to standstill end` computed by summing WORKING days (skip weekends + hardcoded 2026 Uganda public holidays) from todayISO() up to standstillEndDate on the earliest BEB-noticed bid. Also update L4937-4939 hint text: `Standstill tracker active on pending awards.` → `Mandatory 10 WORKING DAYS (Sec 91A / Admin Review Regs 2023) post-BEB before contract signature. ${bidSecurityCount} with bid security guarantee.`
  - Procurement-method threshold tiles (L4944-4971): update 4 thresholds with Sched 4 2023 labels:
    - Open Domestic: `Above UGX 500M threshold (Sched 4 2023)`
    - Restricted Bidding: `Shortlisted providers · Pre-qualified register`
    - Request for Quotation: `Under Sched-4 threshold · ≥3 quotations required`
    - Micro-Procurement: `< UGX 5M supplies / < UGX 10M works (Sched 4 2023)`
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rubric` TR-12.1: e-GP 2.0 factual coverage and visual polish. Scale 1-5; 1=no updates; 3=badge updated missing MSME/countdown/SBD-2025/Sched-4 labels; 5=Badge full act+regs+e-GP 2.0, PPDA ROP 4th clearance entry, Circular 6/2025 hint, MSME/Women/Youth/PWD sub-badge, working-day countdown, all 4 thresholds labeled Sched 4 2023, Framer stagger preserved. Threshold >= 4. Evidence: Snapshot of PpdaComplianceWorkspace header + 3 tiles + threshold section.

## Task 13: Full TypeScript + Python compile + GetDiagnostics sweep
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1-12
- **Description**:
  - `cd frontend ; npx tsc --noEmit --pretty false` — exit 0.
  - `cd frontend ; npx eslint src/components/layout/Sidebar.tsx src/components/layout/BottomNav.tsx src/components/command/palette-pages.tsx src/lib/roles.ts src/lib/route-guard.ts src/components/settings/UserAccountModal.tsx src/lib/faq-data.ts src/components/catalog/ItemDetailSheet.tsx src/types/sales-order.ts src/routes/app.orders.tsx` → 0 ESLint errors (warnings allowed; Tailwind v4 migration or unused-import hints ignored).
  - `python -m py_compile backend/routes/orders_routes.py backend/services/orders_service.py backend/services/database.py backend/models/serializers.py backend/routes/guards.py` — exit 0.
  - Run VSCode GetDiagnostics. 0 semantic TypeScript errors across all touched files.
- **Acceptance Criteria Addressed**: AC-12, NFR-1, NFR-3
- **Test Requirements**:
  - `rule` TR-13.1: `npx tsc --noEmit` exit code = 0. Evidence: stdout + exit.
  - `rule` TR-13.2: `py_compile` exit code = 0 across 5 backend files. Evidence: stdout + exit.
  - `rule` TR-13.3: GetDiagnostics shows 0 TS semantic errors on touched files. Evidence: Diagnostic JSON.

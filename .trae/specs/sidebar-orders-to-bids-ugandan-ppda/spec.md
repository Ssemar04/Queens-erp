# Sidebar: Orders → Bids Rebrand + Ugandan PPDA Bids Law Compliance (Updated 2026 e-GP 2.0)
## Product Requirements Document

## Overview
- **Summary**: Replace the sidebar "Orders" label (and all remaining UI surfaces) with "Bids" end-to-end, update the backend `sales_orders` schema to persist `ppdaCompliance` nested JSON, extend the valid status pipeline from 3 legacy values to the full 12-stage PPDA bid lifecycle, and enhance the Bids workspace at `/app/orders` with fully wired PPDA 2023 Regulations + July 2026 e-GP Phase 2 compliance tooling.
- **Purpose**: Align Queenstech ERP's public-sector procurement module with Uganda's PPDA Act (Cap 205), the *PPDA Contracts Regulations 2023* (S.I. No. 39 of 2024), *Evaluation Regulations 2023*, *Administrative Review Regulations 2023*, and the mandatory July 2026 **e-GP Phase 2** rollout at `egpuganda.go.ug` (Central Supplier Platform, electronic bid submission, mandatory 10-working-day Administrative Review standstill, URA/NSSF/URSB API-integrated clearances). Fix every remaining "Orders" → "Bids" surface and every status/serialization mismatch error between frontend types and the backend.
- **Target Users**: Admin, Manager, Sales/Cashier, Inventory Clerk, and custom-role staff who manage incoming public-sector LPOs, submit bids through Uganda's e-GP portal, track PPDA-required document sets, and monitor evaluation / contract-award stages for Queenstech's client contracts.

## Goals
- **G1. Terminology Rebrand (Complete)**: Every surface (Sidebar, BottomNav, Command Palette, Role Module Access Lists, UserAccountModal Default Landing, FAQ text, Route-Guard comments, ItemDetailSheet Sales-Orders tabs, Decline dialogs, Empty states, Form titles, Placeholders) that previously read "Orders" / "Sales Order" now reads "Bids" / "Bid" / "Tenders & Bids" consistently, with the `Gavel` icon (ClipboardList fallback).
- **G2. PPDA Bid Lifecycle Statuses (12 stages)**: Every bid follows the regulated PPDA pipeline — `draft → advertised → submitted_egp → bid_opened → tech_eval → fin_eval → evaluated → contracts_cmte → awarded → contract_signed → complete / declined` — with semantic colour chips, a working `migrateOrder()` back-compat shim for legacy `delivered`/`cancelled`/`confirmed` records, and a backend `VALID_STATUSES` set that actually accepts all 12 values (fixing the silent-rejection error that currently drops status PATCH calls for any non-legacy literal).
- **G3. Database & Integrity (Fix PPDA-roundtrip error)**: The `sales_orders` SQLite table gains a `ppda_compliance TEXT` JSON column. The backend serializer `sales_order_from_row` round-trips the full `PpdaComplianceDetails` nested object. `orders_service.update_order` column_map gains `ppdaCompliance → ppda_compliance`. New PPDA fields survive page reloads and multi-branch `X-Branch-ID` scoping.
- **G4. PPDA Preference Schemes & Thresholds (2023 Regs)**: Surface Uganda's regulated preference margins — **15% on domestically manufactured goods** (value-add ≥ 30%), **7% on works & services** — and the updated Schedule-4 micro-procurement thresholds: **< UGX 5M supplies/services**, **< UGX 10M works** — as first-class UI badges, auto-evaluated price-adjustment display, and tooltips citing *PPDA Act Schedule 3* and the *Amendment to Schedule 4 Instrument, 2023*.
- **G5. Compliance Checklist (e-GP 2.0 2026)**: An 8-point statutory-clearance checklist wired to `PpdaComplianceDetails` — **URA TCC (validated via e-GP API per e-GP 2.0 spec), NSSF Clearance, PPDA Register-of-Providers (ROP), URSB Incorporation, Audited Financials, Bid Security, PRN Fee Proof, Anti-Corruption Declarations** — each with Emerald/Amber/Rose/Slate status chips. Plus committee attribution (Evaluation, 5-member Contracts Cmte w/ mandatory lawyer) and 6 lifecycle timestamps, plus standstill-end-date tracker for *PPDA Section 91A / Administrative Review Regs 2023* (10 WORKING days post-BEB).
- **G6. Creative polish (#becreative)**: Framer-Motion staggered stage-timeline Kanban in the PPDA Compliance tab, ambient glow stage-pill hover previews, preference-margin badge pulse animations, standstill countdown timer with animated progress ring, and the mandated Hero Banner skeleton (`from-[#003399] via-[#003399] to-[#004CCC]` gradient, `blur-3xl` orbs, stagger 0.02 sectionIndex y:-6→0).

## Non-Goals
- **NG1. Route rename**: The `/app/orders` route path is NOT renamed to `/app/bids`. Only labels, icons, and internal semantics change. No `routeTree.gen.ts` hand-edits.
- **NG2. e-GP portal API client**: No automated HTTPS calls to `egpuganda.go.ug` — the product remains a local tracking/compliance workspace that mirrors manual e-GP actions taken by staff, with UI hints and checkboxes guiding compliance with the e-GP 2.0 workflow.
- **NG3. Suppliers page rewrite**: The existing Suppliers (Procurement group) page is not modified. Supplier PPDA registration status is tracked only at the per-bid level.
- **NG4. Bank / Debtors / Creditors / Transactions changes**: No financial-module modifications. Withholding tax and VAT on government contracts are referenced only as document-checklist entries, not implemented as new ledger transactions.

## Background & Context
- The `/app/orders` page is ALREADY internally semantically a Bids workspace in many places: Hero badge reads `"Bids & PPDA Procurement Hub"`, CTA says `New Bid`, KPIs say `Total Bids` / `Under Evaluation`, route meta title is `"Bids & Procurement · Queenstech ERP"`, `roles.ts` module entry is `id: "orders", name: "Bids"` (L15), and Sidebar.tsx L46 already shows `{ label: "Bids", href: "/app/orders", icon: Gavel }`. However many SURFACES still leak legacy "Orders" / "Sales Order" terminology and the backend has 3 SILENT DATA-LOSS bugs: (a) `VALID_STATUSES` rejects 11 of 12 `OrderStatus` literals so status PATCH silently coerces back to `submitted`; (b) no `ppda_compliance` column so PpdaComplianceDetails is dropped; (c) `sales_order_from_row` never reads the column even if it existed.
- **Legal research confirmed**: PPDA Act Cap 205 as amended; the full 2023 Regulations package (Administrative Review, Procurement Planning, Contracts, Evaluation, Consultancy, PDE, Negotiations, Disposal) published June 2024; Circular 6/2025 — *Issuance of Amended Standard Bidding Documents 2025*; Amendment to Schedule 4 Instrument 2023 (threshold recalibration); e-GP Phase 2 mandatory national rollout **1 July 2026** (Central Supplier Platform, mandatory digital signatures, EFRIS-integrated tax clearance, IFMS payment rails, end-to-end electronic bidding for ALL PDEs).
- **Preference scheme rules (PPDA Act Sec 50 + Schedule 3)**: Domestic manufactured goods 15% margin; domestic works/services 7% margin; MSME reservation scheme (`isMsmeReservationScheme`); Women/Youth/PWD preferences in e-GP 2.0; 30% domestic value-add threshold for manufactured goods to qualify.
- **Micro-procurement thresholds (Sched 4, 2023 amendment)**: Supplies & non-consultancy services < UGX 5,000,000; Works < UGX 10,000,000. No bid document, no Contracts Cmte — PDU/user-dept direct comparison.
- **Contracts Cmte (PPDA Regs 2023)**: 5 members nominated by Accounting Officer (chair + 3 members + secretary); central-govt PDEs require 1 external LAWYER member; QUORUM = 3 of 5. Evaluation Cmte approved by Contracts Cmte, conducts bid review → due diligence → BEB report.
- **Standstill (Sec 91A / Admin Review Regs 2023)**: MANDATORY 10 WORKING DAYS after BEB notice publication → contract signature or LPO execution. Supplier can lodge Administrative Review during this window.
- **Project memory constraints preserved**: Hero banner gradient `from-[#003399] via-[#003399] to-[#004CCC]` with `blur-3xl` ambient orbs and staggered `motion.section` y:-6→0 entrance; explicit pixel-precise Tailwind values (`w-[480px]`, `sm:max-w-[460px]`) are NOT migrated to v4 shorthand regardless of linter warnings; Document Tab → LPO Tab → Bids Tab ordering continues but now with a 4th PPDA Compliance tab appended; Admin/Manager-only gating on document upload/replace/delete and bid-stage transitions to Evaluated/ContractsCmte/Awarded/Signed.

## Functional Requirements

### Terminology & Icon Rebrand
- **FR-1 (Sidebar + Nav groupings + icon)**: `Sidebar.tsx` Operations group: the entry for `/app/orders` is LABEL `Bids`, ICON `Gavel` (ClipboardList fallback if Gavel is not exported by the current lucide-react). The Procurement-group "Purchases" entry (ShoppingBag icon) is NOT changed per business constraint.
- **FR-2 (BottomNav + Command Palette)**: `BottomNav.tsx` NAV_ITEMS[2] label `Bids` + Gavel icon; `palette-pages.tsx` PAGES entry for `/app/orders` label `Bids` + Gavel icon (not "Bids & Procurement").
- **FR-3 (Roles: 5 arrays + 2 comments)**: In `roles.ts`, change the literal string `"Orders"` → `"Bids"` in: ACCESS_ROLE_PRESETS.manager.allowedModules (L61), ACCESS_ROLE_PRESETS.cashier.allowedModules (L70), ACCESS_ROLE_PRESETS.inventory.allowedModules (L77), SYSTEM_ROLES.manager.accessibleModules (L120), SYSTEM_ROLES.staff.accessibleModules (L131). Also update `route-guard.ts` L7 comment from `// Orders` → `// Bids`.
- **FR-4 (UserAccountModal Default Landing page)**: `UserAccountModal.tsx` L552 SelectItem label `Sales Orders` → `Bids`.
- **FR-5 (FAQ text)**: `faq-data.ts` L37 FAQ answer `On the Orders page you can attach…` → `On the Bids page you can attach a detailed tender quotation as text plus an image or PDF file. Procuring entities receive the same document set you store.`
- **FR-6 (ItemDetailSheet)**: In `ItemDetailSheet.tsx`, change the tab-heading and labels: L426 `Sales Orders` → `Bids & Tenders`; L442 comment + L445 span → `Bids & Tenders Containing {item.name}`; L454 description → `When bids are created containing this product, the LPO breakdown and contract income will automatically populate here.`
- **FR-7 (Dialogs + Empty states + Form titles inside app.orders.tsx)**: All remaining legacy strings in `app.orders.tsx`: Decline dialog title L196 `Decline Order / LPO` → `Decline Bid / Tender`; decline placeholder L209 `State why this LPO / sales order is declined…` → `State why this bid / tender / LPO is disqualified, withdrawn or declined (e.g., failed technical evaluation, missing PPDA clearances, pricing non-responsive, cancelled by procuring entity)…`; OrderFormSheet L3442 title `New sales order` → `New Bid & Tender Submission`; OrderFormSheet L3443 description `Register a Local Purchase Order received from a customer.` → `Register a tender, LPO, or bid submission received from a procuring and disposing entity (PDE) under the PPDA Act.`; Empty-state title L698 `No orders yet` → `No bids yet`, `Create your first sales order` → `Create your first bid`, `Loading orders` → `Loading bids`.

### Backend Schema, Status & Serialization Fixes (3 silent bugs)
- **FR-8 (VALID_STATUSES fix — stops silent status-data-loss)**: In `backend/services/orders_service.py`, L8 `VALID_STATUSES` set is extended from the 9 legacy literals `{submitted, declined, successful, decline, draft, confirmed, in_progress, delivered, cancelled}` to INCLUDE the full 12 PPDA literals: `draft, advertised, submitted_egp, bid_opened, tech_eval, fin_eval, evaluated, contracts_cmte, awarded, contract_signed, complete, declined`. Retain legacy literals as coercible aliases in `orders_routes.py` L72 and L100, mapped via the same logic as the frontend `migrateOrder()`.
- **FR-9 (sales_orders ppda_compliance column + migration)**: In `backend/services/database.py` CREATE TABLE sales_orders L740-762, add `ppda_compliance TEXT` (nullable JSON). Add a `migrate()` step that runs `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS ppda_compliance TEXT;` on app startup (before SELECTs), guarded by try/except so old SQLite versions that lack `ADD COLUMN IF NOT EXISTS` fall back to a `PRAGMA table_info(sales_orders)` check first.
- **FR-10 (serializer sales_order_from_row — ppdaCompliance round-trip)**: In `backend/models/serializers.py` L284-349 `sales_order_from_row`, add a JSON-safe getter for `ppda_compliance` → mapped to key `ppdaCompliance` on the returned object, default `null` / empty-object if absent or unparsable.
- **FR-11 (update_order column_map)**: In `backend/services/orders_service.py` L168-188 `column_map`, add the mapping `"ppdaCompliance": "ppda_compliance"` with JSON dumps before the UPDATE.
- **FR-12 (create_order INSERT)**: In `orders_service.py` L81-112 create_order INSERT statement, add `ppda_compliance` as a column bound to `json.dumps(data.get("ppdaCompliance") or None)` (consistent with how `complaints` and `account_details` are already stored).

### PPDA Bid Lifecycle, UI & Form Integration
- **FR-13 (OrderStatus type + STATUS_META 3→12)**: The `OrderStatus` in `sales-order.ts` is the 12-member literal union defined in G2. The `migrateOrder()` shim in `app.orders.tsx` maps: `draft→draft, advertised→advertised, confirmed→submitted_egp, in_progress→tech_eval, delivered→awarded, cancelled→declined, submitted→submitted_egp, successful→awarded, decline→declined`. STATUS_META gains icons and color classes (Draft: sl8/FilePlus, Advertised: sky/Megaphone, SubmittedEGP: indigo/Send, BidOpened: violet/FolderOpen, TechEval: amber/ClipboardCheck, FinEval: orange/Calculator, Evaluated: teal/CheckSquare, ContractsCmte: blue/Users2, Awarded: emerald/Trophy, ContractSigned: emerald-700/Signature, Complete: emerald-900/CheckCircle2, Declined: rose/XCircle).
- **FR-14 (PpdaPreferenceBadge + Evaluated Price)**: A new reusable component inside `app.orders.tsx` renders: (a) `Micro-procurement` slate badge + Info tooltip quoting Sched-4 thresholds when amount <5M/<10M; (b) `15% Local Pref` or `7% Local Pref` emerald badge + Schedule-3 tooltip when `isUgandanLocalContent=true` and domestic content >30%; (c) in the bid preview side sheet a 3-line *Evaluated Price* card: Base Bid, Foreign Supplier Adjustment (+15%/+7% greyed strikethrough line shown when the marked supplier does NOT qualify), Adjusted Evaluated Price (bold hero font).
- **FR-15 (PPDA Compliance Tab — fully wired)**: Tab #4 `PPDA Compliance` renders (1) Compliance Overview Grid — LPO/Customer/Status + 8 status chips (URA TCC, NSSF, PPDA ROP, URSB, Audited, BidSec, PRN, Declarations) with Emerald/Amber/Rose/Slate colors per status; clicking a chip edits IFF Admin/Manager (ShieldAlert disabled + PPDA §16(2) text for staff); and (2) a Stage-Timeline Kanban — 12 named vertical stage columns, each with count badge, using Framer stagger entrance, and a per-bid "Move to stage →" dropdown with role-gated next-stages (no drag&drop, no new npm packages).
- **FR-16 (New Bid form sheet — 3 PPDA cards)**: After Bid Amount, render the Classification card (ProcurementMethod Select, Preference Eligible Checkbox, Domestic-Content % number input with "Must exceed 30%" Info tooltip, Bid-Security switch + amount/validity/issuer), then the Compliance Status card (8 × 4-option Select dropdowns: valid/pending/expired/not_required, default pending), then the Evaluation & Award Attribution card (Evaluation Cmte multi-Select from employees, Contracts Cmte multi-Select from employees, Standstill-end-date date picker, 5 × lifecycle date fields). Mirror AssetFormSheet dashed-border-gradient card style. Card submit collects nested `ppdaCompliance` and merges into `createOrder` payload.
- **FR-17 (Tab ordering + labels)**: Ordered tabs (4): Documents → LPO & Awarded → Tenders & Bids (renamed from Bids, with "(filtered count)") → PPDA Compliance. Tab layoutId slide animation preserved.
- **FR-18 (Role-gated transitions and document actions)**: For non-Admin/Manager users, the per-bid dropdown actions for moving to Evaluated / Contracts Cmte / Awarded / Contract Signed are disabled with ShieldAlert icon + `Restricted to Admin / Manager — PPDA §16(2) Contracts Committee`. Replace / Delete document actions same gate. Preview/Download always enabled.
- **FR-19 (Hero KPI 4 cards — PPDA stage counters)**: KPI strip updated to (1) Total Tenders (lifetime count), (2) Under Evaluation (tech_eval ∪ fin_eval, amber), (3) Stages in-progress (open pipeline count: draft..contracts_cmte, blue), (4) Compliance gaps (Rose if any pending/expired checklist statuses across open bids, Emerald "All clear" if zero). Brand Hero preserved.
- **FR-20 (PPDA workspace — e-GP 2.0 enhancements)**: `PpdaComplianceWorkspace` banner updated to badge `PPDA Act (Cap 205) · 2023 Regs · e-GP 2.0 — July 2026`; statutory-clearances card adds `PPDA ROP (Register of Providers)` entry and `Circular 6/2025 — Amended SBD 2025` hint; local-content card adds `MSME Reservation Scheme · Women/Youth/PWD Preferences` sub-badge; standstill card adds `Countdown: N working days remaining` live diff where `bebNoticeDate + 10 working days → standstillEndDate`; procurement-method threshold tiles get the *Schedule 4, 2023* thresholds.

## Non-Functional Requirements
- **NFR-1 (TypeScript strict, no any)**: `cd frontend ; npx tsc --noEmit --pretty false` exits 0. No `as any` casts.
- **NFR-2 (React Hook Safety)**: All `useState`/`useMemo`/`useEffect` declared before any conditional early return in every touched component.
- **NFR-3 (Backend: compile + schema migration)**: `python -m py_compile backend/routes/orders_routes.py backend/services/orders_service.py backend/services/database.py backend/models/serializers.py backend/routes/guards.py` exits 0. The `ppda_compliance` column migration runs idempotently on every app start (no errors on re-run, no errors if column already exists).
- **NFR-4 (Framer micro-interactions, #becreative)**: Staggered `motion.div` entrances (staggerChildren 0.04 / delayChildren 0.03, cubic-bezier [0.22,1,0.36,1]). Hover-preview glow stage pills. Ambient standstill progress radial with animated stroke-dashoffset.
- **NFR-5 (Tailwind brand preservation)**: Explicit pixel widths (`w-[480px]`, `sm:max-w-[460px]`), arbitrary opacity `[0.025]`, and gradient class strings preserved. No Tailwind v4 auto-migration regardless of diagnostic hints.
- **NFR-6 (Navigation integrity)**: After the rebrand, every role preset (Admin, Manager, Cashier, Inventory Clerk, Accountant, Staff, Custom) continues to see the Bids entry in Sidebar/BottomNav IFF the role previously had access to `/app/orders`. `canAccessRoute()` semantics preserved.
- **NFR-7 (No new npm/pip packages)**: Zero new package.json dependencies. Zero new pip install requirements.

## Constraints
- **Technical**: Route path `/app/orders` preserved (TanStack Router file-based). No `/app/bids` route. `routeTree.gen.ts` is auto-generated and not hand-edited.
- **Business**: The existing 10-document LPO compliance set, LPO Workspace, Documents Workspace, and CreateLpoAccount flow continue to work exactly as today. PPDA tab, compliance checklist, preference badges, and extended 12-stage lifecycle are ADDITIVE. Private-sector LPOs without PPDA data should render fine (empty PPDA fields default gracefully).
- **Dependencies**: Zero new packages. No `@dnd-kit/core` for Kanban — use dropdown menus only.
- **Legal**: Tooltip compliance text must match PPDA Act Cap 205 and 2023 regulations — 15% goods / 7% works, UGX 5M/10M micro-thresholds, 5-member Contracts Cmte with lawyer, 10-WORKING-DAY standstill, 8-point clearance checklist.

## Assumptions
- **A1**: The `Gavel` icon is exported from `lucide-react` in this project's installed version; if not, fall back to `ClipboardList` (L29 app.orders.tsx already imports it).
- **A2**: SQLite supports `ALTER TABLE … ADD COLUMN` (it does in all modern SQLite 3.x, and the `migrate()` pattern in `database.py` wraps add-column in try/except for safety).
- **A3**: The frontend `createOrder` / `updateOrder` API wrappers already accept and pass unknown keys in the SalesOrder payload, so new `ppdaCompliance` key travels transparently without touching `services/api.ts` route wrappers.
- **A4**: Existing `X-Branch-ID` guards in `guards.py` apply uniformly to `orders_bp` routes; branch isolation does not need changes since we're only adding a column to an already-scoped table.

## Open Questions
- [ ] **OQ-1**: Should the default landing tab (after first load) stay Documents → default per FR-17, or remember last tab via localStorage? This spec defaults to Documents as today.
- [ ] **OQ-2**: Evaluation Committee / Contracts Committee multi-select: restrict to employees with "Procurement" / "Lawyer" in job title, or allow any employee? Spec assumes any employee for least surprise.
- [ ] **OQ-3**: Standstill countdown: use WORKING days (excl. weekends + Uganda public holidays list) or simple calendar days for the "10 working days post-BEB" tracker? Spec uses WORKING days per PPDA §91A, with a hardcoded 2026 Uganda holiday list.

---

## Acceptance Criteria

### AC-1: Sidebar / BottomNav / Palette label + icon rebrand
- **Type**: `rule`
- **Given**: Sidebar (md+ viewport), BottomNav (sm-), Command Palette (Cmd/Ctrl+K)
- **When**: Each renders the page-entry for `/app/orders`
- **Then**: Label is `Bids`, icon is `Gavel` (or `ClipboardList` fallback) with non-ShoppingBag class; Procurement-group Purchases entry remains ShoppingBag (unchanged); "Orders" string does not appear in Sidebar Operations group, BottomNav, or palette pages section.
- **Pass Condition**: Sidebar.tsx Operations group has label "Bids" icon Gavel; BottomNav L NAV_ITEMS Bids; palette-pages Bids (no "& Procurement").
- **Evidence**: `npx tsc --noEmit` 0 errors + file diffs for Sidebar L46, BottomNav NAV_ITEMS, palette-pages PAGES.

### AC-2: Roles + RouteGuard + UserAccountModal + FAQ + ItemDetailSheet terminology
- **Type**: `rule`
- **Given**: Any role-based module-access check, default landing page select, FAQ read, ItemDetailSheet open
- **When**: The 5 role arrays, route-guard comment, UserAccountModal L552, FAQ L37, ItemDetailSheet L426/L445 render
- **Then**: 5 allowedModules arrays in `roles.ts` contain `Bids` not `Orders`; route-guard L7 comment reads "Bids"; UserAccountModal select option "Bids" not "Sales Orders"; FAQ text says "Bids page"; ItemDetailSheet tab headings say "Bids & Tenders" not "Sales Orders".
- **Pass Condition**: `grep -nE '"Sales Orders"|"Orders"|// Orders|Sales Orders Containing|On the Orders page' frontend/src/lib/roles.ts frontend/src/lib/route-guard.ts frontend/src/components/settings/UserAccountModal.tsx frontend/src/lib/faq-data.ts frontend/src/components/catalog/ItemDetailSheet.tsx` = 0 hits.
- **Evidence**: Grep output + line-level file diffs.

### AC-3: app.orders.tsx internal-facing legacy strings (forms, dialogs, empty, placeholders)
- **Type**: `rule`
- **Given**: User opens Decline dialog, New Bid sheet, or sees empty/loading states in Tenders & Bids tab
- **When**: DeclineReasonDialog, OrderFormSheet, EmptyState render
- **Then**: Decline title "Decline Bid / Tender"; decline placeholder uses "bid / tender / LPO"; form title "New Bid & Tender Submission"; form description "Register a tender, LPO, or bid submission…"; empty/loading uses "bids" not "orders".
- **Pass Condition**: Grepping `app.orders.tsx` UI strings (decline dialog title, placeholder text, EmptyState title/description, SheetTitle, SheetDescription, Breadcrumbs) yields zero `sales order` / `Sales Order` / `Create your first sales order` / `Loading orders` / `No orders yet` hits (case-insensitive, excluding comments and variable names).
- **Evidence**: app.orders.tsx file diff for L196, L209, L3442, L3443, L697-703.

### AC-4: Backend VALID_STATUSES + ppda_compliance column + serializer + column_map
- **Type**: `rule`
- **Given**: A PATCH `/api/orders/:id` with body `{status: "tech_eval", ppdaCompliance: {uraTccStatus: "valid", standstillEndDate: "2026-08-01"}}`
- **When**: orders_routes → orders_service processes it
- **Then**: VALID_STATUSES does NOT coerce "tech_eval" to "submitted" (the current bug); `status` is persisted as the literal "tech_eval"; `ppdaCompliance` nested object is stored in new column `ppda_compliance` as JSON, returned by GET `/api/orders/:id` under key `ppdaCompliance` via serializer round-trip. createOrder also stores the column.
- **Pass Condition**: VALID_STATUSES set contains all 12 literals; database.py runs ADD COLUMN idempotently; serializers.py sales_order_from_row returns ppdaCompliance key; update_order column_map includes it; create_order INSERT binds it.
- **Evidence**: File diffs + `python -m py_compile` 0 exit code on all 4 backend files.

### AC-5: OrderStatus 12-stage union + STATUS_META + migrateOrder back-compat shim
- **Type**: `rule`
- **Given**: Legacy record with status "delivered" or "confirmed", or new record with status "tech_eval"
- **When**: `migrateOrder(o)` runs at OrdersPage load
- **Then**: All legacy literals map to a valid 12-stage literal; frontend type `OrderStatus` is a 12-member union; STATUS_META has 12 entries each with {label, cls, icon}; tsc --noEmit 0 errors.
- **Pass Condition**: TypeScript type OrderStatus has 12 literals; migrateOrder maps every legacy string from the old VALID_STATUSES set to a new literal without throwing or returning any/string.
- **Evidence**: sales-order.ts diff, migrateOrder function body diff, `npx tsc --noEmit` 0 errors.

### AC-6: PpdaPreferenceBadge + Micro-procurement thresholds + Evaluated-price detail-sheet section
- **Type**: `rubric`
- **Dimension**: Clarity, correctness, and visual polish of PPDA preference-scheme, threshold, and evaluated-price UI
- **Scale**: 1-5
- **Anchors**: 1 = no badges or indicators; 3 = badges present but no tooltips, no evaluated price section; 5 = Micro-badge <5M/<10M w/ Sched-4 tooltip; 15% goods / 7% works emerald badges w/ Sched-3 tooltips + domestic-content 30% gating; detail sheet has 3-row Evaluated Price card with bold adjusted total; Framer stagger entrance.
- **Pass Threshold**: >= 4
- **Evidence**: Bid row DOM snapshot + Bid preview detail sheet evaluated-price section.

### AC-7: PPDA Compliance tab (Compliance grid + 12-stage Kanban timeline) + role-gated status-chip edits
- **Type**: `rule`
- **Given**: User clicks PPDA Compliance tab (tab #4)
- **When**: Admin/Manager or Staff user interacts with compliance chips and stage dropdowns
- **Then**: Tab renders compliance grid (LPO + 8 status chips Emerald/Amber/Rose/Slate colored per valid/pending/expired/not_required) AND 12-stage named Kanban columns with count badges and Framer stagger entrance. Clicking a compliance status chip edits only for Admin/Manager (Staff sees ShieldAlert "Restricted — PPDA §16(2) Contracts Cmte"). Stage-transition dropdown "Move to stage →" same role gate.
- **Pass Condition**: activeTab enum includes "ppda" with label "PPDA Compliance"; grid has all 8 checklist chips; kanban 12 stage cols; role-gate conditional renders ShieldAlert for staff on both edit surfaces.
- **Evidence**: JSX fragments for grid + kanban, role-gate lines, tsc --noEmit 0 errors.

### AC-8: New Bid form sheet 3 PPDA cards (Classification / Compliance / Evaluation)
- **Type**: `rule`
- **Given**: Admin/Manager clicks Hero "New Bid" CTA
- **When**: Form sheet body renders before the footer action buttons
- **Then**: After Bid Amount, three dashed-border-gradient motion.div cards render in order: (1) PPDA Classification with ProcurementMethod Select, Preference Checkbox, DomesticContent 0–100 number + 30% threshold tooltip, BidSecurity switch + subfields; (2) Compliance Status card with 8 × 4-option status Selects (default pending); (3) Evaluation & Award Attribution with 2 × committee multi-Select from employees, standstill-end date picker, 5 × lifecycle date-pickers. Submit payload includes a merged `ppdaCompliance` key with all filled fields.
- **Pass Condition**: DOM snapshot of form sheet with three cards; submit handler body merges ppdaCompliance into onCreate payload; tsc 0 errors.
- **Evidence**: OrderFormSheet JSX fragment + submit handler diff.

### AC-9: Tab ordering Documents → LPO → Tenders & Bids → PPDA Compliance; Row interactions + hover tint; role-gated actions
- **Type**: `rule`
- **Given**: Tenders & Bids tab renders with rows
- **When**: User scans tab bar or clicks a row / row buttons
- **Then**: Tab order 0=Documents, 1=LPO & Awarded, 2=Tenders & Bids (count), 3=PPDA Compliance; row cursor-pointer, hover bg-[#003399]/[0.025], row onClick → setPreviewOrder() (bid preview sheet); internal Eye/Trash/dropdown buttons use e.stopPropagation(); for Staff role, advanced-stage transitions are disabled ShieldAlert "PPDA §16(2) Contracts Cmte".
- **Pass Condition**: Tab array ordered correctly; Tenders & Bids label (not "Bids" alone); TableRow onClick + inner button stopPropagation confirmed.
- **Evidence**: Tab definitions array in app.orders.tsx L597; TableRow + TableCell stopPropagation lines.

### AC-10: Hero KPI strip — 4 cards (Tenders, Eval, Stages-in-progress, Compliance-gaps w/ Rose/Emerald toggle)
- **Type**: `rubric`
- **Dimension**: Numerical accuracy + brand fidelity + animation polish
- **Scale**: 1-5
- **Anchors**: 1 = KPIs wrong counts, wrong gradient; 3 = KPIs correct counts, correct gradient, no stagger entrance; 5 = KPI counters match spec (Tenders/eval/stages/gaps), compliance-gaps toggles Rose ≥1 else Emerald "All clear", Hero banner uses from-[#003399] via-[#003399] to-[#004CCC], blur-3xl orbs, motion.section y:-6→0 stagger 0.02 sectionIndex.
- **Pass Threshold**: >= 4
- **Evidence**: Hero KPI strip DOM snapshot + dashboardStats useMemo code block.

### AC-11: e-GP 2.0 PPDA workspace upgrades (2023 Regs badge, SBD 2025, MSME sub-badge, standstill N-days countdown, updated thresholds)
- **Type**: `rubric`
- **Dimension**: Factual accuracy, 2026 readiness, and visual richness of the PPDA Compliance workspace header banner and 3 tiles
- **Scale**: 1-5
- **Anchors**: 1 = old PPDA Act 2003-only text; 3 = 2023 Regs mentioned but missing Circular 6/2025, countdown, MSME, or Schedule-4 threshold updates; 5 = Badge lists "PPDA Act Cap 205 · 2023 Regs · e-GP 2.0 July 2026", statutory tile has PPDA ROP entry, local-content tile shows MSME/Women/Youth/PWD sub-badge, standstill tile shows live "Countdown: N working days to end" computed from bebNoticeDate+10wd, method thresholds Sched-4 2023 (5M/10M).
- **Pass Threshold**: >= 4
- **Evidence**: PpdaComplianceWorkspace header + 3 tiles DOM snapshot.

### AC-12: Full TypeScript + Python compile pass + GetDiagnostics 0 semantic errors
- **Type**: `rule`
- **Given**: Implementation complete on all tasks
- **When**: (1) `cd frontend ; npx tsc --noEmit --pretty false`; (2) `python -m py_compile backend/routes/orders_routes.py backend/services/orders_service.py backend/services/database.py backend/models/serializers.py backend/routes/guards.py`; (3) VSCode GetDiagnostics run
- **Then**: Commands (1) and (2) exit code 0; GetDiagnostics returns 0 TypeScript semantic errors on the 8 touched files (Sidebar, BottomNav, palette-pages, roles, route-guard, UserAccountModal, faq-data, ItemDetailSheet, sales-order types, app.orders). Tailwind v4 migration-only warnings are allowed.
- **Pass Condition**: Exit code 0 for both compile commands; GetDiagnostics.errors filtered to touched files = []
- **Evidence**: Command stdout + exit code logs; GetDiagnostics JSON.

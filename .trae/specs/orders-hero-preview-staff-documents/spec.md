# Spec: Orders Page Hero Banner, Row-Level Preview UX, Single-Staff Handled-By, and Uganda-Compliant LPO Documents Sub-Page

## 1. Problem & Users

### Problem

The `/app/orders` (Sales Orders / LPO) page today has six shortfalls:

1. **No dashboard hero banner.** Unlike `/app/catalog`, the Orders page jumps straight into a search bar + data table with no at-a-glance summary, status breakdown, or open-value KPIs. Users cannot visually orient themselves to pipeline state on arrival.
2. **Particulars are split between two places in the order preview.** The preview window has a dedicated `Particulars` section that shows only line items pulled from `order.items[]` (name / qty / unit price / amount). It also has a separate "Customer quotation" / "Internal notes" section, and an empty-state fallback that surfaces `customerQuotation` text. The natural-language particulars typed or pasted *under each line item* (e.g. description, specifications, scope of work) are NOT treated as the particulars content — they only show via the tiny `match?.description || it.name` 11‑pixel muted line. There is no unified "this is what the customer asked for" particulars view.
3. **Row-level preview is undiscoverable.** Preview opens *only* via the small Eye icon button which is `opacity-0` until the row is hovered. There is no row‑wide click target; clicking the LPO number, customer name, amount, delivery date, or whitespace does nothing. The Eye + Trash icon buttons are hidden away until hover, which makes scanning for actions painful.
4. **"Handled by" semantics mismatch the Sales/Transactions page.** On the Transactions page `handledBy` is a single staff name (the cashier / sales agent); on Orders the select trigger stores a single string, but the preview timeline says `Assigned to <name>` alongside an assignment narrative that treats ownership as an *assignment* rather than a single responsible person as-of the sale. The Orders page also never auto‑defaults the new‑order handled‑by field to the authenticated user, unlike `AddSaleSheet.tsx`.
5. **No documents / LPO-compliance workflow.** Queenstech ERP is used by Ugandan suppliers who receive Local Purchase Orders and must attach a legally required chain of documents back to each LPO before a customer (typically MDAs, corporate buyers, or UN partners) will pay it. Currently there is nowhere to attach these, no per‑document status tracking, no upload/preview/download split, and no role gating.
6. **No sub-navigation.** "Orders" and "LPO Documents" are crammed into a single page concept; there's no way to tab / button‑switch between the orders table and the documents workspace.

### Users

| User | Definition | Goals on `/app/orders` |
|------|-----------|----------------------|
| **Admin** | `role === "admin"` | Full CRUD on orders + full CRUD on LPO documents (upload, replace, delete, mark required docs as received). Unrestricted. |
| **Branch Manager** | `role === "manager"` | Create/edit orders. *Manage* LPO documents (upload, replace, mark as received — same per‑doc actions as admin). Preview and download any doc. |
| **Staff** | `role === "staff"` | Preview orders (read‑only after creation depending on module config) and *preview + download* documents. No upload/replace/delete on docs. |

### Non-Goals (out of scope)

- No purchase orders (`/api/purchase-orders`) flow changes. The scope is the Sales Order / LPO page (`SalesOrder` type, `sales_orders` table) *and* a new documents workspace tied by `salesOrderId` / `lpoNumber`.
- No supplier / contractor registration workflow — the documents manager only stores attachments *for a given LPO*, it doesn't on-board suppliers.
- No backend document scanning, OCR, or virus checking.
- No signed‑URL / cloud object storage migration. Documents continue to use data‑URL JSON blobs in SQLite, matching the existing `quotationAttachment` pattern on `SalesOrder`.
- No EFRIS / URA e‑invoice machine‑to‑machine integration. We only track that the required document type *has been uploaded* (file name + date + uploaded‑by metadata).
- No changes to receipt exporters (`receipt-printer.ts` / `receipt-exporter.ts`) for orders. Receipt styling remains black‑and‑white for transactions as locked per prior memory; orders preview dialog is free to use the `#003399` brand band.

---

## 2. Functional Requirements

### FR-1 Orders hero banner (parity with catalog hero) + KPI cards
- Below the brand Header (no extra heading row), the Orders page opens with a `#003399 → #004CCC` gradient hero identical in tone, blur orbs, chip badge, and motion to `/app/catalog` hero.
- Hero headline = aggregate KPI sentence e.g. `{totalOrders} sales orders · UGX {openValue} open pipeline`. Hero sub-hint summarizes breakdown by status and overdue count.
- Hero actions (right cluster): **New order** CTA (white on brand, primary), plus Import-like auxiliary if/when we need them (CSV export is a nice-to-have inside the cluster).
- Below the hero: a 2×2→4‑column `KpiCard` grid reusing the existing catalog `KpiCard` component pattern (copying the tones / hover lift style). The four KPI tiles shall be:
  1. Total orders (brand)
  2. In‑progress / confirmed pipeline count and value (blue)
  3. Overdue delivery (rose, clickable to filter)
  4. Delivered this month (emerald)
- Staggered motion on hero + KPI tiles matching catalog's `sectionIndex("hero")` / `sectionIndex("kpis")` conventions.

### FR-2 Order Preview Particulars → unified section
In `OrderPreviewDialog`, the **Particulars** panel becomes the single place a user reads "what was actually requested/sold". It must:
- Render every `order.items[]` line as the main row (name + SKU badge + description).
- Under each line, append / concatenate any of the following as particulars text *in the order listed here*:
  1. Inventory match `description` (existing behavior — expand beyond the 2‑line clamp to full content).
  2. Free‑text line item `name` if it's marked "Free‑text line" (wrap under an indented block).
  3. If `order.customerQuotation` is populated: surface it **once** at the top of the empty‑state or as a "Customer quotation" banner at the top of the particulars block when items also exist, so an LPO with items still carries the customer's own narrative text as part of particulars.
- The separate "Quotation / Notes" `notes` section still exists for *internal notes only* — customerQuotation is no longer duplicated there.

### FR-3 Orders table → row‑wide click for preview + always‑visible row actions
- Every table data row becomes `cursor-pointer` with the same inset‑shadow hover treatment as `TransactionsTable` (brand #003399 inset shadow).
- Clicking **anywhere** on a row (LPO cell, customer cell, amount cell, handled‑by label area, status badge, whitespace…) invokes `setPreviewOrder(order)` and opens the dialog.
- The Eye and Trash icon buttons switch from `opacity-0 group-hover:opacity-100` to **always visible** (no opacity toggle — they render at `opacity-100` at all times, with hover ring/lift styling).
- `onClick` on row icon buttons (Eye / Trash), the Status `<Select>`, and the Handled‑by `<Select>` MUST `stopPropagation()` (or the row click must be ancestor‑gated against interactive elements) so clicking them does not also fire the row preview click.

### FR-4 Handled By → single staff semantics + auto‑default for new orders
- In the New Order form (`OrderFormSheet`), apply the same multi‑fallback default that `AddSaleSheet.tsx` uses for transactions:
  1. Email match: auth email → employee record → employee.name.
  2. Bidirectional name‑inclusion match with `user_metadata.full_name` / user name.
  3. First active employee in branch.
  4. Fallback: empty string (user picks manually).
- In the orders table "Handled by" cell: keep single select (single staff), keep avatar‑initials chip style — just ensure it is consistent (no multi-select, no comma‑joined list, no hidden string that gets split).
- In the Order Preview Dialog timeline, change "Assigned to X" copy to "Handled by X" and mark the tone as `primary` consistently. Preview's totals block "Handled by" row uses the same single name.
- In the orders table search, the `toLowerCase` filter on `handledBy` is preserved.

### FR-5 Documents sub-page / tab (Sales Order LPO Compliance Documents)
- Directly under the hero banner and KPI row, render a pill / segmented tab bar with two buttons: **Orders** (active by default, shows the orders search + table) and **Documents** (shows the LPO compliance documents workspace). Use the brand color #003399 for the active pill with matching Framer Motion motion.
- **Documents** workspace UI:
  - Per‑document list, scoped to a selected Sales Order. Top of the documents page has an LPO picker (dropdown select of all orders + search chip of the selected one).
  - For each selected LPO, render a card‑per‑document‑type grid. The required documents for processing a Local Purchase Order under typical Ugandan supplier compliance / procurement norms are:
    1. **Signed LPO / Purchase Order** (customer‑signed Local Purchase Order copy)
    2. **Tax Invoice (EFRIS compliant)** — URA e‑invoice or validated EFRIS tax invoice
    3. **Delivery Note / Goods Received Note (GRN)** — evidence of receipt with signature
    4. **Waybill / Transport Document** — KCCA/URA transit waybill where applicable
    5. **Tax Compliance Certificate (TCC)** — current URA TCC of the supplier
    6. **Certificate of Incorporation / Business Registration** — URSB registration
    7. **Quotation (Supplier)** — the original supplier quotation that was accepted
    8. **Payment Confirmation / Receipt** — proof of payment / acknowledgment receipt
    9. **Inspection / Quality Report** — where goods require inspection
    10. **Insurance Certificate (Goods in Transit)** — if delivery involves insured transport
  - Each document card shows: icon + title, legal‑purpose short description, status badge `Missing` (rose) / `Uploaded` (emerald) with uploaded date + uploaded‑by, file name, size, file type.
  - For each card: three right‑side actions. Role gating:
    - **Preview** (Eye icon): available to EVERY role (admin/manager/staff). Opens file inline (image <img/>, PDF `<iframe/>`, or file‑type download fallback).
    - **Download** (Download icon): available to EVERY role → `<a download>` anchor via data URL.
    - **Upload / Replace / Delete**: visible ONLY if `isAdmin || isManager`. Upload = dashed card body drop zone + file picker button. Replace = new picker once uploaded. Delete = trash button (with confirmation toast).
  - Each doc card has a free‑text remarks / notes line (admin/manager editable, staff read-only).
- Documents persistence: new `sales_order_documents` table in SQLite (migrate via existing `initialize_database()` idempotent CREATE TABLE IF NOT EXISTS pattern) with columns `id`, `sales_order_id`, `document_type` (enum‑string of the 10 types above), `file_name`, `file_type`, `data_url` (blob data URL), `size_bytes`, `uploaded_by`, `uploaded_at`, `remarks`. New backend endpoints CRUD‑protected:
  - `GET /api/orders/:id/documents` → `require_current_user` (any authenticated employee may read)
  - `POST /api/orders/:id/documents` → admin or manager only (new route guard `require_admin_or_manager`)
  - `PATCH /api/orders/:id/documents/:docId` → admin or manager
  - `DELETE /api/orders/:id/documents/:docId` → admin or manager
- Frontend new API helpers: `getOrderDocuments`, `uploadOrderDocument`, `updateOrderDocument`, `deleteOrderDocument` added to `services/api.ts`.

---

## 3. Non-Functional Requirements

### NFR-1 UI polish (#becreative)
- Hero / tab bar / doc cards follow the established #003399 brand system exactly: gradient bands are from‑#003399 via‑#003399 to‑#004CCC, active tab pills use solid brand fill with white text, hover lifts use the `0.22,1,0.36,1` cubic-bezier timing, and staggered delays follow `sectionIndex(key)` + `index * 0.04` patterns from the catalog page.
- Micro-interactions required:
  - Row hover → 3px brand inset shadow + -2px vertical nudge via motion whileTap-like style.
  - Tab bar pill transitions with layout animation (auto slider underline using Framer Motion `layoutId`).
  - Empty / missing document cards have dashed-border + icon‑badge `#003399/40` gradient glow on hover.
  - Uploaded document cards show a `ring-1 ring-emerald-500/25` status badge with a checkmark micro-burst.
  - KpiCards are motion-wrapped with `whileHover={{ y: -2 }}` for clickable tiles just like catalog.
- Text everywhere uses the existing project system sans stack; mono font faces for LPO numbers, UGX amounts, file sizes, and dates as established.

### NFR-2 Branch isolation
All documents read and write endpoints must validate `X-Branch-ID` via the existing `resolve_request_branch_id()` guards. The `sales_order_documents` table carries no explicit branch column, but `sales_order_id` is an FK into `sales_orders` which *is* branch‑scoped; the read service joins and filters accordingly.

### NFR-3 Performance and memory
- Data URLs for documents are capped at 8 MB per file per the existing `quotationAttachment` pattern; the frontend file picker should reject files > 10 MB with a Sonner toast.
- Document previews are rendered on demand (no eager `<iframe/>` loading of all ten docs — only when a Preview button is clicked, or when the selected document card is expanded).

### NFR-4 Backwards compatibility
- Existing `SalesOrder` rows without documents continue to render with every doc card showing the `Missing` state.
- The existing `order.quotationAttachment` is preserved as-is; it becomes one auto‑seeded document candidate (if present, pre‑populate the "Signed LPO / Purchase Order" slot with its file data and current timestamp / uploaded-by).

---

## 4. Constraints, Dependencies, Assumptions

- **Constraint**: Documents data is branch‑isolated via sales order FK. Never expose documents of a sales order outside the requestor's branch.
- **Constraint**: Documents role gating on the backend must be enforced in the route handlers, not just the frontend. Staff hitting endpoints directly must get 403.
- **Dependency**: Reuses the existing `useRole()` `isAdmin` / `isManager` booleans — roles are already wired in `RoleContext.tsx`.
- **Assumption**: "Ugandan LPO compliance document set" — the 10 types above are the canonical set used by Ugandan suppliers handling government / institutional LPOs (URA/URSB/Public Procurement and Disposal of Public Assets Authority norms). If the customer wants a longer list after seeing the MVP, they can tell us which additional types to add.

---

## 5. Acceptance Criteria

Every AC is typed strictly `rule` or `rubric`.

| ID | Type | Statement |
|----|------|-----------|
| AC-1 | rule | Orders page top of viewport renders a brand-gradient hero (#003399→#004CCC) with a headline showing aggregate order KPI, sub-hint status line, and "New order" CTA. No separate `<h1>Orders</h1>` title/subtitle row above the hero. |
| AC-2 | rule | Directly beneath the hero renders a KpiCard grid with 4 tiles: Total orders, Pipeline (confirmed/in progress), Overdue delivery (rose + onClick filter to overdue), Delivered this month — each with icon + tone matching the KpiCard system. |
| AC-3 | rule | OrderPreviewDialog Particulars section renders every line item's full inventory description (no 2-line clamp), shows a "Customer quotation" banner block at the top of the particulars when `customerQuotation` is non-empty, and the separate "Notes" section no longer duplicates `customerQuotation`. |
| AC-4 | rule | Every orders table row has `cursor-pointer` and a brand inset-shadow hover state. Clicking any non-interactive part of the row opens the preview dialog for that order. |
| AC-5 | rule | Row Eye and Trash icon buttons are permanently visible (no opacity-0 → hover reveal). Clicking them, the Status Select, or the Handled-by Select does NOT also open the preview dialog (stopPropagation or equivalent). |
| AC-6 | rule | New Order form's `handledBy` field pre-populates with the authenticated user via the same 4‑step fallback used by AddSaleSheet: email match → name inclusion match → first active branch employee → empty. The preview dialog shows exactly one staff name in Handled by, with timeline copy reading "Handled by X" (not "Assigned"). |
| AC-7 | rule | Below the KPI row there is a 2‑pill segmented tab bar: "Orders" and "Documents". Active pill is brand‑filled white text. Switching to "Documents" hides the orders search/table and shows the documents workspace; switching back restores it. |
| AC-8 | rule | Documents workspace has an LPO picker at the top and renders 10 document-type cards per selected order. Each card is titled exactly with one of: Signed LPO / Purchase Order, Tax Invoice (EFRIS compliant), Delivery Note / GRN, Waybill / Transport Document, Tax Compliance Certificate (TCC), Certificate of Incorporation / Business Registration, Supplier Quotation, Payment Confirmation / Receipt, Inspection / Quality Report, Insurance Certificate (Goods in Transit). |
| AC-9 | rule | Every document card shows Preview + Download actions for *all* roles. Upload / Replace / Delete + editable remarks inputs show ONLY when `isAdmin || isManager`. Staff see uploaded metadata read-only. |
| AC-10 | rule | Backend: new `sales_order_documents` table with full CRUD endpoints; read endpoints gated `require_current_user`; write endpoints gated `require_admin_or_manager` or equivalent; all reads are branch‑scoped via sales order FK. |
| AC-11 | rubric | UI polish & micro-interactions fidelity. Scale 0–2. Threshold ≥ 2 (since #becreative hashtag is called). Score: 0 = plain unstyled. 1 = brand colors applied + basic motion on enter. 2 = motion stagger on enter, whileHover lift on kpi/doc cards, tab slider layout animation, dashed-to-solid glow on document cards on hover, missing/Uploaded status badge burst, row click inset shadow matches TransactionsTable, and everything uses the cubic-bezier(0.22,1,0.36,1) timing. |
| AC-12 | rule | Existing orders flow (create/edit/delete/search/status change/handled by change/preview) still works with zero TypeScript diagnostics. |

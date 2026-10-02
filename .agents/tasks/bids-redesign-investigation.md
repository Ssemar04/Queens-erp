# Bids Page Redesign — Investigation Report

## Executive Summary

The "Bids" page is **`/app/orders`** (`app.orders.tsx`, 279 KB, ~4000+ lines). There is a second, **lighter** bids page at `/app/bids` (`app.bids.tsx`, 53 KB, ~1400 lines) that is registered in the route tree and in the sidebar (`Bids → /app/orders`) but the sidebar currently points to `/app/orders`, not `/app/bids`.

**Current sub-pages / tabs in `app.orders.tsx` (the active Bids page):**
| Key | Label shown in tab bar |
|---|---|
| `documents` | Documents |
| `lpo` | LPO & Awarded |
| `orders` | Bids |
| `ppda` | PPDA Compliance |

The user request is to:
1. Rename "LPO & Awarded" → **Orders**
2. Remove **PPDA Compliance** tab
3. Reorder tabs to: **Documents → Bids → Orders**
4. On the **Orders** sub-page, require selecting an existing Bid before creating an Order
5. Revamp the **Create Bid** window with: bid number, date, customer name (from DB), bid quotation (item/price/qty), notes, staff (from branch staff list)

---

## 1. Bids Page Location

| File | Route | Size |
|---|---|---|
| `d:\House\qterp\frontend\src\routes\app.orders.tsx` | `/app/orders` | ~279 KB / ~4500 lines |
| `d:\House\qterp\frontend\src\routes\app.bids.tsx` | `/app/bids` | ~53 KB / ~1400 lines |

**The sidebar nav (`Sidebar.tsx`, line 47) points "Bids" → `/app/orders`**, so `app.orders.tsx` is the page users see. The `app.bids.tsx` file exists as a separate, less-featured PPDA-focused tracker that appears to be an experimental parallel; the main implementation to work on is `app.orders.tsx`.

---

## 2. Current Sub-Pages / Tabs

All sub-pages are tab-switched inside `OrdersPage()` in `app.orders.tsx`. The state variable is `activeTab`:

```ts
const [activeTab, setActiveTab] = useState<"documents" | "lpo" | "orders" | "ppda">("documents");
```

Tab bar rendering (lines ~670–695 in `app.orders.tsx`):
```tsx
{(["documents", "lpo", "orders", "ppda"] as const).map((t) => {
  const label =
    t === "documents" ? `Documents ${documents.length ? `(${documents.length})` : ""}`
    : t === "lpo" ? `LPO & Awarded (${orders.length})`
    : t === "ppda" ? `PPDA Compliance`
    : `Bids (${filtered.length})`;
  ...
})}
```

Corresponding render (lines ~700–740):
- `activeTab === "documents"` → `<DocumentsWorkspace />`
- `activeTab === "lpo"` → `<LpoWorkspace />` (the LPO & Awarded list)
- `activeTab === "ppda"` → inline PPDA compliance table + kanban
- `activeTab === "orders"` → Bids table + filter

**The type union must be changed** from `"documents" | "lpo" | "orders" | "ppda"` to `"documents" | "bids" | "orders"` and the tab key `lpo` renamed to `orders`, `orders` to `bids`.

---

## 3. How Sub-Pages Are Routed / Rendered

- **No URL-based sub-routing**: All tabs are client-side state (`useState`). No nested TanStack routes.
- The tab bar is a custom pill row using framer-motion's `layoutId="orders-tab-slider"`.
- `app.orders.tsx` imports from `@tanstack/react-router` only `createFileRoute`.
- The `routeTree.gen.ts` shows both `/app/orders` and `/app/bids` as flat sibling routes under `AppRoute`.

---

## 4. "Create Bid" Window — Current Fields

The **Create Bid** form is `OrderFormSheet` (starts at line ~3455 in `app.orders.tsx`). It has:

| Field | Source |
|---|---|
| LPO Number | Auto-generated or custom |
| Date Received | Date picker (today) |
| Customer (select from DB) | `customers` array from `GET /api/customers` |
| Customer Name | Editable text |
| Quotation Attachment | File upload (PDF / image) |
| Item Name | Select from inventory OR custom text |
| Unit Price | Number input |
| Quantity | Number input |
| Asset (optional) | `assetsStore` |
| Large-format dimensions | Conditional for large-format assets |
| Delivery Date | Date picker |
| Handled By (staff) | Select from `branchScopedEmployees` |
| Notes | Textarea |
| PPDA section: procurement method, local content %, bid security, compliance statuses, committee members, dates | Many fields |

**Verdict**: The form already has most of the requested fields. The main gaps in the _Create Bid_ form as the user wants it are:
- The form is heavily cluttered with PPDA compliance fields the user did not ask for
- The "bid quotation" should just be **item – price – qty** (already exists but buried under complex asset logic)
- The form needs a cleaner layout matching the spec: bid number, date, customer (from DB list), quotation items, notes, staff

---

## 5. "Create Order / LPO" Window — Current Fields (CreateLpoAccountSheet)

`CreateLpoAccountSheet` (starts line ~2159 in `app.orders.tsx`):

| Field | Source |
|---|---|
| LPO Number | Auto |
| Company Name | Select from customers DB (`GET /api/customers`) |
| Company Address / TIN / Location | Auto-filled from customer |
| Contact Person / Phone / Email | Auto-filled from customer |
| Fee Amount (UGX) | Number |
| Submission Deadline | Date picker |
| Staff Handler | Select from `employees` list |
| Document Checklist | Multi-select of document types |

This is used for **LPO Accounts** (`isLpoAccount: true`). The requirement says:
> "Before creating an order, one should select an already existing bid from the bids sub-page."

So the new **Orders** sub-page needs a **Select Bid** step before the Create Order form opens.

---

## 6. Frontend ↔ Backend API Connection

### Orders / Bids
| Operation | Frontend | Backend |
|---|---|---|
| Fetch all | `GET /api/orders` → `getOrders()` | `orders_routes.py:list_orders()` |
| Create | `POST /api/orders` → `createOrder()` | `orders_routes.py:create_order()` |
| Update | `PATCH /api/orders/:id` → `updateOrder()` | `orders_routes.py:update_order()` |
| Delete | `DELETE /api/orders/:id` → `deleteOrder()` | `orders_routes.py:delete_order()` |
| Documents | `GET /api/documents`, `POST /api/documents` | `orders_routes.py` |

All defined in `d:\House\qterp\frontend\src\services\api.ts` lines ~399–450.

---

## 7. Customers List API

| | Details |
|---|---|
| Frontend function | `getCustomers()` in `services/api.ts` (line ~659) |
| Endpoint | `GET /api/customers` |
| Returns | `Customer[]` with fields: `id`, `name`, `reference`, `type`, `email`, `phone`, `address`, `city`, `country`, `taxId`, `contactPerson`, etc. |
| Backend | `customers_routes.py` → `customers_service.py` → SQLite `customers` table |

Customer type defined in `services/api.ts` lines ~626–655.

---

## 8. Branch Staff List API

| | Details |
|---|---|
| Frontend function | `getEmployees()` in `services/api.ts` (line ~830) |
| Endpoint | `GET /api/employees` |
| Returns | `Employee[]` with `id`, `name`, `role`, `department`, `branchId`, `status` |
| Backend | `employees_routes.py` → `employees_service.py` → SQLite `employees` table |
| Branch filtering | Done client-side in `branchScopedEmployees` memo: filters by `e.branchId === currentBranchId` and active/probation status |

Employee type defined in `components/employees/employees-store.ts` lines ~17–40.

---

## 9. Backend Models

### SalesOrder (SQLite table: `sales_orders`)
Fields (from `orders_service.py` `INSERT` statement ~line 100):
- `id`, `lpo_number`, `date_received`, `customer_name`, `customer_id`
- `customer_quotation`, `quotation_attachment` (JSON)
- `date_to_be_delivered`, `handled_by`, `employee_id`
- `status` — valid values: `draft | advertised | submitted_egp | bid_opened | tech_eval | fin_eval | evaluated | contracts_cmte | awarded | contract_signed | complete | declined`
- `decline_reason`, `complaints` (JSON array)
- `amount`, `notes`
- `required_document_types` (JSON), `account_details` (JSON), `ppda_compliance` (JSON)
- `is_lpo_account`, `created_at`, `updated_at`

### SalesOrderItems (SQLite table: `sales_order_items`)
Fields: `id`, `sales_order_id`, `item_id`, `name`, `quantity`, `unit_price`, `total`, `sort_order`

**Key insight**: Orders and Bids use the **same table** (`sales_orders`). The `is_lpo_account` flag differentiates LPO Accounts from regular bids. There is no separate "orders" table — the distinction is semantic.

Backend serializers: `d:\House\qterp\backend\models\serializers.py` (~30 KB)
Backend service: `d:\House\qterp\backend\services\orders_service.py` (~16 KB)
Backend routes: `d:\House\qterp\backend\routes\orders_routes.py` (~10 KB)

---

## 10. Relevant File Paths & Line Counts

| File | Size / Lines | Role |
|---|---|---|
| `frontend/src/routes/app.orders.tsx` | 279 KB / ~4500 lines | **Primary target** — Bids page with all tabs |
| `frontend/src/routes/app.bids.tsx` | 53 KB / ~1400 lines | Secondary PPDA-focused page (not the main page) |
| `frontend/src/types/sales-order.ts` | 4.4 KB / ~150 lines | TypeScript types for `SalesOrder`, `OrderItem`, etc. |
| `frontend/src/services/api.ts` | 35 KB / ~900 lines | All API calls incl. orders, customers, employees |
| `frontend/src/components/layout/Sidebar.tsx` | 6.2 KB / ~200 lines | Nav — "Bids" link points to `/app/orders` |
| `frontend/src/components/layout/BottomNav.tsx` | ~3.6 KB / ~80 lines | Mobile nav — "Bids" link also `/app/orders` |
| `frontend/src/components/employees/employees-store.ts` | ~50 lines | `Employee` type definition |
| `backend/routes/orders_routes.py` | 10.8 KB / ~270 lines | REST endpoints for orders/documents |
| `backend/services/orders_service.py` | 16.6 KB / ~430 lines | Business logic, DB queries for orders |
| `backend/models/serializers.py` | 30.6 KB / ~800 lines | Row → dict serialization |
| `backend/routes/customers_routes.py` | 3.5 KB / ~100 lines | Customer CRUD |
| `backend/routes/employees_routes.py` | 3.6 KB / ~100 lines | Employee CRUD |
| `frontend/src/routeTree.gen.ts` | 17.5 KB | Auto-generated — updated by `tsr generate` |

---

## 11. Conclusions & Implementation Recommendations

### A. Tab Restructure (in `app.orders.tsx`)
1. Change `activeTab` type to `"documents" | "bids" | "orders"` (remove `"ppda"`).
2. Rename the tab key `"lpo"` → `"orders"` and label → "Orders".
3. Rename the tab key `"orders"` → `"bids"` and label → "Bids".
4. Remove the `"ppda"` tab entirely (inline PPDA component and `PpdaComplianceWorkspace` can be deleted or kept internally).
5. New tab order: `["documents", "bids", "orders"]`.
6. Update the `layoutId="orders-tab-slider"` render block and all `activeTab === "..."` conditionals.

### B. Orders Sub-Page — "Select Bid First" Gate
The `LpoWorkspace` component (currently the `"lpo"` tab) should be redesigned as the `"orders"` tab:
1. Add a `selectedBidId` state. Show a "Select an existing Bid" picker (dropdown or searchable list of all `orders` with pipeline statuses) before the Create Order form.
2. Only enable the "Create Order" button when a bid is selected. Pre-populate fields (customer, amount, staff) from the selected bid.
3. The `CreateLpoAccountSheet` already supports customer pre-fill from `customers` array — augment it to also accept a `sourceBid?: SalesOrder` prop.

### C. Create Bid Window Cleanup
The `OrderFormSheet` is very complex (~600 lines). Simplify it to the user's spec:
- **Keep**: Bid Number (auto + editable), Date, Customer select (from DB), Bid Quotation (item/price/qty line adder), Notes, Staff (from branch employees list).
- **Remove from main form**: All PPDA compliance sub-fields, asset category specs, document checklist. These can stay in the detail side-sheet after creation.
- The line-item adder logic (cart items) already exists and works well — just strip the asset/category overlay.

### D. No Backend Changes Required
All data needed (orders, customers, employees) is already fetched. The `SalesOrder` model supports all required fields. No new endpoints are needed.

### E. `app.bids.tsx` Decision
The simpler `/app/bids` route can either be left as-is (unused) or removed. The sidebar does not link to it. It shares the same backend data. Recommend leaving it registered but not linking to it to avoid confusion — it can be cleaned up as a separate task.

---

## Key Risks

1. **`app.orders.tsx` is very large** (~4500 lines). Changes to the tab system are surgical but the file is complex. The coder should use targeted edits, not a full rewrite.
2. **`routeTree.gen.ts` is auto-generated** by `tsr generate` (TanStack Router). No manual edits needed there.
3. **`is_lpo_account` flag**: The current system uses the same `SalesOrder` record for both "bids" and "LPO accounts." The new flow (select a bid → create an order) should probably set a `linkedBidId` or similar. Since no such field exists in the schema currently, the simplest approach is to store a reference in `customerQuotation` or `notes`, or add a new JSON field in `accountDetails`. No DB migration is needed since `account_details` is a JSON blob.

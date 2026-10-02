# Implementation Plan — Bids Page Redesign

**Target file:** `d:\House\qterp\frontend\src\routes\app.orders.tsx` (5 740 lines)

---

## A. Tab Restructure

### A1 — `activeTab` useState type (line 306)

**Current:**
```ts
const [activeTab, setActiveTab] = useState<"documents" | "lpo" | "orders" | "ppda">("documents");
```
**Change to:**
```ts
const [activeTab, setActiveTab] = useState<"documents" | "bids" | "orders">("documents");
```

### A2 — `useEffect` that loads documents (line 367)

**Current:**
```ts
if (orders.length > 0 && (activeTab === "documents" || activeTab === "lpo")) {
```
**Change to:**
```ts
if (orders.length > 0 && (activeTab === "documents" || activeTab === "orders")) {
```
(The orders tab = old LPO tab; it needs documents loaded.)

### A3 — `sections` array (line 392)

**Current:**
```ts
const sections = ["hero", "kpis", "tabs", "documents", "lpo", "orders"];
```
**Change to:**
```ts
const sections = ["hero", "kpis", "tabs", "documents", "bids", "orders"];
```

### A4 — KPI card `onClick` callbacks (lines 654–656 and 664)

Two `KpiCard` components call `setActiveTab("ppda")`:

- **Lines 653–657** — "Stages In Progress" card:
  ```tsx
  onClick={() => {
    setActiveTab("ppda");
    setOverdueOnly(false);
  }}
  ```
  **Change to:** remove the `onClick` prop entirely (or point to `"bids"` — but these PPDA stats are being deemphasized, so simply remove the onClick to make the card non-interactive).

- **Line 664** — "Compliance Gaps" card:
  ```tsx
  onClick={() => setActiveTab("ppda")}
  ```
  **Change to:** remove the `onClick` prop entirely.

### A5 — Tab bar render array (line 675)

**Current:**
```tsx
{(["documents", "lpo", "orders", "ppda"] as const).map((t) => {
  const active = activeTab === t;
  const label =
    t === "documents" ? `Documents ${documents.length ? `(${documents.length})` : ""}`
    : t === "lpo" ? `LPO & Awarded (${orders.length})`
    : t === "ppda" ? `PPDA Compliance`
    : `Bids (${filtered.length})`;
```

**Replace with:**
```tsx
{(["documents", "bids", "orders"] as const).map((t) => {
  const active = activeTab === t;
  const lpoOrders = orders.filter((o) => o.isLpoAccount === true);
  const label =
    t === "documents" ? `Documents ${documents.length ? `(${documents.length})` : ""}`
    : t === "orders" ? `Orders (${lpoOrders.length})`
    : `Bids (${filtered.length})`;
```

Note: `lpoOrders` const is defined inside the `.map` callback so it's scoped properly; alternatively define it once as a `useMemo` in the `OrdersPage` body above the return statement — preferred approach for performance.

**Preferred (add `lpoOrders` memo above the return):**
Add after the `branchScopedEmployees` memo (around line 467):
```ts
const lpoOrders = useMemo(() => orders.filter((o) => o.isLpoAccount === true), [orders]);
```
Then the label line becomes:
```tsx
: t === "orders" ? `Orders (${lpoOrders.length})`
```

### A6 — Tab panel conditionals

- **Line 716:** `{activeTab === "lpo" && (` → Change to `{activeTab === "orders" && (`
- **Line 728:** `{activeTab === "ppda" && (` → **Remove this entire block** (lines 728–956, see Section B)
- **Line 957:** `{activeTab === "orders" && (` → Change to `{activeTab === "bids" && (`

---

## B. PPDA Tab Content Removal

### B1 — Remove the `activeTab === "ppda"` JSX block

**Lines 728–956** (inclusive):
```
{activeTab === "ppda" && (
  <div className="space-y-6">
    ...
    <PpdaComplianceWorkspace orders={orders} />
  </div>
)}
```
Delete lines 728–956 entirely. This includes:
- The inline PPDA compliance overview table (lines 731–860)
- The 12-stage kanban section (lines 862–950)
- The `<PpdaComplianceWorkspace orders={orders} />` call (line 953)

### B2 — `PpdaComplianceWorkspace` function (lines 5554–end of file ≈ 5740)

The `PpdaComplianceWorkspace` component definition is at lines 5554–5740. Once its single caller (line 953) is deleted, this entire function definition becomes dead code. Delete it.

Also delete the helper `workingDaysBetween` function that sits just above `PpdaComplianceWorkspace` (around lines 5530–5553) and the `UGANDA_2026_PUBLIC_HOLIDAYS` constant above that — grep for `UGANDA_2026_PUBLIC_HOLIDAYS` to confirm its exact start line. These are only used by `PpdaComplianceWorkspace`.

### B3 — `PpdaPreferenceBadge` function

The `PpdaPreferenceBadge` function (around line 188, found above `DeclineReasonDialog`) is still used inside the **Bids table** (the `activeTab === "orders"` → will become `"bids"`) row rendering (around line 1107). **Keep it.**

### B4 — State variables that ONLY serve the PPDA tab inline block

The following `OrdersPage` state variables are used exclusively inside the now-deleted `activeTab === "ppda"` block or in KPI card `onClick` handlers that are being removed:
- `overdueOnly` / `setOverdueOnly` (line 305) — **Keep**: it is also used in the `filtered` memo (line 375) and inside the `activeTab === "orders"/"bids"` table view (line 983). Do NOT delete it.

No additional `OrdersPage`-level state is exclusively for the PPDA tab. The `dashboardStats.complianceGapCount` calc can remain since removing it would require restructuring the large `dashboardStats` memo — leave it in place; it is harmless.

---

## C. OrderFormSheet PPDA Field Removal

### C1 — PPDA `useState` variables to remove from `OrderFormSheet`

These are declared at approximately lines 3512–3544:

```ts
const [ppdaProcurementMethod, setPpdaProcurementMethod] = useState<ProcurementMethod>("open_domestic");
const [ppdaIsLocal, setPpdaIsLocal] = useState<boolean>(true);
const [ppdaIsMsme, setPpdaIsMsme] = useState<boolean>(false);
const [ppdaDomesticPct, setPpdaDomesticPct] = useState<string>("30");
const [ppdaBidSecurity, setPpdaBidSecurity] = useState<boolean>(false);
const [ppdaBidSecurityAmt, setPpdaBidSecurityAmt] = useState<string>("");
const [ppdaBidSecurityValid, setPpdaBidSecurityValid] = useState<string>("");
const [ppdaBidSecurityIssuer, setPpdaBidSecurityIssuer] = useState<string>("");
const [ppdaUraTcc, setPpdaUraTcc] = useState<ComplianceStatus>("pending");
const [ppdaNssf, setPpdaNssf] = useState<ComplianceStatus>("pending");
const [ppdaPpdaCert, setPpdaPpdaCert] = useState<ComplianceStatus>("pending");
const [ppdaUrsb, setPpdaUrsb] = useState<ComplianceStatus>("pending");
const [ppdaAudited, setPpdaAudited] = useState<ComplianceStatus>("pending");
const [ppdaBidSecStatus, setPpdaBidSecStatus] = useState<ComplianceStatus>("not_required");
const [ppdaPrn, setPpdaPrn] = useState<ComplianceStatus>("pending");
const [ppdaDecl, setPpdaDecl] = useState<ComplianceStatus>("pending");
const [ppdaEvalCmte, setPpdaEvalCmte] = useState<string>("");
const [ppdaContractsCmte, setPpdaContractsCmte] = useState<string>("");
const [ppdaStandstillEnd, setPpdaStandstillEnd] = useState<string>("");
const [ppdaBidOpenedAt, setPpdaBidOpenedAt] = useState<string>("");
const [ppdaTechEvalAt, setPpdaTechEvalAt] = useState<string>("");
const [ppdaFinEvalAt, setPpdaFinEvalAt] = useState<string>("");
const [ppdaAwardedAt, setPpdaAwardedAt] = useState<string>("");
const [ppdaContractSignedAt, setPpdaContractSignedAt] = useState<string>("");
```

**Delete all 24 of these.**

### C2 — PPDA state resets inside the `useEffect` (lines 3600–3608 approx)

The `useEffect(() => { if (open) { ... } }, [open, nextLpo, employees])` block resets all PPDA state. Delete the PPDA-related reset lines:
```ts
setPpdaProcurementMethod("open_domestic");
setPpdaIsLocal(true);
setPpdaIsMsme(false);
setPpdaDomesticPct("30");
setPpdaBidSecurity(false);
setPpdaBidSecurityAmt("");
setPpdaBidSecurityValid("");
setPpdaBidSecurityIssuer("");
setPpdaUraTcc("pending");
setPpdaNssf("pending");
setPpdaPpdaCert("pending");
setPpdaUrsb("pending");
setPpdaAudited("pending");
setPpdaBidSecStatus("not_required");
setPpdaPrn("pending");
setPpdaDecl("pending");
setPpdaEvalCmte("");
setPpdaContractsCmte("");
setPpdaStandstillEnd("");
setPpdaBidOpenedAt("");
setPpdaTechEvalAt("");
setPpdaFinEvalAt("");
setPpdaAwardedAt("");
setPpdaContractSignedAt("");
```

### C3 — PPDA `submit()` logic (lines 3800–3830 approx)

The `submit()` function constructs a `mergedCompliance: PpdaComplianceDetails` object with all PPDA state and passes it as `ppdaCompliance: mergedCompliance` into `onCreate(...)`.

**Replace the entire `mergedCompliance` construction block and `ppdaCompliance: mergedCompliance` in the `onCreate` call with just `ppdaCompliance: undefined`.** The backend `orders_service.py` stores `ppda_compliance` as nullable JSON; passing `undefined` is safe.

Specifically, delete:
```ts
const domesticPctNum = parseFloat(ppdaDomesticPct) || 0;
const isWorks = ...;
const schedule3Eligible = ...;
const prefMargin = ...;
const mergedCompliance: PpdaComplianceDetails = { ... };
```
And in the `onCreate({...})` call, change `ppdaCompliance: mergedCompliance` → remove the field (it will default to `undefined`/absent).

### C4 — PPDA JSX sections to delete from `OrderFormSheet` JSX

Three `<motion.div>` blocks follow the cart section in the form JSX (approximately lines 4515–4700):

1. **PPDA · Classification & Preference (Schedule 3 / 4)** — starts with:
   ```tsx
   <motion.div ... className="rounded-xl border-[#003399]/25 border-dashed ...">
     <span ...>PPDA · Classification &amp; Preference (Schedule 3 / 4)</span>
   ```
   Delete this entire `<motion.div>` block.

2. **PPDA · 8-Point Statutory Compliance Status** — starts with:
   ```tsx
   <span ...>PPDA · 8-Point Statutory Compliance Status</span>
   ```
   Delete this entire `<motion.div>` block.

3. **PPDA · Evaluation & Award Attribution** — starts with:
   ```tsx
   <span ...>PPDA · Evaluation &amp; Award Attribution</span>
   ```
   Delete this entire `<motion.div>` block.

### C5 — Fields to KEEP in `OrderFormSheet`

These fields must remain intact:
| Field | State variable | Approx. line |
|---|---|---|
| LPO Number (bid number) | `lpoNumber` / `setLpo` | ~3455 |
| Date received | `dateReceived` | ~3456 |
| Customer select (from DB) | `selectedCustomerId`, `customerName` | ~3457–3458 |
| Order Line Items (Cart) | `cartItems`, all cart handlers | ~3470+ |
| Delivery date | `dateToBeDelivered` / `setDelivery` | ~3476 |
| Handled by (staff) | `handledBy` | ~3477 |
| Notes | `notes` | ~3478 |
| Quotation attachment | `quotationAttachment` | ~3459 |
| Asset/inventory item adder | `addItemName`, `addItemPrice`, `addItemQty`, etc. | ~3460+ |

The "Fetch LPO from database" select at the top of the form JSX and the `selectedLpoSource` state should also be kept — they serve the bid workflow by allowing an existing LPO to be selected as a template.

---

## D. Orders Tab — Bid Selection Gate

### D1 — `LpoWorkspace` props interface (lines ~1300–1308)

```ts
type LpoWorkspaceProps = {
  orders: SalesOrder[];
  documents: SalesOrderDocument[];
  customers: Customer[];
  employees: Employee[];
  onPreview: (order: SalesOrder) => void;
  onSwitchToDocuments: () => void;
  onCreateLpoAccount: () => void;
};
```

The `orders` prop passed in currently comes from `OrdersPage`'s `orders` state (all orders). After the redesign, the Orders tab should show only LPO orders (`isLpoAccount === true`). Pass `lpoOrders` instead of `orders` to `LpoWorkspace`.

### D2 — `onCreateLpoAccount` button inside `LpoWorkspace` (line ~1459)

```tsx
<Button
  onClick={onCreateLpoAccount}
  ...
>
  <FilePlus className="h-4 w-4" />
  <span>Create LPO Account</span>
</Button>
```

This is where the bid-selection gate is inserted. Replace the button area with the following pattern:

**Add `selectedBidForOrder` state inside `LpoWorkspace`** (or pass it up — keeping it inside `LpoWorkspace` is simpler since no other component needs it):

```tsx
const [selectedBidForOrder, setSelectedBidForOrder] = useState<SalesOrder | null>(null);
```

**Change `LpoWorkspaceProps` to add:**
```ts
bids: SalesOrder[];  // non-LPO orders = bid candidates
```

**Replace the Create LPO Account button area** with:
```tsx
<div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
  {/* Bid Selector */}
  <Select
    value={selectedBidForOrder?.id ?? ""}
    onValueChange={(val) => {
      const bid = bids.find((b) => b.id === val) ?? null;
      setSelectedBidForOrder(bid);
    }}
  >
    <SelectTrigger className="w-[220px] bg-white text-xs">
      <SelectValue placeholder="Select an existing bid first…" />
    </SelectTrigger>
    <SelectContent>
      {bids.filter((b) => b.status !== "declined").map((b) => (
        <SelectItem key={b.id} value={b.id}>
          <span className="font-mono font-semibold">{b.lpoNumber}</span>
          <span className="text-muted-foreground ml-2 text-xs">· {b.customerName}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>

  <Button
    onClick={() => selectedBidForOrder && onCreateLpoAccount(selectedBidForOrder)}
    size="sm"
    disabled={!selectedBidForOrder}
    title={!selectedBidForOrder ? "Select a bid first" : `Create order for bid ${selectedBidForOrder.lpoNumber}`}
    className="gap-1.5 bg-[#003399] text-white hover:bg-[#00297a] shadow-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
  >
    <FilePlus className="h-4 w-4" />
    <span>Create Order</span>
  </Button>

  <Button ... (onSwitchToDocuments) ... />
</div>
```

### D3 — `onCreateLpoAccount` signature change

In `LpoWorkspaceProps`, change:
```ts
onCreateLpoAccount: () => void;
```
to:
```ts
onCreateLpoAccount: (sourceBid: SalesOrder) => void;
```

In the `OrdersPage` render where `LpoWorkspace` is used (line ~716), update the render to:
```tsx
{activeTab === "orders" && (
  <LpoWorkspace
    orders={lpoOrders}
    bids={orders.filter((o) => !o.isLpoAccount)}
    documents={documents}
    customers={customers}
    employees={branchScopedEmployees}
    onPreview={(o) => setLpoSideSheetOrder(o)}
    onSwitchToDocuments={() => setActiveTab("documents")}
    onCreateLpoAccount={(sourceBid) => {
      setSelectedSourceBid(sourceBid);
      setLpoAccountFormOpen(true);
    }}
  />
)}
```

Add a new `OrdersPage` state:
```ts
const [selectedSourceBid, setSelectedSourceBid] = useState<SalesOrder | null>(null);
```

### D4 — `CreateLpoAccountSheet` — source bid pre-population

Add optional `sourceBid` prop:
```ts
function CreateLpoAccountSheet({
  open,
  onOpenChange,
  nextLpo,
  customers,
  employees,
  onCreateLpoAccount,
  sourceBid,      // NEW
}: {
  ...
  sourceBid?: SalesOrder | null;
}) {
```

Inside the `useEffect([open, nextLpo, employees])` that resets state, when `sourceBid` is provided, pre-populate:
```ts
if (sourceBid) {
  setSelectedCustomerId(sourceBid.customerId || "");
  setCompanyName(sourceBid.customerName);
  setFeeAmount(String(sourceBid.amount || ""));
  setHandledBy(sourceBid.handledBy || employees[0]?.name || "");
  setEmployeeId(sourceBid.employeeId || employees[0]?.id || "");
  // auto-fill address from customers list if customer id is known
  if (sourceBid.customerId) {
    const cust = customers.find((c) => c.id === sourceBid.customerId);
    if (cust) {
      setCompanyAddress(cust.address || "");
      setCompanyTin(cust.taxId || "");
      setCompanyLocation(cust.city || cust.country || "");
      setContactPersonName(cust.contactPerson || cust.name);
      setContactPersonPhone(cust.phone || "");
      setContactPersonEmail(cust.email || "");
    }
  }
}
```

Also add a visible "Source Bid" callout at the top of the form if `sourceBid` is provided:
```tsx
{sourceBid && (
  <div className="rounded-lg border border-[#003399]/20 bg-[#003399]/5 p-3 text-xs text-[#003399]">
    <span className="font-semibold">Linked Bid:</span> {sourceBid.lpoNumber} · {sourceBid.customerName}
  </div>
)}
```

Update the `CreateLpoAccountSheet` call in `OrdersPage` JSX (lines ~1227–1234):
```tsx
<CreateLpoAccountSheet
  open={lpoAccountFormOpen}
  onOpenChange={(open) => {
    setLpoAccountFormOpen(open);
    if (!open) setSelectedSourceBid(null);
  }}
  nextLpo={nextLpo(orders)}
  customers={customers}
  employees={branchScopedEmployees}
  onCreateLpoAccount={handleCreate}
  sourceBid={selectedSourceBid}
/>
```

Store the `sourceBid` link in `accountDetails` inside `handleSubmit` in `CreateLpoAccountSheet`:
```ts
accountDetails: {
  ...existing fields...
  sourceBidId: sourceBid?.id ?? undefined,
  sourceBidNumber: sourceBid?.lpoNumber ?? undefined,
},
```

---

## E. Dead-Code Cleanup

### E1 — Imports that become unused after removals

After removing the PPDA tab content (`PpdaComplianceWorkspace` + inline PPDA block) and PPDA form fields, the following lucide-react imports may become unused — verify each after edits:

- `TrendingDown` — used in `PpdaComplianceWorkspace` only → **remove**
- `DollarSign` — used in `PpdaComplianceWorkspace` only → **remove**
- `Square` — used in `PpdaComplianceWorkspace` only → **remove**
- `Trophy` — used in PPDA Evaluation & Award section of `OrderFormSheet` → **remove** after deleting that section
- `Signature` — used in `STATUS_META` object (still needed for `contract_signed` status) → **keep**
- `FileCheck` — used in PPDA 8-point compliance section of `OrderFormSheet` → **remove** after deleting that section
- `Users2` — used in both `OrderFormSheet` PPDA section and `STATUS_META` → **keep** (STATUS_META needs it for `contracts_cmte`)
- `Calculator` — used in `STATUS_META` only → **keep**
- `Megaphone` — `STATUS_META` → **keep**
- `Send` — `STATUS_META` → **keep**
- `FolderOpen` — `STATUS_META` → **keep**
- `ClipboardCheck` — `STATUS_META` → **keep**
- `ShieldAlert` — used in `PpdaPreferenceBadge`, status select rows, and PPDA tab → check; still needed in bid table rows for admin gate display → **keep**
- `Info` — used in `PpdaPreferenceBadge` → **keep**
- `Check` — used in `PpdaPreferenceBadge` → **keep**

After deleting `PpdaComplianceWorkspace`, also check these imports from types:
- `ComplianceStatus` — still used in `PpdaPreferenceBadge` and in `OrderFormSheet`... but if PPDA fields are removed from `OrderFormSheet`, `ComplianceStatus` is only used in `PpdaPreferenceBadge` which reads from order data — **keep** it.
- `ProcurementMethod` — only used in `OrderFormSheet` PPDA state and `PpdaComplianceWorkspace` → **remove** after deleting both.
- `PpdaComplianceDetails` — used in PPDA tab inline block and `OrderFormSheet` submit → **remove** after deleting both.

### E2 — `dashboardStats.complianceGapCount` computed value

This is computed in the `dashboardStats` `useMemo`. It's harmless to leave in (the calculation costs negligibly). The PPDA KPI card that displays it still renders — its `onClick` is merely removed, so the card itself remains. **Leave this value in place.**

### E3 — `sections` `sectionIndex` function

`sections` array at line 392 references `"lpo"` and `"orders"` (old keys). Update to `["documents", "bids", "orders"]` as noted in A3. The `sectionIndex` function itself is unchanged.

---

## F. Verification Steps

After all changes are applied:

```bash
cd d:\House\qterp\frontend
npx tsc --noEmit
```

Expected: zero TypeScript errors.

Confirm tab order is correct — the compiled/source file should contain:
```
"documents", "bids", "orders"
```
as the tab bar array literal.

Confirm PPDA tab is gone:
- `activeTab === "ppda"` should no longer appear in the file
- `PpdaComplianceWorkspace` should no longer appear in the file

Confirm Orders tab uses bid selection gate:
- `selectedBidForOrder` should appear inside `LpoWorkspace`
- `sourceBid` should appear in `CreateLpoAccountSheet` props

---

## Execution Order

```
- [ ] 1. Tab restructure (A1–A6): change activeTab type, update useEffect, tab bar array, labels, conditionals.
         Files: app.orders.tsx (lines 306, 367, 392, 653-666, 675-695, 716, 728, 957)
         Verify: file still compiles (tsc --noEmit)

- [ ] 2. PPDA tab block removal (B1–B2): delete lines 728–956 and PpdaComplianceWorkspace + helpers (lines ~5520–5740).
         Files: app.orders.tsx
         Verify: tsc --noEmit; grep for "activeTab === \"ppda\"" returns nothing

- [ ] 3. OrderFormSheet PPDA field removal (C1–C4): delete 24 useState declarations, their reset lines,
         mergedCompliance submit logic, and the 3 PPDA motion.div JSX sections.
         Files: app.orders.tsx
         Verify: tsc --noEmit; form renders cleanly with only bid number, date, customer, items, delivery, staff, notes

- [ ] 4. Orders tab bid-selection gate (D1–D4): add selectedBidForOrder state, bids prop, Select component,
         update LpoWorkspaceProps, update OrdersPage render, add sourceBid to CreateLpoAccountSheet.
         Files: app.orders.tsx
         Verify: tsc --noEmit

- [ ] 5. Dead-code import cleanup (E): remove TrendingDown, DollarSign, Square, Trophy, FileCheck,
         ProcurementMethod, PpdaComplianceDetails imports.
         Files: app.orders.tsx (lines 1–115)
         Verify: tsc --noEmit — zero errors, zero "unused import" warnings
```

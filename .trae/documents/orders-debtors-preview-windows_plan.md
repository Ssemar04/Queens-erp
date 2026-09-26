# Preview Windows for Orders & Debtors Pages Implementation Plan

## Repository Research

### Current State
- **Orders page** ([app.orders.tsx](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx)): Table of `SalesOrder`s. Each row has inline "Handled by" select, "Status" select, and admin-only delete (trash icon). No preview / view-details capability. You have to open the edit sheet (which doesn't exist) or squint at the truncated table cells to see line items, notes, attachment names.
- **Debtors page** ([app.debtors.tsx](file:///d:/House/qterp/frontend/src/routes/app.debtors.tsx)): Thin wrapper that renders `<LedgerPage kind="debtor" />`.
- **Creditors page** will be the same component with `kind="creditor"`, so any preview added to `LedgerPage` benefits both automatically.
- **LedgerPage** ([LedgerPage.tsx](file:///d:/House/qterp/frontend/src/components/ledger/LedgerPage.tsx)): Table of `LedgerEntry` rows. Each row has `Pay` button (opens `PaymentSheet`) and admin-only delete. No preview for seeing payment history, notes, tags, promise-to-pay dates. Users must click into "Pay" just to see prior payments.

### Existing Design Patterns to Mirror
- **ReceiptDialog** in `TransactionsTable.tsx`: Top colored header band with icon + status badge, then structured content sections with rounded bordered cards, grid layouts for meta info, items/line-items table with grid columns, totals breakdown in a muted background card, and action buttons in `DialogFooter`. **This is the gold-standard preview pattern** in the app.
- **AttachmentPreviewDialog** in `CashFlowPanel.tsx`: Clean Dialog with header + scrollable content area + footer. Good structure reference.
- `STATUS_META` map in orders page (L66-72) already has icon+label+color per status — re-use for preview header.
- `STATUS_CLS` + `BUCKET_CLS` in LedgerPage (L23-38) already have visual mappings — re-use for preview.

### Data Models Available
- `SalesOrder`: lpoNumber, customerName, customerQuotation, quotationAttachment, dateReceived, dateToBeDelivered, handledBy, items[], amount, status, notes.
- `LedgerEntry`: reference, partyName, partyRef, issueDate, dueDate, amount, paid, status, notes, payments[], promiseToPay, tags[].

## Files and Modules

### 1. Orders page
- `d:\House\qterp\frontend\src\routes\app.orders.tsx`
  - Add `previewOrder` state (`SalesOrder | null`)
  - Add `Eye` preview button to each row's action cell
  - Add `<OrderPreviewDialog>` component (defined in same file, pattern matches ReceiptDialog)
  - Pass `orders` array (not currently needed, just for attachment handling)

### 2. Ledger / Debtors / Creditors page
- `d:\House\qterp\frontend\src\components\ledger\LedgerPage.tsx`
  - Add `previewing` state (`LedgerEntry | null`)
  - Add `Eye` preview icon button in each row's actions column (between Pay and Trash)
  - Add `<EntryPreviewDialog>` component (defined in same file, pattern mirrors ReceiptDialog)
  - Wire "Record payment" button inside preview to trigger `setPaying(entry)` (cross-link the flows)

## Implementation Steps

### Step 1 — Orders page: Preview button + dialog
1.1. Add `const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);` in `OrdersPage`.
1.2. Add an `Eye` icon button (ghost, size="icon", h-7 w-7) to the row actions cell, **before** the trash button. Use `group-hover:opacity-100` pattern already established.
1.3. Build `OrderPreviewDialog` component (bottom of same file, like `ReceiptDialog`):
   - **Header band**: Dark background (`bg-foreground text-background`), left icon from `STATUS_META[status].icon`, right status badge from `STATUS_META[status].cls`. Title = LPO number, subtitle = "Queenstech ERP sales order".
   - **Meta grid (3-col)**: Date received, Customer, Delivery date (use ReceiptMeta-style cards — reuse the pattern inline).
   - **Line items table**: Bordered rounded card with column headers grid (Item | Qty | Amount), then rows for each `items[]` entry with total.
   - **Customer quotation / notes section**: If `customerQuotation` or `notes` exist, show a bordered card with FileText icon + quoted text.
   - **Attachment preview**: If `quotationAttachment` is present, render a preview block (image preview if image type, or generic file card with Download + Open buttons using dataUrl anchor downloads). Use `asChild` Button pattern from CashFlowPanel.
   - **Totals card**: Muted background. Subtotal = sum(line items). Amount (grand total) with strong style. Handled by line.
   - **Footer actions**: Close, (optional quick action: "Record delivery" → change status to delivered via existing `handleStatusChange`, but keep it lightweight — at minimum "Close" and "Record payment" or status change shortcut to in_progress/delivered/cancelled via select).
1.4. Wire dialog's onOpenChange to set `previewOrder = null` on close.
1.5. Add dialog render `<OrderPreviewDialog order={previewOrder} onOpenChange={(open) => !open && setPreviewOrder(null)} onStatusChange={handleStatusChange} />` before closing `</div>` of OrdersPage.

### Step 2 — LedgerPage: Preview button + dialog
2.1. Add `const [previewing, setPreviewing] = useState<LedgerEntry | null>(null);` to LedgerPage.
2.2. Add `Eye` preview icon button (ghost, size="icon", h-7 w-7) to the actions div between Pay and Trash buttons, inside the group-hover opacity wrapper.
2.3. Build `EntryPreviewDialog` component:
   - **Header band**: `bg-foreground text-background`, icon = `isDebtor ? ArrowDownToLine : ArrowUpFromLine` (already imported), left title = reference, right status badge with `STATUS_CLS[entry.status]`, subtitle = isDebtor ? "Invoice · Accounts receivable" : "Bill · Accounts payable".
   - **Status / aging strip**: Aging bucket pill + days aging text + progress bar (paid / amount).
   - **Meta grid (4-col or 2×2)**: Party/customer, party reference, Issue date, Due date.
   - **Financial summary card (muted bg)**: Amount, Paid (with check badge), Balance (bold, colored amber if > 0), Progress bar of collection %.
   - **Payment history timeline**: If `payments.length > 0`, render a nice bordered card with each payment as a row: date, method (cash/mpesa/bank/cheque/card with icons?), reference, amount (green badge), note. Use CheckCircle2 green for fully-paid line, or $ Banknote icons.
   - **Promise to pay**: If `e.promiseToPay` exists, highlight as an amber/blue info card with Calendar icon and the date.
   - **Tags**: If tags present, render as pill chips.
   - **Notes**: If notes present, render with FileText icon card.
   - **Footer actions**:
     - Close button
     - If not fully paid (`balance > 0`): Primary CTA "Record payment" → onClick = `setPaying(entry)` + close preview (this chains straight into the existing PaymentSheet flow — beautiful #becreative integration)
     - If attachment preview pattern from orders is reused for notes/doc images, expand here.
2.4. Render `EntryPreviewDialog` near `PaymentSheet` and `EntryFormSheet` at the bottom.

### Step 3 — Polishing & micro-interactions (#becreative)
3.1. **Staggered section reveals** inside both dialogs: Use `framer-motion` `<motion.div>` with `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}` wrapped around each section (meta, items, totals, payments, notes). Framer-motion is already a dependency (package.json L60).
3.2. **Progress bar animation** in Ledger preview: When dialog opens, animate progress width from 0 → actual % via motion `animate: { width: `${progress}%` }` with `transition: { duration: 0.6, delay: 0.1, ease: "easeOut" }`.
3.3. **Hover-glow** on preview button: `hover:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]` transition-all for subtle lift.
3.4. **Attachment preview** in Orders dialog: Image gets subtle zoom-in on hover via `hover:scale-[1.01] transition-transform`.
3.5. **Payment timeline row hover** in Ledger preview: Light bg-muted/60 flash.

## Dependencies and Considerations

- No new dependencies. `framer-motion` is already installed and available. All icons (Eye, FileText, Calendar, CheckCircle2, etc.) are imported from `lucide-react` which is already in use throughout.
- The preview dialogs render *inside* their parent components' return trees to share state (handleStatusChange, setPaying) without prop-drilling extra interfaces. This matches the `ReceiptDialog` / `PaymentSheet` pattern.
- For orders `quotationAttachment`, the dataUrl already exists inline on the object from when it was uploaded via FileReader in OrderFormSheet. Simply create `<a href={dataUrl} download={name}>` wrapped Button via `asChild` for native download — no extra work.
- Order items can be empty if the order used a free-text `customerQuotation` instead of cart items. Handle gracefully: Skip line-items section, just show `customerQuotation` in its place with the FileText card.
- Ledger `payments` array can be empty. Render "No payments recorded yet" with Sparkles icon in that card area.

## Validation

1. **Orders page visual check**:
   - Each row shows Eye icon (revealed on hover per group-hover).
   - Click Eye → dialog opens with correct LPO #, customer, dates, items, attachment if present.
   - Status select in footer / header badge matches. Can transition status and closes cleanly.
   - Totals add up (items sum = amount).
   - Framer motion stagger visible: sections pop in one after another.

2. **Ledger / Debtors page visual check**:
   - Each row shows Eye button between Pay and Trash on hover.
   - Click Eye → dialog shows correct ref, party, aging, amount/paid/balance, progress bar animates.
   - Payment history visible if any.
   - "Record payment" CTA works: closes preview and opens PaymentSheet pre-filled with same entry.
   - Works for both `kind="debtor"` (Debtors page) and would work for `kind="creditor"` (Creditors page) — since LedgerPage is shared.
   - Promise-to-pay card renders if set, tags render if any, notes render if set.

3. **TypeScript check**: `GetDiagnostics` on both files after edits (plus any type helpers).

4. **Edge cases**:
   - Empty items array on order.
   - No attachment on order.
   - Zero payments (empty payment state).
   - Fully-paid entry: balance = 0, footer shows only Close (no Record payment CTA).
   - Draft / disputed entries: still render preview normally.

## Risks

- **Risk — Large dialog scroll**: Orders with many items, or LedgerEntry with many payments, could make dialog tall.
  - **Handling**: `DialogContent` uses `max-h-[92vh] overflow-y-auto p-0` pattern (same as ReceiptDialog). Header/footer are sticky via natural Dialog structure — content scrolls. ✓
- **Risk — Motion sickness from animations**: Over-animating hurts accessibility.
  - **Handling**: `framer-motion` respects `prefers-reduced-motion` by default. Keep motion subtle (short durations, small translation distances). Skip stagger count beyond 6 sections.
- **Risk — Payment sheet + preview opening simultaneously**: Clicking Record payment closes preview and opens Pay. If both open at once, stacked dialogs.
  - **Handling**: In onClick handler, set `setPreviewing(null)` first then `setPaying(entry)` immediately in same tick. The single React render batch will unmount preview and mount PaymentSheet cleanly. No stack.
- **Risk — Status change closes preview without feedback toast**:
  - **Handling**: Reuse existing `handleStatusChange` which already emits `toast.success("Status updated")`, and keep dialog open OR close after — close is simpler since table updates visually.

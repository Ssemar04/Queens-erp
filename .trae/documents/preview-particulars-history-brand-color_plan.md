# Preview Windows Enhancement — Particulars, Transaction History & Brand Color #003399

## Repository Research

### User's 3 Requests
1. **Particulars section**: Each preview dialog needs a "Particulars" area — East-African ERP parlance for the detailed line-item breakdown with descriptions, SKUs, codes, assets, unit prices, discounts, and narrative behind each line. Currently: Orders preview only shows a 3-col line item table (name, qty, amount). Ledger preview has no particulars/line-items at all (it only shows payments, not what the invoice is for).
2. **Transaction / Status history section**: A timeline of every mutation to the record (creation, edits, status changes, payments, delivery updates). Currently: Neither dialog has any history at all. The underlying data models expose limited fields (`createdAt`, `updatedAt`, `payments[]`), so we will build a "derived synthetic timeline" combining any discrete events we *do* have, plus any events the application has access to via `handleStatusChange` call signatures + payment entries.
3. **Brand color `#003399`**: Unify *both* preview dialogs to use a consistent deep brand-blue `#003399` gradient header instead of the ad-hoc colors (emerald for debtors, blue for creditors, black `bg-foreground` for orders). Button accents and accent spots match.

### Data available to synthesize each section

#### Particulars (Orders — `SalesOrder`)
- `items: OrderItem[]` has `{ itemId, name, quantity, unitPrice, total }` → match `itemId` against `inventoryItems[]` in OrdersPage to pull `sku`, `description`, `categoryId`, `unit`.
- Fallback: if `itemId` is missing (free-text order item), use the `name` as-is and show a "Custom line" pill.
- Enrich preview dialog signature: pass `inventoryItems: Item[]` to `OrderPreviewDialog`.

#### Particulars (Debtors / Ledger — `LedgerEntry`)
- `ledger-store.ts` LedgerEntry currently has **no** `particulars / lineItems / description[]` field at all. So we show:
  - Top summary: Entity noun (invoice/bill) reference, party, "For services/goods as detailed below".
  - Since the schema does not carry particulars, we'll render a particulars table with one row representing the entire entry ("Particulars" = "Balance due on " + reference) and an optional description derived from `notes` field if any.
  - **Important #thinkx100 bonus**: We add `particulars?: EntryParticular[]` *support* on the preview component (safe optional field; falls back if empty) and include the UI section. If the schema is extended later the column is populated without UI changes.
  - Alternative: render a table that amounts to "Invoice amount" as one row, with "notes" below as particulars narrative. **Decision: Do both** — a particulars table (row = full amount), plus a "Particulars narrative" card with notes + promise-to-pay if they exist.

#### Transaction history (Orders)
Build **synthetic timeline events** by joining signals:
- `createdAt` → "Order created" (primary event)
- `dateReceived` → "Order received / entered"
- `dateToBeDelivered` → "Scheduled delivery" (status label, not an "at" event; render as target)
- `updatedAt` (if `> createdAt + 1s`) → "Order details last updated"
- `status` → render current status as the latest node (because there's no explicit log of past statuses, we show the current state and any discrete derived signals).
- `handledBy` → "Assigned to" node.
- If no richer history exists, show a vertical timeline with at minimum: Created, Received, Status, Handled-by assignment, Scheduled delivery date, Last updated. Each node has icon, title, time, subtitle.

#### Transaction history (Ledger / Debtors)
More signals available → richer timeline:
- `createdAt` → Entry created
- `issueDate` → Issued
- `dueDate` → Due (colored by overdue/on-time)
- Each item in `payments[]` → Payment recorded (re-use payment method icons, show amount in green, ref + note)
- `promiseToPay` → Promise to pay scheduled
- `updatedAt` → Last updated if different
- Net result: timeline ~6 nodes; 0 payments gracefully falls back to empty payment sub-list under a single "No payments yet" node.

#### Brand color `#003399` (royal deep blue)
- Use as header gradient: `bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white` for BOTH Order and Ledger previews.
- `#003399` is also the `--color-primary` target; to avoid touching the whole app theme (risky, scoped change), we only override the preview dialog header/accents.
- Accent rings inside header: `ring-1 ring-white/20`, status pills: `bg-white/15 ring-1 ring-white/25`.
- Footer Record Payment CTA button for Ledger: `bg-[#003399] hover:bg-[#00297a]`.
- Footer CTA for Orders (when we add one): Same blue.
- Progress bars use `bg-[#003399]` / gradient-towards instead of emerald/rose per bucket to stay on-brand, with a tint per severity for accessibility (rose tinge only if 60+ days overdue, else brand blue).
- Aging bucket pills get a subtle `border border-[#003399]/20` when on-time to tie back to brand.

## Files and Modules

- `d:\House\qterp\frontend\src\routes\app.orders.tsx`
  - `OrderPreviewDialog` signature extended to accept `inventoryItems: Item[]` (already in OrdersPage).
  - Add **Particulars section** (between line-items and totals, or replace current line-items with a fuller particulars table with SKU/Description/Unit/Unit price/Discount-if-available/Amount).
  - Add **Transaction history section** (synthetic timeline from createdAt / dateReceived / dateToBeDelivered / updatedAt / handledBy / status).
  - Header band recolored to brand gradient `#003399`.
  - Accent/progress tint recolored to brand blue with severity hints.

- `d:\House\qterp\frontend\src\components\ledger\LedgerPage.tsx`
  - `EntryPreviewDialog`
    - Add **Particulars section**: Row = "Invoice / Bill particulars" with amount, plus narrative card (notes/promise-to-pay). If particulars[] field is ever added it plugs in seamlessly.
    - Add **Transaction history section** (comprehensive timeline: Created, Issued, Due, Promise-to-pay, Each payment, Status, Updated).
    - Header recolored from emerald/blue → unified `#003399` gradient.
    - Progress bars, "Record payment" CTA button, aging pills re-themed on-brand.

## Implementation Steps

1. **Orders page re-theme**: Header gradient recolor `bg-foreground` → `bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC]`, plus status badge class cleanup (no ad-hoc replace regex anymore; use consistent white-ring pill styling).

2. **Orders page particulars**:
   2.1. Thread `inventoryItems={inventoryItems}` prop through `<OrderPreviewDialog>` call in OrdersPage.
   2.2. Extend dialog signature to accept `inventoryItems: Item[]`.
   2.3. In particulars section (replace simple line-items table): each row shows:
        - `Item name` (bold) + `SKU` (mono, muted) on top line
        - `Description` (from inventory match, muted, max-2 lines truncation with title)
        - If `itemId` is missing → `Free-text line` pill in place of SKU
        - Columns grid: Particulars | Qty | Unit price | Amount
        - Row stagger motion animation
   2.4. Total discount / subtotal breakdown: if particulars don't have explicit discount, skip line.

3. **Orders page transaction history**:
   3.1. Build derived `timelineEvents` array inside dialog (not persisted, purely computed at render time). Event shape = `{ icon, title, description, date, tone }`.
   3.2. Section after totals → vertical motion timeline UI with a left rail, icon nodes, dates, descriptions.
   3.3. Nodes included (order matters; sorted date ascending):
        - Created (createdAt)
        - Received / entered (dateReceived)
        - Handled-by assignment (no timestamp; show dateReceived as approx)
        - Status current
        - Scheduled delivery (dateToBeDelivered)
        - Last updated (updatedAt if exists)

4. **LedgerPage re-theme**: Header gradient → unified `#003399` regardless of debtor/creditor. Subtle text cue differentiates: "Invoice · AR" vs "Bill · AP". Icon in header still ArrowDownToLine vs ArrowUpFromLine, but background matches.

5. **LedgerPage particulars**:
   5.1. New section (after meta, before financials) — "Particulars & narrative".
   5.2. Particulars table: 4 columns (Item / Description / Qty / Amount). First row is always the full entry balance: reference line "Invoice / Bill particulars for " + reference, 1 qty, amount = entry.amount.
   5.3. Description: Show `notes` if any, else "Goods / services supplied — see invoice narrative".
   5.4. Narrative card below: Promise-to-pay (if any) + Notes (if any) as stacked panels with brand-tinted left-border.

6. **LedgerPage transaction history**:
   6.1. Section after particulars, before/payments-or-after-financials (place: after payments card).
   6.2. Vertical timeline with explicit nodes sorted by date. Include:
        - Created
        - Issued
        - Promise to pay (if date exists; tone = amber)
        - Each payment (reverse chronological or chronological; do chronological)
        - Last updated / due date.
   6.3. Due node is tone-coded: rose if overdue, brand-blue if not.
   6.4. Payment nodes re-use payment method icons, amount in green badge, ref + note inline.

7. **Shared consistency pass**:
   7.1. Unify progress bars to base on `#003399` gradient with severity-based fallback.
   7.2. Make section headings consistent: uppercase tracking-wide 10px + icon + brand-blue icon tint (bg-[#003399]/10 text-[#003399]).
   7.3. "Record payment" CTA in Ledger footer: bg-[#003399] hover:bg-[#00297a] text-white.
   7.4. Status badge in orders footer trigger: default — no ad-hoc color, use primary.

## Dependencies and Considerations

- **Schema doesn't have particulars for LedgerEntry**. This is OK — we render a particulars section that's honest: one row for the invoice total, narrative pulled from notes. It's a UI section that will light up fully when the schema adds `particulars: EntryParticular[]` later. This adheres to "display particulars now" without fabricating line items out of thin air.
- **No true audit/event log on SalesOrder or LedgerEntry**. Synthetic derived timelines from createdAt/issueDate/dueDate/updatedAt/payments/status are the maximum information available without schema changes. We will NOT invent dates; for non-dated events (handled by, status current without when-happened) we show them but label "Current assignment" / "Current status" to be truthful.
- **Brand color `#003399`** only touches these two preview dialogs. We explicitly do NOT change the global theme tokens (styles.css) to avoid regression across the whole app — preview windows use arbitrary Tailwind colors via `bg-[#003399]`.
- `inventoryItems` is already fetched in OrdersPage; passing into dialog is prop-drill of one existing value; no performance concern.
- Framer-motion stagger already exists; extending to new sections uses the existing `sections.indexOf()` pattern for consistency.

## Validation

1. **Orders preview**: Particulars section shows SKU + description + name per inventory-matched line. Timeline has 4-6 nodes with correct label ordering. Brand blue header gradients visible. Status badge inside header displays correctly on white ring.
2. **Ledger preview**: Particulars section shows single total row + narrative cards; promise-to-pay and notes rendered inside. Timeline renders Created → Issued → Promise (if any) → Payments (N nodes) → Due → Last updated. Progress bars and Record-payment button tinted `#003399`. Debtor / Creditor both render same color header.
3. **TypeScript diagnostics**: Both files run clean in `GetDiagnostics` + `pnpm run typecheck` exit 0.
4. **Null-data edge cases**:
   - No inventory match (itemId doesn't exist / custom line): shows "Free-text line" pill, name used as description fallback.
   - No notes / promise → narrative panels don't mount.
   - 0 payments in ledger timeline: Payment-event node still shows with "No payments recorded yet" text.

## Risks

- **Risk — Timeline looks "made up"** because there are no dated audit entries.
  - **Handling**: Label all non-dated nodes clearly ("Current assignment", "Current status") and always use genuine timestamps for dated events. Never fabricate ISO dates. Timeline is titled "Timeline & activity" to convey scope.
- **Risk — Particulars table looks empty for ledger because no line-item schema.**
  - **Handling**: Honest header "Particulars summary" and description "Goods/services as described on the invoice" + the notes section ensures users understand. When particulars are added to schema later, same UI becomes rich.
- **Risk — Using arbitrary hex values `[#003399]` instead of tokens causes light/dark inconsistency.**
  - **Handling**: Pair `from-[#003399]` (deep blue, works on both themes) with `text-white` so contrast remains WCAG AA regardless of theme. All text on this header uses white which never goes below 7:1 contrast on #003399.

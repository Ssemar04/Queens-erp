# Asset ↔ Sale Sync: Badge Printing Details & Auto-Income Recording

## Problem
When a user creates a sale and links it to an asset (e.g. Fargo badge printer, Large Format printer, Digital Printer), the sale revenue and job details are NOT automatically reflected in the asset's Finance tab. This creates a manual bookkeeping burden — staff must separately record the income against the asset to track per-machine profitability. For Fargo badge printing specifically, the job details (single/double side, lamination, badge count) are lost after the sale and not visible when auditing the asset's output history.

## Users & Goals
- **Operations staff**: Record a sale with a linked asset once; the system auto-logs the income to the asset's Finance sub-page with full job details.
- **Finance / Manager**: Open the asset preview window → Finance tab at any time and see a complete, auditable trail of every sale-linked income entry including Fargo badge printing specs, Large Format area dimensions, Digital Printer page counts.
- **Owner / Director**: Quickly verify per-asset revenue contribution and see what kind of work each machine is producing (badges vs banners vs prints) without drilling into individual receipts.

## Goals
1. **Auto-sync**: When a sale is saved (via "Add sale" sheet), every line item that has a linked `assetId` automatically creates an `AssetIncome` record on that asset, in real-time, as part of the same save flow.
2. **Rich income descriptions**: Each synced income entry carries structured job details in its description — for Fargo badges this includes side mode (single/double), lamination status, and badge count; for Large Format the dimensions/area; for Digital Printer the page count.
3. **Badge printing visual indicators**: In the AssetDetailSheet Finance tab, income entries from Fargo/badge jobs render with a violet-tinted visual treatment plus dedicated badge chips showing side mode and lamination, not just plain text.
4. **Asset preview reflects sale status**: The asset preview window (AssetDetailSheet) header/KPI strip clearly signals "linked to sales" status, and the monthly income KPI auto-updates after every synced sale.
5. **#thinkx100 / #becreative polish**: Staggered entry animations in the finance list, colour-coded income-source badges (violet for badges, emerald for large format, blue for digital prints), mini "job type" icon per row, hover lift + tinted glow on income rows, tiny badge-preview mockups for Fargo rows.

## Non-Goals
- No changes to backend API surface — reuse existing `addAssetIncome` / `deleteAssetIncome` endpoints in `services/api.ts` (already called by `assets-store.addIncome`).
- No changes to the AddSaleSheet input UI or Fargo spec fields themselves (the fields already work perfectly).
- No bidirectional sync — deleting a sale does NOT auto-delete the income record (the existing `onRemoveIncome` handler in assets-store lets managers manually remove if needed).
- No new database tables or migrations — `AssetIncome` schema already has `source`, `description`, `reference` fields that are sufficient.

## Functional Requirements
### FR-1 Auto-sync income on sale save
In `app.movements.tsx` → `handleCreateMovement`, after the existing `saveMovementTransactions(newMovements).then(...)` succeeds:
1. Extract the `lineItems` from the saved sale (each `StockMovement.sale.lineItems`).
2. Group line items by `assetId` (skip items with `assetId == null`).
3. For each unique `assetId`, aggregate:
   - `totalAmount`: sum of `lineTotal` across all line items for that asset.
   - `badgeDetailsByItem`: per-item spec details for the description field.
   - `receiptNumber`: `commonSale.receiptNumber`.
   - `date`: ISO date (YYYY-MM-DD) from `createdAt`.
   - `staff`: `commonSale.staff`.
   - `customer`: `commonSale.customer`.
4. Call `assetsStore.addIncome(assetId, incomePayload)` for each unique asset.
5. Invalidate `["backend", "assets"]` or rely on assets-store's internal `setAssets` — confirm UI reflects new income without a manual refresh.
6. If any `addIncome` call fails, do NOT fail the whole sale (it's already saved). Instead, show a toast warning "Sale saved; X asset income entries skipped due to error" and continue.

### FR-2 Structured description & source field for synced income
Each auto-synced `AssetIncome` payload MUST have:
- `source`: A category string derived from the asset's `assetCategory` / category-kind. Values:
  - "Badge Print (Fargo)" for `kind === "fargo"`
  - "Large Format" for `kind === "large_format"`
  - "Digital Print" for `kind === "digital_printer"`
  - "Linked Sale" for default/other categories
- `description`: Human-readable single line that includes item name + category specs. Examples:
  - Fargo: "Staff ID badges — Double side, Laminated × 50"
  - Large format: "Company banner — 2.5 × 1.2 m = 3.00 m²"
  - Digital: "Flyer A4 colour — 250 pages"
- `reference`: The sale's `receiptNumber` (e.g. `RCP-1234567`), clickable/visible in finance rows.
- `amount`: Sum of line totals for that asset (UGX, numeric).
- `currency`: "UGX" (hardcoded, matches rest of the app).
- `recordedBy`: The sale's `staff` field (auto-attributed staff, not manual).
- `date`: YYYY-MM-DD from the sale's `createdAt`.

### FR-3 FinanceTab: Badge-printing dedicated visual treatment
In `AssetDetailSheet.tsx` → `FinanceTab`, when rendering each income entry row:
1. **Source badge tinting**: The existing `Badge` showing `i.source` MUST use category-tinted classes matching the asset category:
   - Source = "Badge Print (Fargo)" → violet tint (`bg-violet-50 border-violet-200 text-violet-700`).
   - Source = "Large Format" → emerald tint.
   - Source = "Digital Print" → blue tint.
   - Source = "Linked Sale" / other → default `variant="outline"`.
2. **Fargo badge detail chips**: When the income's source/description indicates a Fargo/badge job, render two inline chips AFTER the source badge:
   - Side chip: `variant="outline"` with "Single" or "Double side" (parse description or store a structured hint — see FR-2 alt). Use violet ring.
   - Lam chip: "Laminated" emerald or "No lam" muted badge.
3. **Job-type icon**: Replace or augment the generic `FileText` icon at the start of each row with a job-specific icon:
   - Fargo: `CreditCard` icon (badge/card-shaped) in violet-600/700.
   - Large format: `Ruler` icon in emerald-600/700.
   - Digital: `Printer` icon in blue-600/700.
   - Other: default `FileText`.
4. **Micro "badge preview"**: For Fargo rows ONLY, add a tiny illustrative card (32×20px rounded) at the end of the row — a gradient violet/white with a 1px border and a tiny dot simulating a badge chip. Purely decorative.
5. **Row click handler**: Add a `onClick` on each income row (full row `cursor-pointer`) that dispatches a browser custom event or toast showing the receipt number — "Linked to receipt #RCP-XXXXXXX" — so staff can jump to a receipt lookup in future. (Actual navigation to a receipt view is out of scope for this spec; the toast/event is sufficient.)

### FR-4 Asset preview header shows "linked to sales" signal
In `AssetDetailSheet.tsx` → `Body` component:
1. Add a 5th KPI card to the top KPI strip (current 4 KPIs → 5th KPI): "Sales linked" with a count of `asset.income.length` (or `asset.income.filter(i => i.reference).length`), icon = `Receipt`. Tint the KPI chip emerald when count > 0, muted otherwise.
2. In the SheetTitle / header badge row (current badges: category, staff, status), append a new Badge `variant="outline"` with "N sale entries" only if N > 0, using emerald border.
3. Ensure the existing monthly income KPI in the 4th card (`thisMonthIncome`) and the monthly target progress bar re-render automatically after a synced sale (no stale values).

## Non-Functional Requirements
### NFR-1 Animations & polish (#thinkx100 / #becreative)
- **Finance list rows**: Staggered `motion.div` entry (initial `opacity:0, y:6` → animate `opacity:1, y:0`) with `staggerChildren: 0.04s` + `delayChildren: 0.03s`.
- **Row hover**: `bg-[#003399]/[0.025]` backdrop tint, subtle `translateY(-1px)`, the per-row left-border accent (3px, same tint as source) gains a soft glow shadow.
- **Source badge**: Spring `scale(1)` → hover `scale(1.03)` via Framer Motion or CSS transition.
- **Badge chips for Fargo**: When added to the row, `initial: { opacity: 0, scale: 0.8 }` → `animate: { opacity: 1, scale: 1 }` with 120ms delay after row mount for staggered feel.
- **Fargo micro-preview card**: Subtle inner gradient `linear-gradient(135deg, #ede9fe 0%, #ffffff 50%, #ddd6fe 100%)` + soft `shadow-[0_1px_2px_rgba(139,92,246,0.2)]`.

### NFR-2 Idempotency & duplicate protection
- Before calling `addIncome` in FR-1 step 4, check if the asset already has an income entry with matching `reference == receiptNumber` for the same sale (e.g. user clicks "Save" twice, or a retry). Skip duplicates with a toast info "Income entry for #RCP-XXXX already recorded on asset".
- Compare by `reference` string match since receipt numbers are unique per sale.

### NFR-3 Performance
- For sales with up to 20 line items each with a different asset, the additional per-asset `addIncome` calls must not block the UI — they already run after the sale resolves (non-blocking `.then` chain).
- Memoize the FinanceTab row rendering so a new income entry doesn't re-render all rows unnecessarily.

## Constraints
- **React Hook Safety**: All `useMemo`/`useState`/`useEffect` in modified files must stay ABOVE any conditional early returns. Do NOT introduce "Rendered more hooks than previous render" errors (per project_memory lessons learned Sept 26).
- **Existing assets-store API**: Only use `assetsStore.addIncome` and `assetsStore.removeIncome` — do not write direct setAssets mutations from `app.movements.tsx`.
- **No new files**: Keep all implementation within existing files: `app.movements.tsx`, `AssetDetailSheet.tsx`, optionally tiny helpers inline in `inventory.ts` type file for description builders.
- **Branch isolation**: The sale save already runs in the current branch context; asset lookups and updates via `getAssets()`/`addAssetIncome()` use the same `X-Branch-ID` header. No extra branch-scoping work needed.
- **Role checks**: The sale save already has a `PermissionGate permission="log_movement"`; the asset-income creation is automatic and piggybacks on that same auth context (the user who can log a sale can implicitly record income).

## Assumptions
- `assetsStore.addIncome` calls `addAssetIncomeApi` which writes to the backend and returns the persisted row — this is the canonical mechanism to record income and we do NOT bypass it.
- `StockMovement.sale.lineItems` always contains `assetId`, `assetCategory`, and `assetCategorySpec` fields when the user selected an asset in AddSaleSheet.
- The `formatAssetSaleSpec()` helper in `types/inventory.ts` is the correct formatter to build structured description strings.
- Receipt numbers (e.g. `RCP-${Date.now().toString().slice(-7)}`) are unique enough for the duplicate-protection check in NFR-2.

## Open Questions
_OIQ-1_: Should duplicate-protection compare by `reference` only, or `reference + assetId` (since one receipt can span multiple assets)? → Assumed `reference + assetId` as the composite key (a single receipt can have multiple linked assets and each gets its own income entry).

_OIQ-2_: If a sale is later DELETED via `handleDeleteTransaction`, should the matching asset income entries also be deleted automatically? → Out of scope per Non-Goals; keep manual remove via FinanceTab delete button for now.

## Acceptance Criteria
### rule AC-1 Auto-sync on sale save
Given a new sale submitted from AddSaleSheet where at least one line item has `assetId != null`, within 1 second after the "Sale recorded" toast appears, that asset's `income` array MUST contain a new entry with:
- `reference === receiptNumber`
- `amount === sum of lineTotals for that assetId in that sale`
- `date === sale date (YYYY-MM-DD)`
- `recordedBy === sale staff`
- `source` matches the asset kind (Badge Print / Large Format / Digital Print / Linked Sale)

### rule AC-2 Duplicate protection
Saving the exact same sale twice (same receipt number + same asset) or calling the save flow twice for the same payload does NOT create duplicate income entries. One of:
- 2nd call skips with info toast OR
- Backend returns the existing row (dedup on reference+assetId)

### rule AC-3 Fargo badge details visible in FinanceTab
For an income entry with source "Badge Print (Fargo)", its row renders:
- A violet-tinted source Badge.
- Two inline info chips: one for side mode (Single/Double) + one for lamination status.
- A `CreditCard` icon for the job-type icon (not generic FileText).
- A micro decorative badge-preview card on the row end.

### rule AC-4 Asset header shows sales-linked signal
When opening `AssetDetailSheet` for an asset that has ≥ 1 sale-linked income entries:
- The KPI strip contains a 5th KPI: "Sales linked" with a count > 0.
- The header badge row includes a badge reading "N sale entries" (N > 0).

### rule AC-5 Hook safety
`GetDiagnostics` on `app.movements.tsx` and `AssetDetailSheet.tsx` report ZERO TypeScript / ESLint errors; no "Rendered more hooks than previous render" runtime errors occur when toggling open/close the asset sheet or saving sales.

### rubric AC-6 Visual polish & micro-interactions
Scale: 0–3. Pass threshold: ≥2.
- 0: Static rows, no animations, plain source badges.
- 1: Basic tint on source badges + job-specific icons; no hover or stagger.
- 2 (pass): Staggered row entry animation. Row hover: background tint + translate-y -1px + category left-border accent glow. Source badges have hover scale. Fargo side/lam chips visible.
- 3: All of 2 plus: Fargo micro-preview card with gradient; badge chips pop-in after row mount; left-border category accent has a soft blur-shadow on hover; receipt-toast event fires on row click.

### rubric AC-7 Finance audit clarity
Scale: 0–3. Pass threshold: ≥2.
- 0: Can't tell what kind of work an income row represents.
- 1: Source + description readable, no structured chips.
- 2 (pass): Source badge colour-code + job icon + description + receipt reference — a manager can distinguish badge jobs from large format from digital prints at a glance without reading descriptions.
- 3: All of 2 plus: the 5th KPI + header badge give an immediate "how much of this asset's revenue came from customer sales" overview without scrolling to Finance tab, and the month-income KPI (4th card) auto-updates live after sync.

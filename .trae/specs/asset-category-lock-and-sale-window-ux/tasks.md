# Asset Category Lock & Sale Window UX - Implementation Plan

## Task 1: Centralize fixed asset categories and remove editable category manager
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create a single, app-wide exported `ASSET_CATEGORIES: string[]` constant inside `AssetFormSheet.tsx` (or new shared location if cross-imports are awkward — prefer assets-store.ts for reachability) listing the 8 categories in FR-2 order.
  - Export helper functions: `isAssetCategory()` for type-guards, `getAssetCategoryMeta(category)` returning display color tint chip info (per rubric AC-9).
  - Remove `getStoredAssetCategories()`, `saveStoredAssetCategories()`, `manageCatOpen` state, `newCatInput` state, `handleAddCategory()`, `handleRemoveCategory()`.
  - Rework the "Category" field label to drop the "Manage Category" ghost button; replace category Select with one reading the central constant.
  - Preserve backward compatibility (FR-3): if an Asset's `category` is not in the new set, append it as a disabled `SelectItem` with `(legacy)` subtitle (users can view, not create new).
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-1.1: Static scan of `AssetFormSheet.tsx` shows 0 references to handleAddCategory / handleRemoveCategory / manageCatOpen / localStorage key `qterp_asset_categories_v1`. Evidence: `Grep` for those identifiers returns 0 matches.
  - `rule` TR-1.2: `<Select>` category dropdown mounts exactly 8 `SelectItem`s + any legacy ones (for existing assets only). Evidence: runtime DOM snapshot showing 8 items for a new asset form.
  - `rule` TR-1.3: Existing assets (in-memory store) opened via "Edit asset" still have their legacy category selected and disabled SelectItem shown if the category is legacy. Evidence: edit an asset with a legacy category and confirm the label.
  - `rubric` TR-1.4: Dimension = Compact form cleanliness after removing manage button; Scale 1-5; anchors 1 = button gap still visible, 3 = removed but no vertical alignment match with Serial No label, 5 = Category label row has identical padding/vertical rhythm as the adjacent Serial Number label. Threshold >= 4. Evidence: side-by-side screenshot.
- **Notes**: This task is the foundation. Must be complete before T3/T4 read the constant.

## Task 2: Extend OrderItem and SalesOrder types for category-specific specs
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None (parallel-safe with T1)
- **Description**:
  - In `types/sales-order.ts`, add discriminated-union optional fields to `OrderItem`:
    - `assetId?: string` — link back to source Asset if this line came from one.
    - `assetCategory?: string` — snapshot of the asset category at the time of order creation (so renaming categories later doesn't invalidate old orders).
    - `assetCategorySpec?: LargeFormatSpec | DigitalPrinterSpec | FargoSpec | null` with kinds discriminated: `{ kind: "large_format", widthM: number, heightM: number } | { kind: "digital_printer", pages: number } | { kind: "fargo", sideMode: "single" | "double", laminated: boolean }`.
  - Add a helper function `formatAssetSpec(spec)` returning a human-readable one-liner string like `"1.5 × 2.0 m = 3.00 m²"`, `"42 pages"`, `"Double side, Laminated"` — used by cart rows, preview, receipts.
  - Ensure optional fields: all APIs (createOrder / updateOrder / localStorage) are tolerant of missing fields via current spread patterns.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5, AC-7, NFR-1, NFR-3
- **Test Requirements**:
  - `rule` TR-2.1: TypeScript build with `strict` flags shows no errors. Evidence: GetDiagnostics returns empty array on the modified file.
  - `rule` TR-2.2: `formatAssetSpec(null)` returns `""`, formatAssetSpec(LF 1.5×2) returns string matching `/m²$/.test()`, DP 42 returns `/pages$/, Fargo double/laminated returns `Double side, Laminated`. Evidence: REPL or unit inline console checks.
  - `rule` TR-2.3: Existing `SalesOrder`/`OrderItem`-reading code (`OrderPreviewDialog` line items loop, orders-table summary, debtor calculations) continue to compile and produce identical totals when `assetCategorySpec` is absent. Evidence: no file changes required in those files (besides adding secondary text).
  - `rubric` TR-2.4: Dimension = Clarity of type model; Scale 1-5; anchors 1 = loosely-typed `any` object used, 3 = separate non-discriminated types, 5 = clean TypeScript discriminated union with exhaustive match helper. Threshold >= 4. Evidence: code listing of types + helpers.

## Task 3: Merge Assets into OrderFormSheet item picker with group labels
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - In `OrderFormSheet` (`app.orders.tsx` lines 3111+): import `useAssetsStore` and expose `assets` list.
  - Rewrite the item adder Select content (lines 3440–3461) to use two `<SelectGroup>` blocks: `<SelectLabel>Stock Items</SelectLabel>` then existing items, then `<SelectLabel>Assets</SelectLabel>` plus Asset entries, each showing a category chip on the right-hand side like `(Fargo)`.
  - Update `handleSelectInventory()` to handle both Item ids and Asset ids — detect the source via a prefix convention or a lookup map keyed separately; e.g. `asset__${asset.id}` string encoding so one SelectValue string can hold both.
  - Update the cart adder so selecting an Asset (not an Item) stores the linked `assetId`, `assetCategory`, and pre-populates `addItemName` with `${asset.name}` and `addItemPrice` with 0 or a sensible default.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-3.1: `inventoryItems` list + `assets` list = all appear in the Select grouped correctly. Evidence: runtime screenshot or DOM query of `<SelectContent>` showing both group labels.
  - `rule` TR-3.2: Picking an Asset → assetId/assetCategory/name/price (0 default) load into state; picking a Stock Item → existing behavior. Evidence: DevTools state dump after pick.
  - `rule` TR-3.3: After picking a Legacy-categorized asset, the adder controls fall back to default qty input (no category-specific fields crash). Evidence: select one legacy-category asset → UI still functional.
  - `rubric` TR-3.4: Dimension = Dropdown scannability; Scale 1-5; anchors 1 = assets mixed flat with items, 3 = groups but no category chip, 5 = category chips use the AC-9 color tints per asset category. Threshold >= 4. Evidence: dropdown screenshot.

## Task 4: Category-specific controls in the item adder area + animation + validation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Introduce state slots for each category spec that needs user inputs: `[lfWidth, setLfWidth] = useState("")`, `[lfHeight, setLfHeight]`, `[dpPages, setDpPages]`, `[fgSideMode, setFgSideMode]<"single"|"double">("single")`, `[fgLaminated, setFgLaminated] = useState(false)`.
  - Introduce a `resetCategoryInputs()` helper resetting all to defaults. Call it on `useEffect` whenever the current selected asset/category changes.
  - Below the existing 12-col grid (line 3463–3511), insert a conditional `<motion.div>` area that ONLY renders when the currently-selected line is an Asset with a recognized category:
    - **Large Format**: Replace default `Qty` 2-col slot with 3 slots: Width (number, 4-col) → centered `by` chip (2-col) → Height (number, 4-col). Below, a single-row Emerald pill: `Area = W × H m²`. The 2-col "Add" button still lives on col-span-2.
    - **Digital Printer**: Single Pages number input 6-col, Blue tint Pages chip inline, 2-col Add stays.
    - **Fargo**: Whole extra row 12-col containing radio group (Single/Double) + 1 checkbox Laminated + summary violet chip; qty input row (the normal one) remains visible below because Fargo still counts badges.
    - **Other 5 / Legacy**: Render nothing extra — default qty input retains.
  - Implement `useMotionAnimatePresence` stagger slotting per AC-8 for slot entrances.
  - Update `handleAddItemToCart()` to compute qty per category: LF → `qty = max(1e-6, w * h)` (keep decimals allowed); DP → `qty = pages`; Fargo/defaults → standard qty input number. Populate `assetCategorySpec` with the right discriminated object, snapshot `assetId`/`assetCategory` onto cart item, and append the `formatAssetSpec()` short string to the cart item name.
  - Validation (FR-14): Before adding to cart, if LF and W<=0 or H<=0 show Rose toast "Enter width and height in meters". If DP pages<=0, show Rose "Enter pages". If Fargo or default qty<=0, existing guard.
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4, AC-5, AC-8, AC-9, FR-9, FR-10, FR-12, FR-13, FR-14
- **Test Requirements**:
  - `rule` TR-4.1: Large-Format scenario in AC-2 passes end-to-end. Evidence: Add → cart item shows name, quantity correct, total correct, assetCategorySpec populated.
  - `rule` TR-4.2: Digital-Printer scenario AC-3 passes. Same evidence pattern.
  - `rule` TR-4.3: Fargo scenario AC-4 passes. Same evidence pattern.
  - `rule` TR-4.4: Switching asset from LF → DP → Fargo clears stale fields and defaults reset. Evidence: state snapshot after 3 switches showing category-input fields reset each time.
  - `rule` TR-4.5: Large format validation → width=0, height=2 → "Enter width and height in meters" toast, item not added. Evidence: manual test screenshot.
  - `rubric` TR-4.6 (AC-8 motion): Dimension = Stagger polish; Scale 1-5; anchors 1 = no stagger, 3 = basic opacity, 5 = motion.section + y:-4→0 + 60ms interval per slot + blue ring-glow fade on category title. Threshold >= 4. Evidence: screen capture.
  - `rubric` TR-4.7 (AC-9 brand): Dimension = Unity with QTERP brand; Scale 1-5; anchors 1 = raw inputs, 3 = plain chips, 5 = Emerald/Blue/Violet/Gray tinted pills + "by" chip + h-8 compact inputs. Threshold >= 4. Evidence: per-category screenshot grid.

## Task 5: Display category-rich particulars in Cart rows and OrderPreviewDialog
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2, Task 4
- **Description**:
  - OrderFormSheet cart row (lines 3522+): below item name add an `<AnimatePresence>`-mounted `<p className="text-[11px] text-muted-foreground">` using `formatAssetSpec(item.assetCategorySpec)` to show the short subline. If `assetCategory` is present, include it prefix-style with a tiny tint dot.
  - OrderPreviewDialog particulars section (line 3970+ area, in `it.quantity` / `it.unitPrice` loop): under the item name, render the same formatAssetSpec one-liner as a muted subline. Keep totals computations unchanged.
- **Acceptance Criteria Addressed**: AC-7, FR-11
- **Test Requirements**:
  - `rule` TR-5.1: Cart row for AC-2 shows "Large format · 1.5 × 2.0 m = 3.00 m²". Evidence: screenshot.
  - `rule` TR-5.2: Cart row for AC-4 shows "Fargo · Double side, Laminated · x100". Evidence: screenshot.
  - `rule` TR-5.3: Order preview (after saving) shows the same sublines under each respective line item Particulars column. Evidence: OrderPreview screenshot.
  - `rule` TR-5.4: Plain inventory items (no category spec) render with no extra subline — no whitespace gap. Evidence: visual + DOM inspection.
  - `rubric` TR-5.5: Dimension = Particulars readability in preview; Scale 1-5; anchors 1 = duplicate/ugly text, 3 = subline OK but same font weight, 5 = subline lighter 11px muted with prefix category dot colored per AC-9 rules. Threshold >= 4. Evidence: particulars section screenshot.

## Task 6: Verification + cross-file diagnostics
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 1–5
- **Description**:
  - Run TypeScript diagnostics on every file modified in T1–T5.
  - Sanity-check no Rules of Hooks regressions by scanning every new hook location.
  - Manually walk through the 4 most important user journeys (LF, DP, Fargo, plain) in a running dev window (or via DOM snapshots) and annotate evidence.
- **Acceptance Criteria Addressed**: All ACs via aggregated evidence
- **Test Requirements**:
  - `rule` TR-6.1: GetDiagnostics on every modified file returns 0 entries. Evidence: tool output attached.
  - `rule` TR-6.2: No new conditional hooks introduced — all useState/useEffect/useMemo called unconditionally before any early return in added functions. Evidence: manual grep.
  - `rubric` TR-6.3: Dimension = Cohesive solution "feel"; Scale 1-5; anchors 1 = hacks/patches, 3 = works OK but inconsistent padding, 5 = fluid, category transitions feel productized. Threshold >= 4. Evidence: walkthrough summary.

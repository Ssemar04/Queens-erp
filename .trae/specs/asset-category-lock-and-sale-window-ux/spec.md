# Asset Category Lock & Sale Window Category UX - Product Requirements Document

## Overview
- **Summary**: Lock the asset category list to a pre-defined, non-editable set of 8 categories; when an asset is selected inside the sale order window, render a custom set of quantity/spec controls based on the asset's category (Large format = two number fields with "by" separator in square meters; Digital printer = single pages field; Fargo = 2 radio buttons + Laminated checkbox; remaining 5 categories = default simple numeric quantity field). Apply high-polish micro-interactions consistent with Queenstech ERP's brand language.
- **Purpose**: Eliminate manual category-entry errors on the asset side, and ensure point-of-sale captures correct per-unit-of-measure data for each revenue category.
- **Target Users**: Admin, Manager, and Staff users who create assets and place orders.

## Goals
1. No asset category can be manually typed, added, or deleted. Asset categories are a fixed list of 8.
2. When the order-form sheet adds a line item that originates from an Asset (not a stock Item), the "quantity / adder" controls section morphs to match the asset's category instead of showing a plain number input.
3. Every category-specific sale form has intelligent defaults and auto-populates the line item's `quantity` + `name` + display `particulars` correctly.
4. Category-specific values are persisted inside each order line (rendering them in Order Preview and receipt outputs) so downstream documents don't lose context.
5. Overall UX preserves the brand: gradient blue hero styling where applicable, Framer Motion staggered reveals, color-coded KPI-style chips for units of measure.

## Non-Goals
- No changes to the LPO Documents workspace.
- No new backend endpoints; this work targets the frontend data model and UI only.
- No changes to the Catalog/Items module (inventory categories `CategoryManager.tsx` are separate and remain admin-editable per prior hard constraints).
- No changes to receipt/PDF generation styling for black-and-white printing (already locked per earlier work).
- No changes to role guards beyond existing Admin restrictions.

## Background & Context
- Asset categories currently live in `AssetFormSheet.tsx` as `DEFAULT_ASSET_CATEGORIES` with a "Manage Category" modal that persists to `localStorage` under `qterp_asset_categories_v1` — this system is **to be fully removed** and replaced with a hard-coded, exported list shared by the sale window.
- The current sale window `OrderFormSheet` (in `app.orders.tsx`) offers a drop-down that lists `inventoryItems` of type `Item` (catalog stock). It has **no awareness of Assets**. The asset-store already hooks into `useAssetsStore()` and persists Assets to the backend via `services/api`; the sale window can either (a) consume Assets directly alongside Items, or (b) surface a second toggle "Asset / Stock Item" in the item-adder section. This spec treats (a) as the primary approach (merge lists with category tags) so the user doesn't have to pick a "mode".
- Category-specific pricing models:
  - **Large format (UV, DTF)** → print-shop area pricing in m². Adder UI = `[Width m]  by  [Height m]` = `quantity = width * height`, description suffix `(W × H m²)`. Total = qty × unit price (UGX per m²).
  - **Digital Printer** → job in pages. Adder UI = single `Pages` number field. `quantity = pages`, description suffix `(pages)`.
  - **Fargo** → ID/badge printing. Adder UI = 2 radios `Single side`/`Double side` + 1 checkbox `Laminated`. `quantity` is still an integer (number of IDs / badges), so a plain qty field remains below the option controls. Unit price should reflect "Side Mode × Lamination" surcharges with a readable breakdown. A human-readable `Fargo: Double, Laminated` style particulars suffix is appended to the line item name for downstream rendering.
  - **Computer & Accessories, Mobile devices, Non printers, Entertainment, Others** → default plain qty number field identical to today's inventory-item adder.

## Functional Requirements
- **FR-1 (Category lock)**: `AssetFormSheet.tsx` renders exactly 8 categories in the category Select. The "Manage Category" button and modal, `newCatInput` state, `manageCatOpen` state, `handleAddCategory`, `handleRemoveCategory`, `getStoredAssetCategories()` / `saveStoredAssetCategories()` are all removed or made no-op.
- **FR-2 (Fixed category list)**: The 8 hard-coded categories are: `Large format (UV, DTF)`, `Digital Printer`, `Fargo`, `Computer & Accessories`, `Mobile devices`, `Non printers`, `Entertainment`, `Others`. They live in a single central shared constant so the sale window and asset form read the same values.
- **FR-3 (Backward compatibility — existing assets)**: Any Asset stored with a legacy category not in the new set still renders its own category in the form; the new Select appends the legacy value as a disabled `SelectItem` with a "(legacy)" suffix. Users creating new assets cannot pick legacy values.
- **FR-4 (Sale window asset availability)**: The item-adder drop-down inside `OrderFormSheet` lists Assets (from `useAssetsStore`) alongside inventory Items, grouped with `<SelectLabel>` groups "Stock Items" and "Assets". Each Asset line shows its category as a badge chip.
- **FR-5 (Category-specific controls — Large format)**: When the currently-selected product is an Asset with category `Large format (UV, DTF)`, the plain single `Qty` input column is replaced with three columns: `Width (m)` number input + centered `by` chip/label + `Height (m)` number input. Below the inputs, a realtime computed `Area = W × H m²` pill displays with emerald chip styling.
- **FR-6 (Category-specific controls — Digital Printer)**: When the selected asset category is `Digital Printer`, replace the single `Qty` input with a single `Pages` number input. A "pages" chip (blue tint) sits inline next to the label.
- **FR-7 (Category-specific controls — Fargo)**: When the selected asset category is `Fargo`, render two segments below Name/Price:
  1. `Side mode`: Radio group with `Single side` and `Double side` (default: Single).
  2. `Lamination`: Single Checkbox `Laminated` (default: off).
  3. Standard `Qty` number input remains for badge count.
  4. A realtime preview summary `Fargo: Single, Not laminated / qty 50` pill shows current state.
- **FR-8 (Category-specific controls — other 5)**: The 5 other categories render today's default qty number input exactly as before.
- **FR-9 (Control reset on asset switch)**: When the user picks a different asset from the drop-down, all category-specific fields are reset to their logical defaults (e.g. Fargo returns to Single + Not laminated, Large format Width/Height reset to empty strings, etc.).
- **FR-10 (Cart item storage)**: When "Add" is pressed, category-specific data is persisted onto the `OrderItem` object inside new optional fields `assetCategorySpec?: LargeFormatSpec | DigitalPrinterSpec | FargoSpec | null` and `assetId?: string` and `assetCategory?: string`. Existing code that reads `quantity`/`unitPrice`/`total` continues to work unchanged.
- **FR-11 (Cart display)**: In the cart rows (and OrderPreviewDialog particulars section), category-rich line items render a compact, comma-separated summary (e.g. `Large format · 1.2 × 0.8 m = 0.96 m²`, `Fargo · Double side, Laminated · x50`) as a secondary muted subtitle below the item name.
- **FR-12 (Grand total math)**: For Large format, `quantity` recorded must equal `Number(width) * Number(height)` with both inputs > 0. For Digital Printer, `quantity = Number(pages)`. For Fargo and the rest, `quantity` is the qty integer. Total line calculation `qty × unitPrice` remains uniform across all variants and unchanged.
- **FR-13 (Staggered animation)**: Category-specific controls mount using a small Framer Motion stagger (slots fade in left→right with y: -4 → 0, 60 ms interval).
- **FR-14 (Validation)**: Add toast-time validation for each category: Large format requires width>0 AND height>0; Digital Printer requires pages>0; Fargo requires qty>0; others require qty>0.

## Non-Functional Requirements
- **NFR-1 (Type safety)**: New category-specific spec types live in `sales-order.ts` as discriminated unions so TypeScript enforces exhaustive rendering.
- **NFR-2 (One source of truth)**: Exactly one `ASSET_CATEGORIES` constant array is imported everywhere; no duplicated category strings.
- **NFR-3 (No backend breakage)**: New `OrderItem` optional fields are never required. Serialisation / localStorage / API calls must tolerate the fields being absent (older orders) or present (new orders).
- **NFR-4 (Brand fidelity)**: Color palette: `#003399` (primary blue), Emerald for computed computed/positive numbers, Rose for validation errors. Typography: uppercase tracking-wider labels at 11px, mono numerals for amounts, `bg-muted/40` soft pill surfaces for chips.
- **NFR-5 (Accessibility)**: Every number input has a proper `<Label htmlFor>` and radio group uses native `<RadioGroupPrimitive>` (or project's existing RadioGroup UI) with accessible labels.

## Constraints
- **Technical**: React 19 + Vite 7; Framer Motion; the project's `@/components/ui/*` primitives only. No new dependencies.
- **Business**: Existing Admin CRUD-only permission on Inventory Categories (`CategoryManager`) is untouched per prior hard constraint. Asset categories are locked for everyone (even Admin) — no UI exists to modify them.
- **Dependencies**: Relies on `useAssetsStore()` returning a populated list; if the assets store is mid-load the item adder treats Assets as an empty group gracefully.

## Assumptions
- Assets are the correct domain for the per-category sale UI differentiation requested. If a user needs to add "print work" without linking to a physical machine asset, they still have the "Custom / Other Item" flow.
- Unit price stays manual editable (UGX per m² / per page / per badge) regardless of category; no attempt to auto-price based on asset model yet.
- Fargo "double-side × laminate" multipliers on price are left as a user-facing label only and do not change the numeric unit price automatically (user adjusts the unit price field themselves). This keeps accounting unambiguous — if later rules are desired, they can be added without schema change.
- Existing assets with legacy categories are preserved "read-only" in the selection list; they fall back to default plain qty adder behavior.

## Acceptance Criteria

### AC-1: Asset category list is locked to 8
- **Type**: `rule`
- **Given**: Open "New Asset" sheet.
- **When**: Viewing the Category dropdown and surrounding UI.
- **Then**: Exactly 8 `SelectItem`s matching FR-2 in order are present; no "Manage Category" button exists; no input field allows typing a new category; clicking previous add-remove-category hotkeys does nothing; localStorage key `qterp_asset_categories_v1` is no longer written.
- **Pass Condition**: Static DOM query in `AssetFormSheet.tsx` returns 8 category options and zero category-manager dialog mounts / related buttons.
- **Evidence**: TypeScript diagnostics green + visual screenshot of new-asset category dropdown showing 8 options with manage button absent.

### AC-2: Large format sale UI calculates m² correctly
- **Type**: `rule`
- **Given**: New Order opened. In the item-adder, pick any Asset whose category = `Large format (UV, DTF)`.
- **When**: Fill Width=1.5, Height=2.0. Price=50000. Click Add.
- **Then**: Added cart row has quantity=3 (1.5×2), unitPrice=50000, total=150000. Row subtitle displays "Large format · 1.5 × 2.0 m = 3.00 m²".
- **Pass Condition**: grandTotal recomputes 150000 and cart row subtitle matches the pattern.
- **Evidence**: Manual browser check recorded as short loom/video or DOM snapshot + JS console grandTotal variable dump.

### AC-3: Digital printer UI captures pages
- **Type**: `rule`
- **Given**: Order form; select a Digital Printer asset.
- **When**: Set Pages=42, price=200, Add.
- **Then**: qty=42, unitPrice=200, total=8400; subtitle reads "Digital Printer · 42 pages".
- **Pass Condition**: qty and total match the pages × unit price.
- **Evidence**: Cart row values confirmed visually + state inspection.

### AC-4: Fargo option group writes particulars
- **Type**: `rule`
- **Given**: Order form; select any Fargo asset.
- **When**: Pick Double side radio, tick Laminated, qty=100, price=3500, Add.
- **Then**: qty=100, unitPrice=3500, total=350000; subtitle "Fargo · Double side, Laminated · x100". `assetCategorySpec` on the OrderItem is discriminated `{kind:"fargo", sideMode:"double", laminated:true}`.
- **Pass Condition**: Cart subtitle matches and `assetCategorySpec` persistence confirmed via state debugger.
- **Evidence**: DevTools inspection of `cartItems` array after add.

### AC-5: Remaining 5 categories use default qty adder
- **Type**: `rule`
- **Given**: Order form. Pick one asset from each of: Computer & Accessories, Mobile devices, Non printers, Entertainment, Others.
- **When**: Add each using qty=5, price=10000.
- **Then**: Controls area shows only the standard qty number input (no extra fields). All 5 rows land in cart with identical behavior to today's baseline stock items.
- **Pass Condition**: 5 cart rows created; no unexpected extra fields mounted; qty=5, total=50000 each.
- **Evidence**: Screenshot of cart after adding 5 rows.

### AC-6: Sale window lists both assets and stock items, grouped
- **Type**: `rule`
- **Given**: System has at least 1 Asset and 1 Stock Item.
- **When**: Open the item adder Select dropdown.
- **Then**: Two labeled groups appear — "Stock Items" (all inventory Items) and "Assets" (all Assets). Asset rows show a small category chip to the right.
- **Pass Condition**: Select DOM contains two separate `<SelectGroup>` / `<SelectLabel>` sections; category chip text matches one of the 8 FR-2 categories.
- **Evidence**: Dropdown screenshot.

### AC-7: OrderPreviewDialog particulars show category-rich summary
- **Type**: `rule`
- **Given**: An order saved that contains one Large-format, one Fargo, one plain inventory line.
- **When**: Preview the order via OrderPreviewDialog.
- **Then**: Particulars table for each asset line shows the category specs in a secondary line below the item name (e.g. "Fargo · Double side · x100"). Totals column reflects the same numbers as the cart.
- **Pass Condition**: Preview particulars table shows 3 items with correct secondaries and correct totals.
- **Evidence**: Screenshot of Order Preview window + totals sum check.

### AC-8: Staggered mount animation for category controls
- **Type**: `rubric`
- **Dimension**: Motion / micro-interaction polish
- **Scale**: 1-5
- **Anchors**: 1 = Controls pop in instantly with stagger, no opacity, no ease; 3 = fade in applied only to the whole section without slotting; 5 = Individual slots (Width + by + Height, or radio group rows) slide in y: -4→0 with 60 ms stagger, easing `outQuart`, and a subtle `glow` ring indicator on the freshly-morphed category title chip (blue 20% → 0% in 200 ms).
- **Pass Threshold**: >= 4
- **Evidence**: Video capture / motion test comparing mounts across 3 category switches.

### AC-9: Visual unity with brand design system (clean category chips + unit colors)
- **Type**: `rubric`
- **Dimension**: Brand / UI coherence
- **Scale**: 1-5
- **Anchors**: 1 = random colors, raw HTML inputs, no chip/badge for computed values; 3 = chips present with default tones, no accent color logic per unit; 5 = m² computed pill uses Emerald tint, pages chip uses Blue tint, Fargo summary uses Violet/Lavender tint; legacy categories fall back to Gray. "by" separator is an inline `rounded-md bg-muted/60 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground` chip. Inputs match the existing h-8 / bg-white / text-xs compact style seen elsewhere in the adder grid. Overall whitespace matches adjacent cells.
- **Pass Threshold**: >= 4
- **Evidence**: Screenshot gallery of all 8 categories adder states.

## Open Questions
- [ ] **OQ-1 (Pricing multipliers for Fargo)**: Should Double side auto 2x the unit price, and/or laminated auto-add a fixed surcharge? Current spec makes them human-readable labels only. Confirm if auto pricing is desired as a follow-up, or out of scope.
- [ ] **OQ-2 (Asset grouping in the picker)**: The item-adder Select currently lists hundreds of stock items — mixing Assets into the same dropdown may hurt scannability. Confirm the group+label approach (FR-4 + AC-6) works, or if you want a segmented control above the picker toggling "Stock / Assets" before rendering the list.
- [ ] **OQ-3 (Link asset usage back to Asset Dashboard)**: After adding a Fargo line, should Assets module dashboard's `income` bucket auto-record this as revenue attribution against that specific asset? If yes, this spec adds a new task; default assumption = no, future follow-up.
- [ ] **OQ-4 (Default pricing)**: Would you like unit-price defaults per asset pulled from `Asset.notes`/a new field? Current spec lets the operator type it each time.

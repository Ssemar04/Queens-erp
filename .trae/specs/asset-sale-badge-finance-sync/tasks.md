# Implementation Tasks — Asset ↔ Sale Sync + Badge Printing Details

## Task 1: Sale-save income auto-sync hook into `handleCreateMovement`
**Priority**: high
**Depends on**: —
**Scope**: `d:\House\qterp\frontend\src\routes\app.movements.tsx` (lines ~154–180, `handleCreateMovement` callback)

### Change summary
1. **Import `useAssetsStore`** at the top of `app.movements.tsx` next to the existing stores/hooks.
2. Inside the `TransactionsPage` component (before any early returns to preserve hook safety), destructure `addIncome` from `useAssetsStore()`:
   ```tsx
   const { addIncome } = useAssetsStore();
   ```
3. In `handleCreateMovement`, inside the `.then(async () => { ... })` after the existing `queryClient.invalidateQueries(...)` block, BEFORE the `toast.success` / `setFormOpen(false)`:
   a. **Extract sale + line items**: Take `newMovements[0].sale` (or traverse all movements to collect all unique sale line items). For each `StockMovement sm ∈ newMovements` → if `sm.sale?.lineItems` exists, flatten them into a single `allLineItems` array, carrying the parent sale's `receiptNumber`, `createdAt`, `staff`, `customer`.
   b. **Group by (assetId, receiptNumber)**: Build a `Map<string, { lines: SaleItem[]; receipt: string; date: string; staff: string; customer: string }>` where the key is `${assetId}__${receiptNumber}` — skip any line item with `assetId == null`.
   c. **For each group, build the AssetIncome payload**:
      - `totalAmount`: `lines.reduce(s, li => s + Number(li.lineTotal || 0), 0)` coerced via `Number(x) || 0`.
      - `source`: Use `getAssetCategoryKind(lines[0].assetCategory)` → map to "Badge Print (Fargo)" / "Large Format" / "Digital Print" / "Linked Sale" (add a small local helper or inline switch).
      - `description`: For each line in the group, join item name + `formatAssetSaleSpec(li.assetCategorySpec)`, then combine into one string: "Item1: specs; Item2: specs". For badge/Fargo specifically, append " × {qty}" at the end of each line fragment.
      - `reference`: receiptNumber.
      - `date`: `createdAt.slice(0, 10)`.
      - `recordedBy`: staff.
      - `currency`: "UGX" hardcoded.
   d. **Duplicate check BEFORE posting**: Call `assetsStore.assets` (already have store access) to find the target asset, then check if `asset.income.some(i => i.reference === receipt && i.recordedBy === staff / i.date === date)` — or simpler: just check `i.reference === receipt` and if found, skip.
   e. **Call `addIncome(assetId, payload)`** for each group inside `Promise.allSettled` (NOT `Promise.all`) so a single failure does not break others.
   f. **Toast results**: After all settled, if any skipped (duplicate) → toast.info `X income entries already recorded on assets`. If any rejected → toast.warning `Y asset income entries skipped`.
4. Preserve the original success toast "Sale recorded…" and `setFormOpen(false)` after.

### Local Test Requirements
- **(rule TR-1.1)**: Save a new single-line sale with Fargo asset linked → within 2s, open that asset's preview window → Finance tab → one new entry exists with `reference = receiptNumber` and `amount = lineTotal`.
- **(rule TR-1.2)**: Multi-line sale with TWO different assets linked (e.g. Fargo + Large Format) → BOTH assets get one income entry each, amounts match their respective line totals.
- **(rule TR-1.3)**: Duplicate flow check: trigger the same sale save twice programmatically or simulate retry → second call shows "already recorded" info, total income count only increased by 1 NOT 2.
- **(rule TR-1.4)**: If `addIncome` throws for 1 of 3 asset groups (e.g. 1 invalid assetId), the other 2 succeed, the toast warns, and the sale is still saved (no rollback of movements).
- **(rubric TR-1.5)**: Description richness per AC-7. Score 0–2; pass ≥1. (0: plain "Sale"; 1: item name + specs visible; 2: multiple lines joined with "; " + quantities for Fargo)

### Completion Evidence
- Screenshot of two Finance tabs after one sale: Fargo asset entry + Large Format asset entry showing correct amounts + references + descriptions.
- Console log or toasts confirming duplicate skip works correctly.

---

## Task 2: FinanceTab source badge tint + job icons + category left-border accent
**Priority**: high
**Depends on**: —
**Scope**: `d:\House\qterp\frontend\src\components\assets\AssetDetailSheet.tsx` — `FinanceTab` function (lines ~311–448, the income rows map section)

### Change summary
1. **Add helper `getSourceTint(source)`** inside FinanceTab (top of the function, hooks area, BEFORE any returns):
   ```tsx
   function getSourceMeta(source: string) {
     if (source?.toLowerCase().includes("fargo") || source?.toLowerCase().includes("badge")) {
       return {
         kind: "fargo" as const,
         badgeCls: "bg-violet-50 border-violet-200 text-violet-700",
         borderCls: "border-l-violet-400/60",
         glowShadow: "shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_4px_20px_-8px_rgba(139,92,246,0.45)]",
         Icon: CreditCard,
         iconCls: "text-violet-600",
       };
     }
     if (source?.toLowerCase().includes("large") || source?.toLowerCase().includes("format")) {
       return { kind: "large_format", badgeCls: "bg-emerald-50 border-emerald-200 text-emerald-700", borderCls: "border-l-emerald-400/60", glowShadow: "...", Icon: Ruler, iconCls: "text-emerald-600" };
     }
     if (source?.toLowerCase().includes("digital") || source?.toLowerCase().includes("print")) {
       return { kind: "digital_printer", badgeCls: "bg-blue-50 border-blue-200 text-blue-700", borderCls: "border-l-blue-400/60", glowShadow: "...", Icon: Printer, iconCls: "text-blue-600" };
     }
     return { kind: "default", badgeCls: "bg-muted/40 border-border text-muted-foreground", borderCls: "border-l-border", glowShadow: "", Icon: FileText, iconCls: "text-muted-foreground" };
   }
   ```
   Add missing imports at top of file: `import { ... CreditCard, Ruler, Printer } from "lucide-react"` (only add what's not already imported; CreditCard likely not yet).

2. **Wrap income rows in Framer Motion stagger container**. Replace the plain `<div className="divide-y divide-border/50">` with:
   ```tsx
   <motion.div
     className="divide-y divide-border/50"
     variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } } }}
     initial="hidden"
     animate="show"
   >
   ```
   And wrap each `filteredIncome.map` row in `<motion.div variants={{ hidden: { opacity:0, y:6 }, show: { opacity:1, y:0, transition: { duration: 0.32, ease: [0.22,1,0.36,1] } } }}>`. Ensure keys stay stable (`i.id`).

3. **For each income row**:
   a. Call `const meta = getSourceMeta(i.source)` at the top of the map callback.
   b. Add `border-l-[3px] ${meta.borderCls}` to the row root div (currently `relative flex items-start justify-between gap-3 px-4 py-2.5 …`). Also add `group` class.
   c. Replace the generic `FileText` icon with `<meta.Icon className={`h-3.5 w-3.5 ${meta.iconCls}`} />` at the start of the row, inside its own icon wrapper (a rounded `h-7 w-7 inline-flex items-center justify-center rounded-lg bg-muted/30 group-hover:scale-[1.08] transition-transform`).
   d. Replace the existing source Badge with:
      ```tsx
      <Badge variant="outline" className={`text-[10px] border ${meta.badgeCls} group-hover:scale-[1.03] transition-transform origin-left`}>
        {i.source || "—"}
      </Badge>
      ```
   e. **Row hover effect**: Add `hover:bg-[#003399]/[0.025] hover:-translate-y-px transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]` class AND the `group-hover:${meta.glowShadow}` on the row root (or use a conditional `className` with string interpolation / `clsx` / `cn()`).

4. **Row click → toast notification**: Add `onClick={() => toast.info(`Linked to receipt ${i.reference ? "#" + i.reference : ""} — tap Transactions tab to open`)}` to the row root, plus `cursor-pointer`.

### Local Test Requirements
- **(rule TR-2.1)**: A Fargo income row shows violet-tinted source badge, violet left-border, and CreditCard icon (not FileText).
- **(rule TR-2.2)**: A Large Format income row shows emerald tint + Ruler icon; Digital shows blue + Printer; Default shows muted grey + FileText.
- **(rule TR-2.3)**: Hovering any income row: row lifts 1px, background tints brand-blue, left-border accent gains glow shadow.
- **(rule TR-2.4)**: Rows mount with staggered fade-up (verify via DevTools animation inspector or visual slow-motion).
- **(rule TR-2.5)**: Clicking any row fires a toast mentioning receipt `#RCP-XXXXXXX`.
- **(rubric TR-2.6)**: Polish per AC-6 score 0–3; pass ≥2.

### Completion Evidence
- Screenshot of FinanceTab showing 3 rows of different sources with distinct tints + icons.
- Short video or gif of row mount stagger + hover lift/glow.

---

## Task 3: Fargo badge detail chips + micro preview card (#becreative extras)
**Priority**: high
**Depends on**: Task 2
**Scope**: Same `FinanceTab` income row rendering in `AssetDetailSheet.tsx`

### Change summary
1. **Parse Fargo badge details from description OR add a structured hint to the source string**:
   - Preferred: When building `description` in Task 1, embed structured side+lam info into `description` string in a parseable way, e.g. suffix: `[fargo:single|double,lam:true|false]` and strip it when displaying to humans OR better: make the description generation in Task 1 return BOTH `displayDescription` and `badgeHints`. Since AssetIncome only has a single `description` field, use a regex parser inside FinanceTab to extract:
     - side: look for "Double side" or "Single side" in description.
     - lamination: look for "Laminated" or ", Lam" or "No lam".
     - qty: look for `× N` pattern at end of description line (use regex `/×\s*(\d+)/`).
   - Add helper `parseFargoHints(desc: string): { side?: 'Single' | 'Double'; laminated?: boolean; qty?: number }` inside the row map; call only when `meta.kind === "fargo"`.

2. **Render Fargo side + lam chips**: After the source badge row, inside the `flex-wrap items-center gap-1.5` div:
   ```tsx
   {meta.kind === "fargo" && (
     <>
       <motion.span
         initial={{ opacity: 0, scale: 0.8 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.12 }}
         className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border border-violet-500/25 bg-violet-500/10 text-violet-800 ring-1 ring-violet-500/10"
       >
         <CreditCard className="h-3 w-3" /> {hints.side ?? "Single"} side
       </motion.span>
       <motion.span
         initial={{ opacity: 0, scale: 0.8 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.18 }}
         className={cn(
           "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ring-1",
           hints.laminated
             ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 ring-emerald-500/10"
             : "border-slate-500/20 bg-slate-500/5 text-slate-600 ring-slate-500/10"
         )}
       >
         {hints.laminated ? <CheckCircle2 className="h-3 w-3" /> : <CircleIcon className="h-3 w-3 opacity-50" />}
         {hints.laminated ? "Laminated" : "No lamination"}
       </motion.span>
       {hints.qty && hints.qty > 0 && (
         <Badge variant="outline" className="text-[10px] font-mono border-violet-300 bg-white/60 text-violet-700">
           ×{hints.qty} badges
         </Badge>
       )}
     </>
   )}
   ```
   Import `CheckCircle2` if not already imported. Add `CircleIcon` = simple circle or use `Circle` from lucide. Add `motion` import at top — already imported per existing file.

3. **Micro Fargo badge-preview decoration**: At the END of the row (right side, next to the amount on the left column? NO — add as a fixed decoration between description block and amount OR as part of the left-side info section). Put it inline at the END of the `flex-wrap items-center gap-1.5` row that holds source badge + side/lam chips:
   ```tsx
   {meta.kind === "fargo" && (
     <motion.div
       initial={{ opacity: 0, rotate: -4 }}
       animate={{ opacity: 1, rotate: 0 }}
       transition={{ delay: 0.24, type: "spring", stiffness: 400, damping: 20 }}
       className="ml-auto relative ml-1 inline-flex"
       title="Badge job"
     >
       <div className="h-[20px] w-[32px] rounded-[4px] border border-violet-400/40 bg-[linear-gradient(135deg,#ede9fe_0%,#ffffff_50%,#ddd6fe_100%)] shadow-[0_1px_2px_rgba(139,92,246,0.2)]">
         <div className="absolute left-[4px] top-[6px] h-[4px] w-[4px] rounded-full bg-violet-400/70" />
         <div className="absolute left-[10px] top-[6px] h-[3px] w-[14px] rounded-full bg-violet-300/70" />
         <div className="absolute left-[10px] top-[11px] h-[2px] w-[10px] rounded-full bg-violet-300/50" />
       </div>
     </motion.div>
   )}
   ```

4. **Also strip any parse-tags from description display**: If you used the `[fargo:...]` suffix approach in the description, remove that tag substring from the rendered description text using `.replace(/\[fargo:[^\]]*\]\s*$/, "")`.

### Local Test Requirements
- **(rule TR-3.1)**: A Fargo income row renders ≥2 extra chips (side mode + lam status) with correct violet/emerald/muted tints.
- **(rule TR-3.2)**: A badge ×N quantity chip shows if the description contains "× N".
- **(rule TR-3.3)**: The micro 32×20 decorative badge card appears on Fargo rows with gradient + simulated chip/holes.
- **(rule TR-3.4)**: Non-Fargo rows (large format / digital / default) do NOT render any Fargo chips or the micro badge card.
- **(rubric TR-3.5)**: Fargo polish creativity per AC-6 score 0–3; pass ≥2. (0: No chips; 1: chips present but static; 2: chips have staggered pop-in spring, micro card rotates in; 3: spring + colour-accurate tints + quantity chip all visible and readable.)

### Completion Evidence
- Close-up screenshot of a Fargo income row showing side chip + lam chip + qty chip + micro badge card.
- Screenshot of a non-Fargo row showing NO Fargo-specific extras (negative evidence).

---

## Task 4: AssetDetailSheet header KPI + header badge for "sales linked" signal
**Priority**: medium
**Depends on**: —
**Scope**: `d:\House\qterp\frontend\src\components\assets\AssetDetailSheet.tsx` — `Body` function (lines ~48–136, KPI strip + header area)

### Change summary
1. **Compute derived sale counts inside Body (before early returns, hook-safe area)**:
   ```tsx
   const saleLinkedIncomeCount = useMemo(() =>
     (asset.income ?? []).filter(i => i.reference && (i.source || "").length > 0).length
   , [asset.income]);
   ```
   Add import for `Receipt` icon from lucide if not already present.

2. **5th KPI card in top strip** (currently 4 cols → change grid from `grid-cols-2 md:grid-cols-4` to `grid-cols-2 md:grid-cols-5`, or just add a 5th col — col-span-1 on md). The new card:
   ```tsx
   <KPI
     icon={Receipt}
     label="Sales linked"
     value={`${saleLinkedIncomeCount} entr${saleLinkedIncomeCount === 1 ? "y" : "ies"}`}
     sub={saleLinkedIncomeCount > 0
       ? `${fmtKES(thisMonthIncomeFromSales)} from sales this mo`
       : "Link assets in sales to auto-populate"}
     tone={saleLinkedIncomeCount > 0 ? "ok" : undefined}
   />
   ```
   Where `thisMonthIncomeFromSales` is the sum of income this month with a reference (sale-linked):
   ```tsx
   const thisMonthIncomeFromSales = useMemo(() => {
     const m = thisMonthKey;
     return (asset.income ?? []).reduce((s, i) =>
       i.date.startsWith(m) && i.reference ? s + Number(i.amount ?? 0) : s, 0
     );
   }, [asset.income, thisMonthKey]);
   ```

3. **Header badge row addition**: In the `SheetHeader` → `div` currently containing: `Category Badge · Staff Badge · StatusChip`. Append:
   ```tsx
   {saleLinkedIncomeCount > 0 && (
     <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 gap-1">
       <Receipt className="h-3 w-3" /> {saleLinkedIncomeCount} sale{saleLinkedIncomeCount !== 1 ? "s" : ""} linked
     </Badge>
   )}
   ```

4. **Update the existing 4th KPI (monthly income)**: The `thisMonthTarget` vs `thisMonthIncome` calc — ensure `thisMonthIncome` (used in KPI 4) actually includes the sale-linked entries (it should since it sums all income; verify the formula is already correct and just confirms after task 1 works).

### Local Test Requirements
- **(rule TR-4.1)**: An asset with ≥1 sale-linked income entry shows a 5-column KPI strip (or 5th KPI visible on md+ screens) labelled "Sales linked" with count > 0.
- **(rule TR-4.2)**: Same asset's header badge row shows "N sales linked" emerald badge.
- **(rule TR-4.3)**: An asset with 0 sale-linked income entries shows the "Sales linked" KPI as "0 entries" and no header badge. Subtitle reads "Link assets in sales to auto-populate".
- **(rubric TR-4.4)**: At-a-glance audit clarity per AC-7. Score 0–2; pass ≥1. (0: no KPIs indicate sales link; 1: new KPI visible + count; 2: KPI + header badge + this-month-sales sub label all visible.)

### Completion Evidence
- Before/after screenshots: asset with 0 sales (old state) vs asset after 1 synced sale (new 5th KPI + header badge).

---

## Task 5: Helper refactor (description builder) + hook safety + diagnostics run
**Priority**: medium
**Depends on**: Tasks 1, 2, 3, 4
**Scope**: `d:\House\qterp\frontend\src\types\inventory.ts` (helpers) + `GetDiagnostics` run across touched files.

### Change summary
1. **Add helper `buildSaleIncomeDescription(kind, lines, customer?)`** in `types/inventory.ts` near `formatAssetSaleSpec`:
   - Takes: kind (AssetCategoryKind), lines (SaleItem[]), optional customer.
   - Returns a single description string matching the format specified in FR-2.
   - This consolidates the logic so Task 1's inline switch statement in app.movements.tsx → just calls this helper and passes the result.
2. **Also add helper `mapKindToIncomeSource(kind)`** returning the 4 source strings.
3. **In `app.movements.tsx`**: Replace the inline building with imports of the two new helpers.
4. **Hook safety audit**:
   - In `app.movements.tsx`: confirm `useAssetsStore()` call happens BEFORE any early returns (the page has no early return currently, only the `store.ready` guard in AssetsPage — that's fine).
   - In `AssetDetailSheet.tsx`: confirm all new useMemo/useState hooks in FinanceTab / Body are above the `if (!asset) return null` guard line 38 (the sheet guard).
   - Specifically, the new `thisMonthIncomeFromSales`, `saleLinkedIncomeCount` in `Body` must be declared BEFORE line 70 (`return <>` NOT before an `if (!asset)` early return — since Body component is only called with asset present via the sheet guard; double check).
5. **Run diagnostics**: Call `GetDiagnostics` on both files; if any TS/ESLint errors, fix them before marking complete.

### Local Test Requirements
- **(rule TR-5.1)**: `GetDiagnostics` run → 0 errors on `app.movements.tsx`.
- **(rule TR-5.2)**: `GetDiagnostics` run → 0 errors on `AssetDetailSheet.tsx`.
- **(rule TR-5.3)**: Manual runtime check: Rapidly toggle AssetDetailSheet open/closed 10 times → no "Rendered more hooks than previous render" error in browser console. Toggle Finance tab while opening → same.
- **(rule TR-5.4)**: Sale with Fargo 50 badges Double side + Laminated saved → FinanceTab description reads a correct string (via the new helper) like "Staff ID badges — Double side, Laminated × 50"; parse in Task 3 correctly extracts side=Double, lam=true, qty=50.

### Completion Evidence
- GetDiagnostics screenshot with 0 errors on both touched files.
- Console clean (no React hooks errors) during 10 open/close cycles of the asset preview sheet.

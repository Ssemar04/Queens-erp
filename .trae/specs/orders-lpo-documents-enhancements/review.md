# Review — Orders / LPO / Documents Enhancements

**Spec**: `orders-lpo-documents-enhancements/spec.md`
**Reviewed artifact**: `d:\House\qterp\frontend\src\routes\app.orders.tsx`
**Review type**: Independent code + static DOM verification (all 7 ACs)
**Overall result**: ✅ **pass** (all 5 rule ACs pass, both rubric ACs score ≥ threshold)

---

## Rule Acceptance Criteria (binary pass/fail)

### AC-1 Tab order
**Result**: ✅ **PASS**
**Evidence**:
- Literal tuple in the `.map` at [app.orders.tsx#L425](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L425-L450): `(["documents", "lpo", "orders"] as const)` — produces 3 `<button>` children in exact order: Documents, LPO, Orders.
- Animated slider `layoutId="orders-tab-slider"` (L440) with spring `stiffness: 500 / damping: 40`.
- Default state at [app.orders.tsx#L119](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L119-L119): `useState<...>("documents")` — slider lands on Documents on fresh mount.
- Count labels reactive per tab: Documents uses `documents.length`, LPO uses `orders.length`, Orders uses `filtered.length` (L428–430).

### AC-2 LPO workspace structure
**Result**: ✅ **PASS**
**Evidence**:
- (1) **Intro hero card** — LpoWorkspace return: [app.orders.tsx#L903](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L903-L941): FolderKanban icon chip, eyebrow "LPO submission history", headline + description, right-side CTA `Jump to Documents →` button that invokes `onSwitchToDocuments`.
- (2) **4 KPI tiles** — [app.orders.tsx#L943](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L943-L1006): Framer Motion stagger parent (staggerChildren 0.06s) with 4 motion.div cards:
  - Total LPOs submitted (brand/[#003399]) = `orders.length`
  - Open pipeline (amber) = filter on `["draft","confirmed","in_progress"]` (valid statuses; non-existent "pending"/"acknowledged" removed)
  - Delivered (emerald) = `status === "delivered"`
  - Overdue delivery (rose) = `dateToBeDelivered < today AND status not in {delivered, cancelled}`
  - Each card has a top-right gradient blur accent orb (L970–972) + icon chip `group-hover:scale-[1.08]` flip (L989).
- (3) **Filter bar (3 controls)** — [app.orders.tsx#L1008](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1008-L1045): Search `<Input>` (L1012–1019), status `<Select>` with All + 5 OrderStatuses (L1020–1033), sort `<Select>` with Newest/Oldest/Value/Overdue (L1034–1044).
- (4) **8-column history rows** — [app.orders.tsx#L1053](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1053-L1062) defines the 8-cell header grid: `grid-cols-[20px_1.4fr_0.9fr_0.9fr_0.7fr_0.8fr_0.9fr_40px]`. Same template applied to each motion.div data row (L1090–1093). Columns: 1=Grip, 2=LPO(#+age+items), 3=Customer(+amount), 4=Handled-by, 5=Status tint+icon badge, 6=Dates 3-line panel (issued/due/relative with rose/emerald tint), 7=Compliance Proc N/7+Co. N/3 + score% tint + gradient progress bar (motion width 900ms), 8=Eye action button.
- Extra: full row clickable (cursor-pointer, onClick=onPreview), Eye button stopPropagation, overdue/delivered rows get 3px left-stripe + soft background tint (L1097–1099).

### AC-3 Documents two-category split
**Result**: ✅ **PASS**
**Evidence**:
- Filtered lists (useMemo) at [app.orders.tsx#L1352](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1352-L1369): `companyDocs = 3 items` (TCC URA, Business Registration, Insurance Transit), `procurementDocs = 7 items` (LPO signed, Quotation, Invoice, Delivery, Waybill, Inspection, Payment Receipt).
- Per-category counts: `uploadedComp/totalComp = 3`, `uploadedProc/totalProc = 7` (L1356–1367).
- **Company section header** render at [app.orders.tsx#L1800](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1800-L1802): `<DocumentSectionHeader category="company" uploaded={uploadedComp} total={totalComp}/>`. This inner component (L1380–1467) renders Building2 icon chip, "Company Documents" title, "Supplier compliance — upload once" subtitle, long description paragraph, right-side mini compliance chip with motion count-up % + dual-segment gradient progress bar (sky → indigo), role="region" aria-labelledby.
- **Procurement section header** render at [app.orders.tsx#L1813](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1813-L1815): `<DocumentSectionHeader category="procurement" uploaded={uploadedProc} total={totalProc}/>`. Uses ClipboardList icon, "Procurement Documents" title, "Transactional (per-LPO)" subtitle, emerald → [#003399] gradient progress bar.
- Section order: Company rendered FIRST (L1799–L1810), then Procurement BELOW (L1812–L1824). No leakage — each section `.map()`s only its category list.

### AC-4 Documents list layout
**Result**: ✅ **PASS**
**Evidence**:
- Inner `DocumentRow` component at [app.orders.tsx#L1469](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L1469-L1680): 5-cell CSS grid `grid-cols-[64px_minmax(0,1fr)_110px_minmax(0,1.1fr)_auto]`.
  1. **Category 3px left-border accent**: `border-l-[3px] border-l-sky-500/70` (company) or `border-l-emerald-500/70` (procurement) at L1479–L1485.
  2. **Icon cell** (~64px): rounded chip containing per-doc icon, category-tinted ring/bg; `group-hover:scale-[1.08]` transition (L1496–L1502).
  3. **Title + description cell** (1fr): title 13px semibold + description 11px muted line-clamp-2 (L1504–L1516).
  4. **Status chip cell** (~110px): Uploaded → emerald badge + CheckCircle2; Missing → rose badge + Clock4 (L1518–L1535).
  5. **File meta cell** (1.1fr): If uploaded: filename + Paperclip icon + size; uploader initials + name + date (two stacked rows, 10.5px muted) (L1537–L1570).
  6. **Actions cell** (auto): Always-visible `inline-flex gap-1` buttons; Preview (eye, brand outline) + Download (down-arrow, emerald outline) for all; Replace (upload, dashed brand) + Delete (trash, rose outline + loading spinner) if canManageDocs; Upload CTA if missing + canManageDocs; "Awaiting upload · managers only" pill if missing + staff (L1572–L1671).
- Hover micro-interactions (at L1487): `group-hover:bg-[#003399]/[0.025]` + `group-hover:shadow-[inset_3px_0_0_rgba(...,0.95)]` left-border glow, icon chip scale-1.08, transition 200ms cubic-bezier.
- Category containers wrap the rows in a `rounded-2xl border bg-white shadow-sm overflow-hidden divide-y` wrapper with Framer Motion `staggerChildren: 0.04 / 0.08` variants, so rows fade+translateY(4) sequentially.

### AC-5 Staff role visibility
**Result**: ✅ **PASS**
**Evidence**:
- Role guard defined at DocumentsWorkspace level: `const canManageDocs = isAdmin || isManager;` (exact pattern preserved from prior; used consistently in DocumentRow L1471, L1577, L1589, L1607, L1640).
- DocumentRow always-visible buttons branch logic (L1572–L1671):
  - **UPLOADED + any role**: Preview (always, L1578) + Download (always, L1585) → buttons rendered unconditionally from the uploaded block's first two children, no role gate.
  - **UPLOADED + canManageDocs=true ONLY**: Replace (L1589, guard wrap) + Delete (L1607, `{canManageDocs && <Button...>}`). Staff: these two components NOT rendered → zero manage buttons.
  - **MISSING + canManageDocs=true**: Upload CTA (L1640, gated).
  - **MISSING + canManageDocs=false**: Disabled "Awaiting upload · managers only" pill (L1657, rendered in the else branch at L1654).
- By construction, Staff (canManageDocs=false) sees: Preview+Download only on uploaded docs; a read-only pill on missing docs. Zero Upload/Replace/Delete buttons anywhere.

---

## Rubric Acceptance Criteria (scored 0–3, threshold ≥2)

### AC-6 Visual polish & micro-interactions
**Score**: 3/3 (pass, threshold ≥2)
**Rationale + evidence**:
- Level-2 baseline all present:
  - ✅ Staggered entry on section children: LPO KPIs (parent variants staggerChildren 0.06 + per-card variants initial y:8 → animate y:0); LPO history rows (delay idx*40ms max 80); Documents category rows (variants staggerChildren 0.04 company / 0.08 procurement with per-row initial y:6).
  - ✅ Hover icon lift (scale-[1.08]) + tinted background: DocumentRow L1496 `group-hover:scale-[1.08]`; LPO KPI icon chip L989; LPO rows L1094 `hover:bg-[#003399]/[0.025]`; Documents list row L1487 `group-hover:bg-[#003399]/[0.025]`.
  - ✅ Progress bar width animate: LPO compliance progress bar motion width transition 900ms + dual-tone from→to colors; DocumentSectionHeader gradient progress bar with dual-segment segments (sky→indigo / emerald→[#003399]) + motion width.
  - ✅ Tab pill slides smoothly: `layoutId="orders-tab-slider"` with spring stiffness:500/damping:40 (L440–L442).
  - ✅ Buttons active-scale: LPO Eye button `active:scale-[0.96]`; Orders table Eye/Trash buttons use Button component with hover:shadow transitions; document action buttons size="sm" with standard button active feel.
- Level-3 #becreative extras present, earning full 3/3:
  - ✅ Soft gradient section header accent orbs: DocumentSectionHeader right-top corner blur-2xl gradient-orbs, tone-matched per category (sky/indigo for company, emerald for procurement) at L1400–L1403.
  - ✅ Category-tinted glow on row hover: DocumentRow `group-hover:shadow-[inset_3px_0_0_rgba(... 0.95)]` + outer shadow combo at L1489–L1491.
  - ✅ Mini count-up feel on compliance %: DocumentSectionHeader compliance chip uses motion.div `key={percentage}` initial opacity/y then animate (triggers motion re-mount with transition for count feel) at L1432–L1436.
  - ✅ KPI tiles with gradient blur accent orbs: 4 tone-specific gradient-br orbs (brand→sky, emerald→teal, amber→orange, rose→pink) absolute-right-top blur-2xl opacity-40 → hover opacity-75 at L970–L972.
  - ✅ Compliance progress dual-tone gradient segments: not flat colour; `bg-gradient-to-r from-emerald-500 via-emerald-400 to-[#003399]` (procurement, L1458–L1461) / `from-sky-500 via-indigo-500 to-[#003399]` (company, L1451–L1454).

### AC-7 LPO audit clarity
**Score**: 3/3 (pass, threshold ≥2)
**Rationale + evidence**:
- Level-2 baseline all present:
  - ✅ All 8 columns readable: header grid at L1053 + data rows L1090 use same 8-cell template. Each column properly sized (LPO col=1.4fr for priority, Dates=0.8fr, Compliance=0.9fr, Handle/Eye=fixed small).
  - ✅ Status tints match icons: STATUS_META[s].cls (rose, amber, sky, emerald, gray) each paired with its icon inside the badge (XCircle / AlertTriangle / Clock / CheckCircle2 / CircleSlash) → never colour-only, always icon+tint combination.
  - ✅ Compliance bar colour scale correct: `complianceScore >= 80 → emerald`, `>= 40 → amber`, `< 40 → rose` (calc + ternary at L1195–L1200); gradient progress bar width = min(100, score)% via motion width.
  - ✅ Age badge readable + due countdown readable: age badge L1113–L1121 = "Today" emerald if same day, else "Nd ago" muted; dates 3-line panel L1142–L1170 = Issued MM-DD + Due MM-DD (rose if overdue, emerald if delivered) + relative line ("Delivered" emerald / "Nd overdue" rose / "Due today" amber / "Nd left" muted).
  - ✅ Row click opens preview + Eye stopPropagation: row onClick=onPreview (L1103), Eye button onClick first line is `e.stopPropagation()` then same preview set (L1284–L1287).
- Level-3 extras present, earning full 3/3:
  - ✅ Overdue rows soft rose left-stripe: `shadow-[inset_3px_0_0_rgba(244,63,94,0.55)]` + soft bg rose tint (leftStripe var + bg-rose-500/[0.025] at L1098–L1099).
  - ✅ Delivered rows emerald tick stripe: `shadow-[inset_3px_0_0_rgba(16,185,129,0.6)]` + soft bg emerald tint (L1097–L1100).
  - ✅ LPO numbers mono + stable hover feel: L1108 `font-mono tracking-tight`; row hover does `scale-[1.02]`-equivalent via shadow ring only (no jitter; keeps layout stable as per NFR-3 memoization).
  - ✅ Empty state illustration-style: EmptyState component with FolderKanban icon at L1063–L1066, friendly copy, description, CTA button to clear filters / create order (via formOpen).
  - ✅ Per-row Framer Motion staggered entry with stagger cap at 80 rows (avoid NFR-3 jank): `transition={{ delay: Math.max(0, Math.min(idx, 80)) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}` (L1094–L1096).

---

## Summary

| AC | Type | Result / Score | Threshold | Pass? |
|---|---|---|---|---|
| AC-1 Tab order | rule | PASS | — | ✅ |
| AC-2 LPO structure | rule | PASS | — | ✅ |
| AC-3 Two-category split | rule | PASS | — | ✅ |
| AC-4 Documents list layout | rule | PASS | — | ✅ |
| AC-5 Staff role visibility | rule | PASS | — | ✅ |
| AC-6 Visual polish | rubric | 3/3 | ≥2 | ✅ |
| AC-7 LPO audit clarity | rubric | 3/3 | ≥2 | ✅ |

**Tech hygiene verified** (cross-cutting Task 5 evidence):
- `GetDiagnostics` on app.orders.tsx: **0 diagnostics** (rules, hints, warnings, errors all empty).
- `tsc --noEmit` full project run via `tsc.cmd`: **exit code 0, no type errors**.
- Project-memory regressions all static-verified:
  - Particulars line-item priority > narrative: preview dialog at [app.orders.tsx#L2588](file:///d:/House/qterp/frontend/src/routes/app.orders.tsx#L2588-L2607) renders line-items table first; only when empty does it show quotation narrative (customerQuotation dashed-box).
  - Orders-table action buttons persistently visible (not hover-hidden): Eye at L656–L664 has bg ring tint + brand accent always-on; Trash L666–L674 same; no `group-hover:opacity` patterns on either.
  - Handled-by = exactly ONE staff name: avatar chip + truncated name, single Select with single-value (no array), selectable from exactly one employee per dropdown trigger at L594–L629.
  - Document upload/delete locked: `canManageDocs = isAdmin || isManager` gate on ALL Upload/Replace/Delete buttons; staff = read-only preview/download only.
  - Branch-change refresh preserved (existing useEffect for currentBranch not modified; Orders page existing `key` on data containers re-mounts on branch switch; admin-only branch change guard in header unchanged).

**Final gate result**: All Rule ACs = PASS, both Rubric ACs score 3/3 ≥ 2/3 threshold → **OVERALL PASS**. No remediation tasks required.

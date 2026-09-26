# Implementation Tasks — Orders / LPO / Documents Enhancements

## Task 1: Tab ordering, default tab &amp; count label audit (plus duplicate-render bug fix)
**Priority**: high
**Depends on**: —
**Scope**: `d:\House\qterp\frontend\src\routes\app.orders.tsx` (lines ~119–122 state init, ~426–451 tab bar, ~454–464 first DocumentsWorkspace render, ~688–698 duplicate DocumentsWorkspace render)

### Change summary
1. Confirm `activeTab` initial state is `"documents"` (as the default tab).
2. In the tab bar map at ~line 426, confirm the literal tuple order is `(["documents", "lpo", "orders"] as const)`.
3. Count labels:
   - Documents label: `Documents ${documents.length ? `(${documents.length})` : ""}`
   - LPO label: `LPO ${orders.length ? `(${orders.length})` : ""}` (include total count of LPOs)
   - Orders label: `Orders ${filtered.length ? `(${filtered.length})` : ""}`
4. **Fix duplicate render bug**: The current code renders `DocumentsWorkspace` TWICE — once at lines ~454–464 inside `activeTab === "documents"` and AGAIN at lines ~688–698 after the `orders` block. DELETE the second (duplicate) block (lines ~688–698 or its equivalent).
5. Verify the animated slider pill `layoutId="orders-tab-slider"` is present and uses spring `stiffness:500/damping:40`.

### Local Test Requirements
- **(rule TR-1.1)**: Tab DOM order in DevTools is exactly `[Documents button, LPO button, Orders button]` in that order.
- **(rule TR-1.2)**: Only ONE `<DocumentsWorkspace>` mount exists on screen at any time (no duplication).
- **(rule TR-1.3)**: Default `activeTab` on page fresh load is `documents` (slider is over "Documents").
- **(rubric TR-1.4)**: Count labels update reactively when orders/documents/filtered change. Score 0–2; pass ≥1. (0: no counts; 1: counts but stale; 2: counts live/reactive)

### Completion Evidence
- Screenshot or inspected DOM confirming tab order and single DocumentsWorkspace render.
- Live refresh confirming default = Documents.

---

## Task 2: LPO History Workspace — polish to spec with 8-column list
**Priority**: high
**Depends on**: Task 1
**Scope**: `d:\House\qterp\frontend\src\routes\app.orders.tsx` — `LpoWorkspace` function (current ~lines 846–1195). Rewrite to new 8-column list spec with intro+KPIs+filters+history.

### Change summary
1. **Intro hero card** (already partial): ensure it includes a `FolderKanban` icon + "LPO submission history" eyebrow label + headline + description, plus a right-side CTA button "Jump to Documents →" that calls `onSwitchToDocuments`.
2. **4 KPI chips** (grid 2/4 cols):
   - Total LPOs submitted (brand tone) — count = `orders.length`.
   - Open pipeline (amber tone) — statuses: `draft + confirmed + in_progress` (NOTE: replace "Awaiting processing" wording because those statuses don't exist in `OrderStatus` type; re-label to "Open pipeline").
   - Delivered (emerald tone) — status = `delivered`.
   - Overdue delivery (rose tone) — open statuses AND `dateToBeDelivered < today`.
   - Style KPIs with gradient blur accent orbs in top-right corner per tone (#becreative extra).
3. **Filter bar** (already exists): confirm 3 controls — search, status select, sort select.
4. **History list — 8 COLUMN grid** (critical rewrite): replace current grid with these exact columns; use a CSS grid template like `grid-cols-[20px_1.4fr_0.9fr_0.9fr_0.7fr_0.8fr_0.9fr_40px]` or similar:
   | # | Column | Contents |
   |---|---|---|
   | 1 | Grip handle | `GripVertical` icon, muted, non-interactive |
   | 2 | LPO | mono LPO number + age badge ("Today"/"Nd ago") + 2nd line items summary (N items · particulars synced) OR (quote reference) |
   | 3 | Customer | name (semibold) + amount (UGX formatted, muted 2nd line) |
   | 4 | Handled by | avatar initials chip (ring-primary/15) + name truncate |
   | 5 | Status | `Badge` using `STATUS_META[status].cls` + matching icon inside |
   | 6 | Dates | two stacked rows (Issued: MM-DD / Due: MM-DD with tint red overdue / green delivered) + relative text on 3rd line using Calendar icon |
   | 7 | Compliance | Proc N/7 + Co. N/3 sub-labels, score % in emerald/amber/rose tint, + gradient progress bar |
   | 8 | Eye action | Persistent (not hover-only) `Eye` button with ring/tint styling per project_memory; `stopPropagation` on click |
5. **Row interactions**:
   - Full row `cursor-pointer` → onClick = `onPreview(o)`.
   - Row hover = `shadow-[inset_3px_0_0_rgba(0,51,153,0.5)]` + soft card shadow per project_memory.
   - Overdue rows: extra soft rose `bg-rose-500/[0.025]` tint or left-stripe.
   - Delivered rows: extra soft emerald tick hint (or emerald left-stripe).
6. **Staggered row entry**: `style={{ animation: cardFadeInUp 520ms … idx * 40ms }}` or Framer Motion staggerChildren 0.04s.
7. **Empty state** with `FolderKanban` icon when `sortedFiltered.length === 0` (already there, verify).

### Local Test Requirements
- **(rule TR-2.1)**: All 8 columns visually present per row (screenshot evidence), including compliance bar + age badge.
- **(rule TR-2.2)**: "Open pipeline" KPI label uses valid statuses (draft+confirmed+in_progress) — no reference to non-existent "pending"/"acknowledged" statuses.
- **(rule TR-2.3)**: Clicking anywhere on a row (except the eye button) triggers `onPreview`; clicking the eye button also triggers preview without double-firing (stopPropagation works).
- **(rule TR-2.4)**: Overdue rows show the due-date in rose tint + relative text reads "Nd overdue"; delivered rows show due-date in emerald tint + relative text reads "Delivered".
- **(rubric TR-2.5)**: LPO audit clarity per AC-7. Score 0–3; pass ≥2.
- **(rubric TR-2.6)**: Row hover micro-interactions (inset stripe + overdue/delivered tint stripes). Score 0–2; pass ≥1.

### Completion Evidence
- Screenshot of the LPO workspace with at least 3 rows visible, showing all 8 columns, overdue vs delivered tint, compliance progress.
- Demo click on row → preview opens.

---

## Task 3: Documents Workspace — split into Company / Procurement category sections
**Priority**: high
**Depends on**: Task 1
**Scope**: `d:\House\qterp\frontend\src\routes\app.orders.tsx` — `DocumentsWorkspace` function (current ~lines 1235–1609) + `DOCUMENT_CATALOG` + `DOCUMENT_CATEGORY_META` (already at lines 811–844).

### Change summary
1. **Keep** the existing picker card (LPO selector + selected-LPO summary) at the top.
2. **Keep** the aggregate compliance progress card below picker (uploaded/remaining/% stats).
3. **Add a section header / hero row FOR EACH CATEGORY** before rendering the document list for that category:
   - Use `DOCUMENT_CATEGORY_META[category]` data.
   - Layout: left side = icon chip (Building2 / ClipboardList) + eyebrow label `category.label` + sub-chip `category.chip` + long description paragraph.
   - Right side = mini compliance chip: `uploaded/total` + tiny percentage + small gradient progress bar (2px tall).
   - Wrap in a soft gradient backdrop: `bg-gradient-to-br … category.accent` + `ring-1`.
4. **Filter DOCUMENT_CATALOG into two lists**:
   ```
   companyDocs = DOCUMENT_CATALOG.filter(d => d.category === 'company')   // 3 items
   procurementDocs = DOCUMENT_CATALOG.filter(d => d.category === 'procurement') // 7 items
   ```
5. Render Company Section Header, then the Company docs list (Task 4), then Procurement Section Header, then the Procurement docs list (Task 4).
6. Calculate &amp; pass per-category counts:
   - Company: `uploadedComp = companyDocs.filter(spec => orderDocs.has(spec.type)).length`, `totalComp = companyDocs.length`.
   - Procurement: `uploadedProc = procurementDocs.filter(spec => orderDocs.has(spec.type)).length`, `totalProc = procurementDocs.length`.
7. Ensure the "No LPO selected" EmptyState still shows when `!selected` BEFORE rendering any category sections.

### Local Test Requirements
- **(rule TR-3.1)**: With an LPO selected, two section headers render in order: "Company Documents" (top) then "Procurement Documents" (below).
- **(rule TR-3.2)**: Company section header shows `x/3 uploaded` + progress; Procurement shows `x/7 uploaded` + progress; both match actual count of that category.
- **(rule TR-3.3)**: Company section ONLY lists the 3 company-type docs; Procurement ONLY lists the 7 procurement-type docs — NO leakage across sections.
- **(rubric TR-3.4)**: Category section visual differentiation (colour accents, gradient backdrops). Score 0–2; pass ≥1.

### Completion Evidence
- Screenshot of Documents workspace with LPO selected → both category section headers visible with counts + progress.

---

## Task 4: Documents Workspace — replace card grid with COMPACT LIST (row per doc) layout
**Priority**: high
**Depends on**: Task 3
**Scope**: Inside `DocumentsWorkspace`, replace the current `grid md:grid-cols-2 xl:grid-cols-3` card grid with TWO list layouts (one per category), each containing horizontal list rows as per FR-4.

### Change summary
For EACH category section, after the section header, render a vertical list of rows — one row per document spec in that category's list. Each row has:

1. **Left border accent (3px)**: sky-blue for company → `shadow-[inset_3px_0_0_rgba(56,189,248,0.7)]`; emerald for procurement → `shadow-[inset_3px_0_0_rgba(16,185,129,0.7)]`. Alternative: `border-l-[3px] border-l-sky-500/70` / `border-l-emerald-500/70`.
2. **Row layout**: CSS grid with columns: `[60px_1fr_110px_1.2fr_260px]` or use flex with gap. Suggested cells:
   | Column | Width | Contents |
   |---|---|---|
   | Icon cell | fixed ~56-64px | category-tinted rounded chip (ring + bg) containing the per-doc icon; `group-hover:scale-[1.08]` transition |
   | Title + desc | flexible ~1fr | document `title` (13px semibold) + `description` (11px muted, line-clamp-2) stacked vertically |
   | Status chip | ~100-110px | emerald Badge w/ CheckCircle2 ("Uploaded") OR rose Badge w/ Clock ("Missing") |
   | File meta (conditional) | ~1.2fr | If uploaded: top row = filename (truncate + Paperclip icon + file size); bottom row = uploader name + date (muted, 10.5px). If missing: this cell shows "—" or is empty. |
   | Actions cell | fixed ~250-270px | Always-visible button group (no hover hiding) |
3. **Actions cell — always-visible persistent buttons** (per project_memory rules):
   - **If UPLOADED**:
     - Left → right (always shown):
       1. Preview (eye icon + label, `variant="outline"`, brand tint ring + bg-brand-50/40)
       2. Download (download icon + label, `variant="outline"`, emerald tint)
       3. IF `canManageDocs`: Replace (upload icon + label, dashed border, brand tint) — the label `<input type=file>` is inside this.
       4. IF `canManageDocs`: Delete (trash icon + label, `variant="outline"`, rose tint, with loading spinner while deleting)
       - Buttons: `size="sm"`, `className="h-8 gap-1 text-xs"`.
     - **If MISSING + canManageDocs**:
       1. Single "Upload document" CTA button — brand tint, outline dashed, upload icon inside, wraps the hidden file input.
     - **If MISSING + staff read-only**:
       1. Single disabled pill "Awaiting upload · Managers only" — muted bg, italic, no cursor.
4. **Row hover micro-interactions**:
   - Background tint shift to `bg-[#003399]/[0.025]`.
   - Icon chip scales to 1.08.
   - Left border accent colour increases opacity or adds glow shadow.
   - Smooth transition 200ms, ease `[0.22,1,0.36,1]`.
5. **Staggered entry**: wrap the two category lists in Framer Motion parent with `variants staggerChildren: 0.04, delayChildren: 0.05`; each list row has `variants initial: {opacity:0, y:6}, animate: {opacity:1, y:0}`.
6. **Existing behaviours preserved**:
   - `handleUploadFile` called from file `<input>` onChange — keep the same flow, file size validation, dataUrl read, toast, refresh.
   - `handleDelete` flow with `deletingId` spinner.
   - `previewDataUrl` and `downloadDataUrl` helpers unchanged.
   - Role gating: `canManageDocs` continues to gate Upload / Replace / Delete.

### Local Test Requirements
- **(rule TR-4.1)**: All 10 document specs render as list rows (3 company + 7 procurement), each row has a 3px category-coloured left border.
- **(rule TR-4.2)**: Action buttons on document rows are ALWAYS VISIBLE — not hidden on hover.
- **(rule TR-4.3)**: Staff user (canManageDocs=false) sees ZERO Upload / Replace / Delete buttons anywhere; missing docs show read-only "Awaiting upload" pill.
- **(rule TR-4.4)**: Manager/admin user (canManageDocs=true) sees Upload/Replace/Delete buttons wired to existing flows without console errors.
- **(rule TR-4.5)**: Click Preview → opens preview in new tab / iframe (calls `previewDataUrl`); Click Download → triggers download; file types PDF/image correctly open inline vs fallback download.
- **(rubric TR-4.6)**: Document list visual polish & micro-interactions per AC-6. Score 0–3; pass ≥2.

### Completion Evidence
- Screenshot of documents list layout (not cards) showing 2 sections, rows with all 5 cells (icon, title/desc, status, meta, actions).
- Screenshot of a staff-user view showing no upload/delete buttons + "Awaiting upload" pill for missing.
- Console clean (no errors) after upload / replace / delete cycle (for manager role).

---

## Task 5: Overall cross-cutting polish, entry animations, and regression checks
**Priority**: medium
**Depends on**: Tasks 2, 3, 4
**Scope**: Full file + role/hook wiring validation.

### Change summary
1. **Verify ALL animations**:
   - Hero section fade-up, KPI stagger, tab slider spring.
   - Documents workspace category section fade + row stagger.
   - LPO workspace intro → KPI → filters → history stagger.
2. **Type-check** the full module (`getDiagnostics` / `tsc --noEmit`).
3. **Regression-check**:
   - OrderPreviewDialog still opens from BOTH the LPO tab list AND the Orders table row click.
   - Particulars in preview still prefer line-items over quotation narrative.
   - Order table action buttons remain persistently visible (not hover-gated).
   - Branch context change refreshes the orders correctly (existing listener at ~line 168).
4. **Duplicate workspace render** confirmed removed (no double DocumentsWorkspace).
5. #becreative extras: add a soft gradient-blur accent orb behind each category header, tiny number count-up feel on compliance percentage badge, or KPI tiles with per-tone gradient blur accent orbs.

### Local Test Requirements
- **(rule TR-5.1)**: No TypeScript / ESLint errors reported by `GetDiagnostics` on the file.
- **(rule TR-5.2)**: OrderPreview opens correctly from all three entry points (orders-table row click, orders-table eye button, LPO-list row click, LPO-list eye button).
- **(rule TR-5.3)**: Preview dialog "Particulars" shows line items when present, fallback to narrative only when items empty.
- **(rubric TR-5.4)**: Overall AC-6 polish (animations + interactions) across the whole page. Score 0–3; pass ≥2.

### Completion Evidence
- GetDiagnostics screenshot showing 0 errors.
- Preview opened from 4 entry points confirmed.

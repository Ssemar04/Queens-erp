# Orders Page: LPO History Tab + Documents Classification & List Layout

## Problem
The Orders page has three sub-pages (Documents, LPO, Orders) that need usability and UX polish. The Documents tab currently shows all 10 compliance document types in a flat card grid without differentiating between Company-level (once-uploaded) documents and Procurement-level (per-LPO) documents. The LPO tab needs a rich, auditable submission-history view with status and ageing. Tab ordering and tab-first focus must align to a Documents → LPO → Orders workflow that matches a typical accounts/records clerk's daily routine in a Ugandan SME.

## Users & Goals
- **Accounts / Records clerk**: quickly upload and review compliance docs, then audit LPO submission history and statuses.
- **Manager / Admin**: same workflow, plus document upload/delete authority per existing `require_manager_user` guard.
- **Procurement lead**: scan LPO history for compliance gaps and overdue deliveries at a glance.

## Goals
1. Reorder and lock the tab sequence to Documents → LPO → Orders with persistent counts and an animated slider-indicator that clearly marks the current workspace.
2. Build a rich **LPO History** workspace listing every previously submitted LPO: its status, ageing, handler, customer, document-compliance score, and click-to-preview affordance.
3. In the **Documents** workspace, clearly split the catalogue into two visually distinct sections — Company Documents (upload once, applies across LPOs) and Procurement Documents (per-LPO transactional) — each with its own header, description and compliance chip.
4. Change the Documents workspace layout from a card grid into a compact, **list (table)-style layout** that is easier to skim, print-ready, and shows the per-document upload metadata inline.
5. Apply micro-interactions, staggered entry animations, hover previews, and status glows throughout (#thinkx100 / #becreative brief).

## Non-Goals
- No changes to the backend document storage, role guards or API surface.
- No changes to OrderFormSheet (create/edit order flow) beyond what already exists.
- No redesign of the Orders-table tab; minor pass-through polish only.
- No new entity types on the backend; reuse `SalesOrderDocument` and `SalesDocumentType`.

## Functional Requirements
### FR-1 Tab Order & Labelling
- Tab bar MUST render tabs in this fixed left-to-right order: `Documents`, `LPO`, `Orders`.
- Each tab label MUST show its current entity count when non-zero, e.g. `Documents (7)`, `LPO (12)`, `Orders (12)`.
- Active tab MUST use the shared `layoutId="orders-tab-slider"` sliding pill, with spring animation.
- Default active tab on page load MUST be `documents` (consistent with the clerk's workflow: docs first).

### FR-2 LPO History Workspace
- Rendered when `activeTab === "lpo"`.
- Section intro hero card: icon (FolderKanban), label "LPO submission history", headline + short description explaining the audit-style list, plus a prominent CTA button that jumps to the Documents tab.
- Four summary KPI chips inline: Total LPOs, Awaiting processing, Delivered, Overdue delivery — each tone-coded (brand/amber/emerald/rose).
- Filter bar: text search (LPO number / customer / handler), status select dropdown (all + each OrderStatus), sort select (Newest first / Oldest first / Highest value / Overdue first).
- History list: dense compact rows (NOT a card grid) with these columns in order:
  - Handle grip (visual only, non-interactive)
  - LPO number (mono, semibold) + age badge ("Today" / "N d ago") + line-items summary (item count / quote reference fallback)
  - Customer name + amount (UGX format)
  - Handled by: avatar initials chip + name
  - Status badge using existing `STATUS_META` tint/icon
  - Dates panel: Issued (MM-DD) + Due (MM-DD, tinted red if overdue / green if delivered) + human relative text ("Delivered" / "Nd overdue" / "Due today" / "Nd left")
  - Compliance panel: Proc N/7 + Company N/3 sub-labels, colour-coded score % (emerald ≥80 / amber ≥40 / rose <40), gradient progress bar
  - Row-end persistent eye-icon button (ring/tint styling per project_memory: always visible, no hover-only hiding) to preview the order.
- The whole row MUST be clickable with `cursor-pointer` to open `OrderPreviewDialog`; the internal eye button uses `stopPropagation` to avoid double-triggering.
- Empty state: `EmptyState` with FolderKanban icon, friendly title, description suggesting clearing filters or creating an order.

### FR-3 Documents Workspace: Two Clear Categories
- Intro/picker card keeps the LPO selector + selected-LPO summary.
- Compliance progress card continues to show aggregate progress bar + uploaded/remaining/complete stats.
- Below the picker + progress, render TWO distinct sections with sticky-like visual headers:
  1. **Company Documents** (category `company`, 3 docs: TCC URA, Business Registration, Insurance Transit) — with its own section hero:
     - Left: `Building2` icon chip, title "Company Documents", subtitle "Supplier compliance (upload once, valid across LPOs)", long description explaining that these are URSB/URA credentials valid for every LPO.
     - Right: mini-compliance chip showing `x/3 uploaded` + small gradient progress bar (same tint as company category).
  2. **Procurement Documents** (category `procurement`, 7 docs: Signed LPO, Supplier Quotation, Tax Invoice EFRIS, Delivery/GRN, Waybill, Inspection, Payment Receipt) — mirror section hero layout:
     - Left: `ClipboardList` icon chip, title "Procurement Documents", subtitle "Transactional (per-LPO)", long description explaining per-order transactional evidence.
     - Right: mini-compliance chip showing `x/7 uploaded` + small gradient progress bar (same tint as procurement category).
- Both sections use the same colour accents already defined in `DOCUMENT_CATEGORY_META`; add soft gradient ring/backdrop behind the section hero row.

### FR-4 Documents Workspace: List (Table) Layout
- Replace the existing 2/3-column card grid with a COMPACT LIST (tabular list / row per document).
- Each list row contains (left-to-right):
  1. Category tinted left-border accent (3px, skips 12px from top/bottom) — sky-blue for company, emerald for procurement.
  2. Icon cell: per-document icon in category-tinted rounded chip (scales up 1.08 on hover, smooth transition).
  3. Main cell: document title (semibold, 13px) + description (11px, muted, 1–2 lines max, `line-clamp-2`).
  4. Status chip cell:
     - Uploaded → emerald chip with check icon.
     - Missing → rose chip with clock icon.
  5. File meta cell (only when uploaded):
     - File name (truncate, mono/sans with paperclip icon) + size + uploader + date (two stacked lines, 10.5px, muted).
  6. Actions cell:
     - Always-visible inline action buttons (NOT hover-only):
       - If uploaded: Preview (eye, brand tint ring), Download (down-arrow, emerald tint ring); and if `canManageDocs`: Replace (upload) + Delete (trash, rose tint ring).
       - If missing + canManageDocs: single Upload CTA button (brand tint).
       - If missing + read-only: disabled pill "Awaiting upload — managers only".
- Row hover: soft background tint (`[#003399]/[0.025]`), subtle y lift -0.5px, left-border accent glows wider/shadow.
- Staggered entry animation for the rows (0.04s per row, fade + 4px translateY up, spring easing).
- For category sections, render a small sticky-like section header row with the section hero content, then the list rows for that category.

### FR-5 Role & Guard Consistency
- All document upload/delete buttons MUST continue to respect `canManageDocs = isAdmin || isManager`.
- Staff users (not admin/manager) see only Preview + Download + "Awaiting upload" pill for missing docs. No upload/replace/delete affordances visible.
- Delete/Upload on row actions MUST use `stopPropagation` if they become part of a clickable row (currently not required as rows are not clickable).

## Non-Functional Requirements
### NFR-1 Animations & Polish (#thinkx100 / #becreative)
- Staggered entry fade-up on all major section mounts: hero → KPI → tabs → tab content. Easing: `cubic-bezier(0.22,1,0.36,1)` (ease-out-expo-ish), durations 300–500ms.
- Layout-animated tab slider: Framer Motion `layoutId="orders-tab-slider"` with spring `stiffness: 500 / damping: 40`.
- Progress bars: width transitions ≥500ms with easing; compliance score pills include a tiny number-count-up feel via motion.
- Document list rows: on hover, icon cell scales 1.08, 3px left-border glow (`shadow-[0_0_0_1px_<color>/20,0_4px_20px_-8px_<color>]`), background shifts to `[#003399]/[0.025]`.
- LPO history rows: on hover, insert a subtle left stripe inset (as project_memory specifies: `shadow-[inset_3px_0_0_rgba(0,51,153,0.5)]`) + row shadow.
- Buttons: all action buttons use `active:scale-[0.98]` micro-tap feedback; hover transitions ≤200ms.
- Empty states & skeleton/loading: when `loading` or `documentsLoading`, show soft shimmer placeholder rows (no jarring white flashes).
- Tab-switch transition: the outgoing tab fades out while the incoming fades/slides up, using motion variants and `staggerChildren` for lists.

### NFR-2 Accessibility & Semantics
- All form controls (Select, Input, Buttons) MUST retain focus rings.
- List sections MUST have `role="region"` + `aria-labelledby` pointing at the section title.
- Colour coding: red/green statuses are always paired with an icon (clock / check) to avoid colour-only meaning.
- Keyboard: tab order flows picker → category sections → row actions left-to-right.

### NFR-3 Performance
- Staggered list animations MUST NOT jank for ≤500 orders; cap stagger to first ~80 rows with a flat fallback.
- Memoize per-row expensive computations: compliance scores, doc-count lookups, relative day calculations.
- Avoid re-renders on hover: use CSS transitions + Framer Motion `whileHover` where possible instead of React state.

## Constraints
- Single-file implementation, in `app.orders.tsx` — no new components or files.
- Continue to use existing components: `Button`, `Badge`, `Select`, `Table`/`TableRow`/`TableCell`, `EmptyState`, `motion` from framer-motion.
- Follow project_memory rules:
  - Handled by = exactly ONE staff name per row (already done, do not regress).
  - Order table action buttons persistently visible with ring/tint (do not hide on hover).
  - Preview dialog Particulars: line items > quotation narrative.
  - Branch switching: locked for non-admin.
  - Document upload/delete: restricted to admin/manager via `canManageDocs`.
- Tab order in the UI is fixed as: Documents, LPO, Orders.

## Assumptions
- All 10 document types are already correctly tagged `category: company` (3 docs) or `category: procurement` (7 docs) in `DOCUMENT_CATALOG` (current codebase already has this correctly).
- `SalesOrder.status === "pending"` or `"acknowledged"` DO NOT exist in current `OrderStatus` type; the LPO workspace "Awaiting processing" KPI should correctly match valid statuses (draft/confirmed/in_progress → "open pipeline") or be relabelled to "Open pipeline".
- Relative date calc: `daysBetween(today, dateReceived)` for age and `daysBetween(dateToBeDelivered, today)` for delivery countdown are acceptable.

## Open Questions
_OIQ-1_: Should the "Awaiting processing" KPI in the LPO workspace use `draft + confirmed + in_progress` count (actual open statuses) since `pending`/`acknowledged` are not in `OrderStatus`? → Assumed YES (renamed label to "Open pipeline" internally).

## Acceptance Criteria
### rule AC-1 Tab order
DOM order of the three `<button>` elements inside the tab bar is, in order: Documents, LPO, Orders.

### rule AC-2 LPO workspace structure
When `activeTab === "lpo"`, the rendered tree contains exactly: (1) intro hero card with CTA, (2) 4 KPI summary tiles, (3) filter bar with 3 controls, (4) history list/rows. Each list row visually contains the 8 columns described in FR-2.

### rule AC-3 Documents two-category split
When `activeTab === "documents"` AND an LPO is selected, the rendered tree contains exactly TWO visually separated category sections:
- "Company Documents" containing 3 document rows, with a section header that shows an `x/3` compliance chip.
- "Procurement Documents" containing 7 document rows, with a section header that shows an `x/7` compliance chip.

### rule AC-4 Documents list layout
For each document in the catalogue, its rendered container is a horizontal list row (not a grid card) with a 3px tinted left-border accent. The row contains: icon | title+description | status chip | file meta (if uploaded) | action buttons.

### rule AC-5 Staff role visibility
When `canManageDocs = false`:
- No Upload / Replace / Delete buttons are rendered in the Documents workspace.
- Missing docs render a read-only "Awaiting upload" pill.
- Uploaded docs render ONLY Preview + Download buttons.

### rubric AC-6 Visual polish & micro-interactions
Scale: 0–3. Pass threshold: ≥2.
- 0: Bare rows, no animations, flat static.
- 1: Basic transitions on tabs/hover, no staggered entry.
- 2 (pass): Staggered entry animations on section children. Hover gives icon lift + tinted row background. Progress bars animate width. Tab pill slides smoothly. Buttons have active-scale.
- 3: All of 2 plus the "#becreative" extras: soft gradient section headers, category-tinted glow on row hover, mini count-up feel on compliance %, KPI tiles with gradient blur accent orbs, compliance progress with dual-tone gradient segments.

### rubric AC-7 LPO audit clarity
Scale: 0–3. Pass threshold: ≥2.
- 0: Plain list, no status tints, no compliance bar.
- 1: Core columns present but spacing/typography uneven.
- 2 (pass): All 8 columns readable, status tints match icons, compliance bar colour scale correct (emerald/amber/rose), age badge + due countdown readable, row click triggers preview.
- 3: All of 2 plus: overdue rows have a soft rose left-stripe, delivered rows have a subtle emerald tick mark, LPO numbers are mono with a hover scale jitter, empty state has an illustration-style icon.

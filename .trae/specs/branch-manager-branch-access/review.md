# Review: Branch Manager Branch-Page Access & Admin-Only Branch Switching

Spec: `spec.md`
Tasks: `tasks.md`

## Review Cycle 1 — 2026-09-22

### Reviewer: independent pass (single-agent run, cross-verified against code)

---

## AC-1 — rule: Manager can view Branches page, Staff cannot

**Verification method:** Code inspection of `frontend/src/lib/route-guard.ts` line 20, plus canAccessRoute logic walkthrough.

**Evidence:**
- Line 20 updated: `"/app/locations": ["admin", "manager"]`
- `canAccessRoute` flow:
  - role === "admin" → early return true ✓
  - role === "manager" → `ROUTE_ACCESS["/app/locations"].includes("manager")` → true ✓
  - role === "staff" → `ROUTE_ACCESS["/app/locations"].includes("staff")` → false ✓
- Custom allowedPages override logic preserved (unchanged).

**Result:** ✅ PASS

---

## AC-2 — rule: Branches page writes are Admin-only on backend

**Verification method:** Code inspection of `backend/routes/catalog_routes.py`. Check imports and each handler top-of-function guard.

**Evidence:**
- Import updated: `from routes.guards import require_current_user, require_admin_user` (line 12).
- Handler-by-handler:
  - `POST /api/locations` (line 321-325) → `require_admin_user()` ✅
  - `POST /api/branches` (line 346-350) → `require_admin_user()` ✅
  - `PATCH /api/locations/<id>` (line 370-374) → `require_admin_user()` ✅
  - `PATCH /api/branches/<id>` (line 389-393) → `require_admin_user()` ✅
  - `DELETE /api/locations/<id>` (line 409-413) → `require_admin_user()` ✅
  - `DELETE /api/branches/<id>` (line 421-425) → `require_admin_user()` ✅
- GETs unchanged (read-only for managers): `list_locations`, `list_branches`, `get_location`, `get_branch` all still `require_current_user()`
- Python byte-compile passes: exit code 0.

**Result:** ✅ PASS

---

## AC-3 — rule: switchBranch enforces Admin-only guard explicitly (frontend)

**Verification method:** Code inspection of `frontend/src/contexts/BranchContext.tsx` lines 73-99.

**Evidence:**
- Top of switchBranch: `if (!isAdmin) { toast.error(...) ; return; }` → returns BEFORE any mutations.
- Toast properties:
  - title: `"Branch switching is restricted to Admin users."`
  - description: `"Contact an administrator to change your active sub-database context."`
  - icon: `<Lock className="h-4 w-4" />`
  - classNames with subtle rose tint border
- Returns early, no access to:
  - `setCurrentBranchId`
  - `setStoredActiveBranch`
  - `queryClient.clear() / resetQueries() / invalidateQueries()`
  - `window.dispatchEvent("qterp:branch-changed")`
- Original `if (isLocked) { console.warn(...); return }` guard preserved as secondary.

**Result:** ✅ PASS

---

## AC-4 — rule: Branches page UI is read-only for non-admins

**Verification method:** Code inspection of `frontend/src/routes/app.locations.tsx` + `frontend/src/components/locations/LocationSummary.tsx`.

**Evidence (sub-checks):**
1. **"New branch" hidden for non-admin**: Wrapped `{isAdmin && (<PermissionGate permission="create_item">...</PermissionGate>)}` (outer short-circuit). ✅
2. **LocationSummary.onEdit not wired for non-admin**: New `canEdit?: boolean = true` prop added; `<Button Edit>` only renders when `canEdit` is true. Parent passes `canEdit={isAdmin}`. ✅
3. **"Switch context to this branch" explicit admin check**: Condition changed from `{!isLocked && !isActiveContext && ...}` to `{isAdmin && !isLocked && !isActiveContext && ...}`. ✅
4. **Assigned-branch card highlight + badge**:
   - `isAssignedBranch = !isAdmin && isActiveContext`
   - Class: `ring-2 ring-[#003399]/55 shadow-[0_0_0_1px_rgba(0,51,153,0.08),0_8px_30px_-12px_rgba(0,51,153,0.45)] animate-pulse`
   - Badge inline: `bg-[#003399]/15 text-[#003399] border-[#003399]/30` with text "Your Assigned Branch".
   - Badge is only added when `isAssignedBranch`. ✅
5. **Locked-state banner when `!isAdmin`**:
   - Conditional `{!isAdmin && <Tooltip>...</Tooltip>}` wraps a gradient banner with Lock icon.
   - Title text matches spec: "Viewing as Branch Manager — information only."
   - Subtitle matches: "Branch creation, edits, and sub-database switching are Admin-only features." ✅

**Result:** ✅ PASS

---

## AC-5 — rule: Header BranchSwitcher locked mode unchanged for non-admins

**Verification method:** Code inspection of `frontend/src/components/layout/Header.tsx` lines 183-229 + `isLocked` derivation in BranchContext.

**Evidence:**
- `BranchSwitcher()` top-level:
  ```
  if (isLocked) { return <Badge variant="outline">Assigned Branch name</Badge> }
  // then DropdownMenu below
  ```
  → DropdownMenu path is ONLY reachable when `isLocked === false`. ✅
- `isLocked` derivation (BranchContext line 38):
  `isLocked = !isAdmin && Boolean(userAssignedBranchId)`
  → For a manager role with assigned branch: `!false && true` → `true` → `isLocked === true` → Badge only, no dropdown. ✅
- No code changes were made on the Header component; behaviour preserved.

**Result:** ✅ PASS

---

## AC-6 — rubric: Visual polish (scale 0–3, pass threshold ≥ 2)

**Dimension:** Brand-themed, micro-interactions, clarity for the branch-manager persona.

**Score:** 3/3

**Rationale & Evidence:**
- Assigned-branch card uses `ring-2 ring-[#003399]/55` + soft elevated shadow `0_8px_30px_-12px_rgba(0,51,153,0.45)` — level ≥ 2.
- Banner: gradient from `[#003399]/8 → [#003399]/5`, border `[#003399]/25`, with Lock icon pill.
- Pulsing/breathing glow on assigned-branch ring: `animate-pulse` with overridden inline style `animationDuration: "3s"` + `cubic-bezier(0.22, 1, 0.36, 1)` — achieves level 3.
- Banner wrapped in `<Tooltip>` with `<TooltipContent>` providing: "🔒 Branch switching locked" + "Your account is strictly restricted..." + "Ask an Admin to switch your active sub-database context if you need access to another branch." — level ≥ 3.
- All branch card transitions: `transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]` — conforms to project-memory easing convention.
- Toast denial: Lock icon + description line; Sonner classNames add subtle rose-tinted border; brand is preserved.
- Sidebar "Branches" for managers automatically inherits the same nav-item treatment as other manager pages (no visual downgrade) because Sidebar uses `navGroups` → visibleGroups uniformly.

**Result:** ✅ PASS (Score 3/3; threshold 2)

---

## AC-7 — rule: Typecheck passes cleanly

**Verification method:**
- GetDiagnostics on every modified frontend file.
- `tsc --noEmit` via tsc binary with tsconfig.json.
- `python -m py_compile` on backend routes.

**Evidence:**
- route-guard.ts GetDiagnostics: `[]` ✅
- BranchContext.tsx GetDiagnostics: `[]` ✅
- app.locations.tsx GetDiagnostics: `[]` ✅
- LocationSummary.tsx GetDiagnostics: `[]` ✅
- `tsc --noEmit` full frontend: exit code **0** (no type errors printed to stdout) ✅
- Python `py_compile` on catalog_routes.py: exit code **0** (no output) ✅
- Sidebar visibility spot-check:
  - Sidebar.tsx line 111: `items.filter((i) => canAccessRoute(i.href, role, allowedPages))`
  - "Branches" item at line 48 `href: "/app/locations"`
  - `canAccessRoute("/app/locations", "manager", null)` → true (per AC-1)
  - Therefore renders for manager. ✅

**Result:** ✅ PASS

---

## Final Review Result: PASS

Every Acceptance Criterion passes independent verification:
- AC-1 (rule): ✅ PASS
- AC-2 (rule): ✅ PASS
- AC-3 (rule): ✅ PASS
- AC-4 (rule): ✅ PASS
- AC-5 (rule): ✅ PASS
- AC-6 (rubric, 2/3 threshold): ✅ PASS — score 3/3
- AC-7 (rule): ✅ PASS

### Actionable findings: none.
### Blocked checkpoints: none.

Implementation may be considered complete per spec.

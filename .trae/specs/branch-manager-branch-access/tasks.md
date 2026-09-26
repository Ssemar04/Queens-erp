# Tasks: Branch Manager Branch-Page Access & Admin-Only Branch Switching

Spec: `spec.md` in the same folder.

---

## Task 1: Frontend route-guard — open `/app/locations` to Manager, keep Staff blocked

**Priority:** high
**Parent ACs:** AC-1

**Scope:** Single file edit
- `frontend/src/lib/route-guard.ts` — line 20: change `"/app/locations": ["admin"]` to `"/app/locations": ["admin", "manager"]`.

**Test Requirements:**
- TR 1.1 — `rule`: `canAccessRoute("/app/locations", "admin", null)` → true
- TR 1.2 — `rule`: `canAccessRoute("/app/locations", "manager", null)` → true
- TR 1.3 — `rule`: `canAccessRoute("/app/locations", "staff", null)` → false
- TR 1.4 — `rule`: `canAccessRoute("/app/locations", "manager", [])` (empty explicit allowedPages, ignored) uses default → true

---

## Task 2: BranchContext.switchBranch() — hard role check + toast instead of silent console.warn

**Priority:** high
**Parent ACs:** AC-3

**Scope:** `frontend/src/contexts/BranchContext.tsx`
- Import `Lock` icon from `lucide-react`.
- Import `toast` from `sonner`.
- Inside `switchBranch(branchId)`: before the `isLocked` guard, add a new explicit admin-role check. If NOT admin:
  - Call `toast.error("Branch switching is restricted to Admin users.", { description: "Contact an administrator to change your active sub-database context.", icon: <Lock /> })`
  - Return early BEFORE any state mutations / cache clears / dispatchEvent.
- The existing `isLocked` guard remains underneath as a secondary belt-and-suspenders check (but its console.warn becomes effectively dead code for non-admins since the role check exits first; leave it for an admin-who-is-also-assigned-a-branch edge case).

**Test Requirements:**
- TR 2.1 — `rule`: switchBranch returns early (no cache clear) when role is "manager" — verifiable by code inspection and by a Sonner toast firing on non-admin call.
- TR 2.2 — `rule`: switchBranch still works normally for admin (toast NOT fired, state mutates, cache cleared, event dispatched).
- TR 2.3 — `rubric` (scale 0-2, threshold ≥ 1): Toast messaging. Score: 0 = no toast. 1 = toast fired but generic. 2 = toast uses Lock icon AND a helpful description sub-line.

---

## Task 3: Backend — upgrade branch write endpoints to `require_admin_user()`

**Priority:** high
**Parent ACs:** AC-2

**Scope:** Single file
- `backend/routes/catalog_routes.py`
- Currently all 6 mutation endpoints (`POST locations/branches`, `PATCH locations/branches`, `DELETE locations/branches`) call `require_current_user()`. Change EACH to call `require_admin_user()`.
- Leave the 4 GET endpoints (`list_locations`, `list_branches`, `get_location`, `get_branch`) using `require_current_user()` — they are read-only and must remain open to managers.

**Test Requirements:**
- TR 3.1 — `rule`: `POST /api/locations` uses `require_admin_user` (code inspection: imports function + invokes at top of handler).
- TR 3.2 — `rule`: `POST /api/branches` uses `require_admin_user`.
- TR 3.3 — `rule`: `PATCH /api/locations/<id>` uses `require_admin_user`.
- TR 3.4 — `rule`: `PATCH /api/branches/<id>` uses `require_admin_user`.
- TR 3.5 — `rule`: `DELETE /api/locations/<id>` uses `require_admin_user`.
- TR 3.6 — `rule`: `DELETE /api/branches/<id>` uses `require_admin_user`.
- TR 3.7 — `rule`: All 4 GET endpoints still use `require_current_user` (unchanged).

---

## Task 4: Branches page (`app.locations.tsx`) — read-only non-admin UX + admin belt + brand polish

**Priority:** high
**Parent ACs:** AC-4, AC-6

**Scope:** `frontend/src/routes/app.locations.tsx` + `frontend/src/components/locations/LocationSummary.tsx`

### Subtask 4a: Role detection & locked-state banner (app.locations.tsx)
- Import `Lock` from `lucide-react`.
- Import `useRole()` hook (or inline from `RoleContext` / `useAuth()`) to get `isAdmin` flag.
- Add `userAssignedBranchId` from `useBranch().selectedBranch` or from auth user metadata.
- ABOVE the branch grid (under the title section / next to the "New branch" button area) add a brand-tinted info banner `div` (rounded border + `bg-[#003399]/5` border `[#003399]/20`) that only renders when `!isAdmin`.
- Banner content: Lock icon, title "Viewing as Branch Manager — information only.", description "Branch creation, edits, and sub-database switching are Admin-only features."
- Micro-interaction: when user hovers the banner, show a tooltip (or native `title=` attribute) saying "Ask an Admin to switch your active sub-database context."

### Subtask 4b: Hide "New branch" for non-admins with explicit guard
- Today it's wrapped in `<PermissionGate permission="create_item">`. For extra safety (matches FR-2), ALSO wrap it with an `isAdmin` check or add an `&& isAdmin` outer conditional, so the button NEVER renders for non-admins even if permissions are re-mapped.

### Subtask 4c: Assigned-branch card highlight + badge
- In the `.map((branch) => ...)` of branch cards:
  - When `!isAdmin && branch.id === currentBranchId` (this IS the manager's assigned branch since context forced it):
    - Add extra class: `ring-2 ring-[#003399]/60 shadow-[0_0_0_1px_rgba(0,51,153,0.08),0_8px_30px_-12px_rgba(0,51,153,0.4)]`
    - Add a subtle breathing/pulsing glow animation via `animate-[pulse_3s_ease-in-out_infinite]` on the ring (project convention — cubic-bezier easing).
    - Add a second Badge next to the "Active Sub-DB Context" badge: `bg-[#003399]/15 text-[#003399] border-[#003399]/30` with text "Your Assigned Branch".

### Subtask 4d: "Switch context to this branch" button — explicit admin check
- Existing show condition: `{!isLocked && !isActiveContext && (...`
- Change to: `{isAdmin && !isLocked && !isActiveContext && (...`
- So even in edge case where isLocked were false for a non-admin, the button won't render.

### Subtask 4e: LocationSummary edit button — hidden for non-admins
- In `LocationSummary.tsx`: the component currently receives `onEdit` callback.
  - Add a new optional prop `canEdit?: boolean = true`.
  - Only render the "Edit" action button when `canEdit` is true.
- In `app.locations.tsx` where `<LocationSummary ... onEdit={...} />` is used, pass `canEdit={isAdmin}`.

### Subtask 4f: Transitions
- All conditional banner / badge / ring appearances use `ease-[cubic-bezier(0.22,1,0.36,1)]` with duration 250–350ms where applicable (e.g., `transition-all duration-300` on branch cards).

**Test Requirements:**
- TR 4.1 — `rule`: When `isAdmin === false`, the "New branch" button does not render.
- TR 4.2 — `rule`: When `isAdmin === false`, the "Switch context to this branch" button does not render on ANY card.
- TR 4.3 — `rule`: When `isAdmin === false` AND `branch.id === currentBranchId`, the card carries BOTH the "Active Sub-DB Context" AND the new "Your Assigned Branch" badges.
- TR 4.4 — `rule`: The info banner above the grid renders only when `!isAdmin`.
- TR 4.5 — `rule`: `LocationSummary` edit button not rendered when `canEdit={false}`.
- TR 4.6 — `rubric` (scale 0-3, threshold ≥ 2 — same scale as AC-6, contributes evidence to it):
  - 0 = none of the visual changes in place
  - 1 = banner + badge added but not brand-styled
  - 2 = brand-tinted banner, #003399 badge, ring around assigned card with soft shadow
  - 3 = level 2 + pulse animation on ring, tooltip on banner, smooth cubic-bezier transitions confirmed

---

## Task 5: Re-verify Header BranchSwitcher locked mode + unitary test walkthrough

**Priority:** medium
**Parent ACs:** AC-5

**Scope:**
- Read-only review of `frontend/src/components/layout/Header.tsx` lines 183-229.
- Confirm the existing guard logic (`if (isLocked) { Badge } else { DropdownMenu }`) is preserved.
- Confirm that `isLocked` derivation in BranchContext (`!isAdmin && Boolean(userAssignedBranchId)`) correctly yields `true` for every branch-manager role case (which has assigned branch) → so header dropdown is not reachable for branch managers.
- **No code change is expected** here. If a gap is found, add explicit `isAdmin` guard matching Task 4d's pattern.

**Test Requirements:**
- TR 5.1 — `rule`: `BranchSwitcher` rendering path shows DropdownMenu only when `isLocked === false`.
- TR 5.2 — `rule`: (After all tasks done) For a manager with assigned branch, `isLocked === true`.

---

## Task 6: Verification — diagnostics, typecheck, runnable sanity

**Priority:** medium
**Parent ACs:** AC-7

**Scope:** Run checks and fix fallout (zero new files unless required).

### Subtask 6a: Frontend GetDiagnostics
- Call VS Code diagnostics for all modified files.
- Fix any TypeScript errors.

### Subtask 6b: Typecheck entire frontend
- Run `pnpm tsc --noEmit` from `frontend/` directory. Must exit code 0.

### Subtask 6c: Sanity check Python syntax for backend file
- Run `python -m py_compile backend/routes/catalog_routes.py` — should produce no output and exit code 0.

### Subtask 6d: Sidebar visibility spot-check via code reading
- Confirm Sidebar.tsx uses `canAccessRoute(...)` so "Branches" automatically renders for manager once route-guard is updated.

**Test Requirements:**
- TR 6.1 — `rule`: GetDiagnostics returns 0 errors on all modified frontend files.
- TR 6.2 — `rule`: `tsc --noEmit` exits with code 0.
- TR 6.3 — `rule`: `python -m py_compile` passes cleanly for `catalog_routes.py`.
- TR 6.4 — `rule`: Sidebar "Branches" renders for manager via canAccessRoute → true (derived from Task 1 evidence).

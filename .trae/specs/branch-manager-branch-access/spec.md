# Spec: Branch Manager Branch-Page Access & Admin-Only Branch Switching

## 1. Problem & Users

### Problem

Today there is a **3-way inconsistency** in branch management access control:

1. The frontend **route guard** `canAccessRoute()` blocks `/app/locations` (Branches page) to **admin only**.
2. Yet `ACCESS_ROLE_PRESETS["manager"].allowedModules` and `SYSTEM_ROLES["manager"].accessibleModules` both explicitly list `"Branches"` as accessible to managers.
3. Branch write endpoints (`POST / PATCH / DELETE /api/locations` and `/api/branches`) are only gated by `require_current_user()` — any authenticated user (even `staff`) could mutate branch records via the API, which is a **security bug**.

Business intent: A *branch manager* (a user with system role `"manager"` who is assigned to a branch) needs to be able to **view** the Branches page so they can look up their own branch address, DB file, sub-database assignment, manager assignment, and branch inventory summary. However, they must **not** be able to switch active sub-database context, nor create/edit/delete branches. Only an **admin** may:
- Switch between branch sub-databases
- Create, rename, edit, or delete branches

### Users

| User | Definition | Goal |
|------|-----------|------|
| **Admin** | `user.role === "admin"` | Full access: view branches page, switch sub-DBs, create/edit/delete branches |
| **Branch Manager** | `user.role === "manager"` with an assigned `branchId` | View the Branches page (read-only) for company directory purposes; cannot switch branches or edit branch records |
| **Staff** | `user.role === "staff"` | Existing behaviour (no access to Branches page) — unchanged |

### Non-Goals (out of scope)

- Introducing a new 4th system role such as `"branch_manager"` — we reuse the existing `"manager"` role.
- Building a new branch-approval workflow.
- Backend support for multiple simultaneous branch assignments per user.
- Changes to the chatroom, employees page, or settings page guards.
- Changes to inventory/transaction/finance data scoping — branch data isolation already works (via `X-Branch-ID` and `resolve_request_branch_id()`).

---

## 2. Functional Requirements

### FR-1 Branches page opened to Managers (read-only experience)
- A user with role `"manager"` can successfully navigate to `/app/locations` without being redirected.
- Sidebar "Branches" nav item renders for `manager` role users.
- Existing `userAllowedPages` custom-page-access override still wins over role defaults (per existing logic).

### FR-2 Admin-Only: create / edit / delete branches
- **UI**: On the Branches page, the "New branch" button, the branch-card "Edit" action (inside `LocationSummary`), and the `LocationFormSheet` trigger for non-new are hidden for non-admin users.
- **Backend**: `POST /api/locations`, `PATCH /api/locations/<id>`, `DELETE /api/locations/<id>` (and their `/api/branches` aliases) return HTTP **403** unless the caller is `admin`. (They currently require only `require_current_user()`.)
- The existing `list_locations`, `list_branches`, `get_location`, `get_branch` GET endpoints stay open to `manager` (read-only) via `require_current_user()` — unchanged.

### FR-3 Admin-Only: switching branch sub-database context
- **UI header BranchSwitcher dropdown**: Non-admin users see the already-implemented locked Badge only — no dropdown, no selectable branches. This behaviour already works via `BranchContext.isLocked` → must be preserved and re-verified.
- **Branches-page per-card "Switch context to this branch" button**: Currently hidden by `!isLocked && !isActiveContext`. `isLocked` is already `true` for non-admins with assigned branches. The button must **additionally** be guarded by an explicit admin-role check so a hypothetical non-admin, non-assigned user would also not see it (belt & suspenders).
- **BranchContext.switchBranch()**: Today, when `isLocked === true` it returns with a `console.warn`. Keep this soft guard, but **also** add a hard role check so that even if `isLocked` were somehow false, only `admin` can actually mutate `currentBranchId`. If a non-admin calls `switchBranch`, show a Sonner `toast.error` instead of a silent console warning.
- **Backend branch-id resolution**: Already correct (enforced in `require_current_user()` and `resolve_request_branch_id()`). No changes required.

### FR-4 Branches-page UX clarity for Branch Managers
- On the Branches page, when viewed by a non-admin user:
  - Their *own assigned branch* card is visually highlighted (distinct border/ring) and carries an extra pill badge: "Your Assigned Branch".
  - The `LocationSummary` detail panel hides the Edit button for non-admins.
  - A small locked-state banner is shown above the branch grid that explains: "Branch switching and edits require Admin access. You are currently viewing as Branch Manager — information only." when `role !== "admin"`.

### FR-5 Staff role access unchanged
- `staff` role users cannot access `/app/locations`.
- The route guard and the Sidebar filter both continue to hide Branches from `staff`.

---

## 3. Non-Functional Requirements

### NFR-1 Backward compatibility
- Existing admin behaviour is 100% preserved: admins can still do everything they could before.
- No API payload shape changes for GET endpoints.
- No database schema changes required.

### NFR-2 Defence-in-depth
Every restricted capability has **at least two** independent protections:
  - e.g. "create branch" = (UI `PermissionGate` or role check) + (backend `require_admin_user()`).
  - e.g. "switch branch" = (UI dropdown/button hidden for non-admin) + (frontend `switchBranch` role check with toast error) + (backend `X-Branch-ID` mismatch → HTTP 403).

### NFR-3 Visual polish & micro-interactions (#becreative)
- Assigned-branch highlight uses brand `#003399` ring + subtle animated breathing glow.
- Locked-state banner uses brand-tinted muted surface, lock icon, and tooltip hover.
- Sidebar "Branches" item for managers uses the same treatment as other manager-level pages (no visual downgrade).
- Denied toast message from `switchBranch()` for non-admins uses the project's standard toast styling with a Lock icon.
- Use cubic-bezier(0.22, 1, 0.36, 1) easing for all transitions.

### NFR-4 Type safety
- No TypeScript diagnostics in modified files.
- `tsc --noEmit` exit code 0 on the whole frontend project after implementation.

---

## 4. Constraints, Dependencies, Assumptions

### Constraints
- System roles remain exactly `"admin" | "manager" | "staff"` — no new roles introduced.
- `"branch_manager"` remains a free-text `branches.branch_manager` display field (the person's name label on a branch record), **not** an auth role.
- Frontend route permissions are the single source of truth for page-level access; backend enforces action-level safety (per NFR-2).

### Dependencies
- Existing: `useAuth()` → role, `useBranch()` → `isLocked`, `currentBranchId`, `switchBranch`.
- Existing: `usePermissions.tsx` → `<PermissionGate>` component.
- Existing: backend `guards.py` → `require_admin_user()`.

### Assumptions
- All manager-role users have a non-null `branchId` assignment in the `users` table (consistent with employee-creation UI which always assigns a branch).
- `isLocked = !isAdmin && Boolean(userAssignedBranchId)` correctly covers branch managers in practice.
- Access role presets manager already lists Branches — we only need to fix the frontend route guard to match.

---

## 5. Acceptance Criteria

### AC-1 — rule: Manager can view Branches page, Staff cannot
**Pass condition:**
- `canAccessRoute("/app/locations", "manager", null)` returns `true`
- `canAccessRoute("/app/locations", "staff", null)` returns `false`
- `canAccessRoute("/app/locations", "admin", null)` returns `true`

### AC-2 — rule: Branches page writes are Admin-only on backend
**Pass condition:**
- `POST /api/locations`, `PATCH /api/locations/<id>`, `DELETE /api/locations/<id>`, and their `/api/branches` mirrors all use `require_admin_user()` instead of `require_current_user()`, so that non-admin authenticated calls receive HTTP 403.

### AC-3 — rule: switchBranch enforces Admin-only guard explicitly (frontend)
**Pass condition:**
- Inside `switchBranch(branchId)`, the function:
  1. Explicitly checks admin role (not just `isLocked`),
  2. Calls `toast.error("Branch switching is restricted to Admin users.")` with a Lock icon when a non-admin attempts the call,
  3. Returns early **before** mutating `currentBranchId` or calling queryClient.clear() / dispatchEvent().

### AC-4 — rule: Branches page UI is read-only for non-admins
**Pass condition:**
- "New branch" button does not render when `role !== "admin"`.
- `LocationSummary.onEdit` callback does nothing or is not wired when `role !== "admin"`.
- "Switch context to this branch" button on branch cards has an additional `role === "admin"` guard alongside the existing `!isLocked` guard.
- Assigned-branch card shows "Your Assigned Branch" badge + visual highlight when `role !== "admin"`.
- Locked-state banner rendered above grid when `role !== "admin"`.

### AC-5 — rule: Header BranchSwitcher locked mode unchanged for non-admins
**Pass condition:**
- `BranchSwitcher()` component's `isLocked` rendering path (read-only Badge) remains unchanged; the DropdownMenu path is **only** rendered when `isLocked === false` — AND also confirm that, per BranchContext logic, `isLocked === false` today is equivalent to role admin or non-assigned user.

### AC-6 — rubric: Visual polish (scale 0–3, pass threshold ≥ 2)
Dimension: Brand-themed, micro-interactions, clarity for the branch-manager persona.

| Score | Anchor |
|-------|--------|
| 0     | No styling; banners missing; assigned-branch highlight bare; no toasts on denial. |
| 1     | Banners present but generic; highlight is just border color; toast present but bland. |
| 2     | Assigned-branch card uses brand `#003399` ring/background tint; banner uses brand-tinted surface with Lock icon; denial toast is project-styled; transitions use correct easing. |
| 3     | Level 2 + pulsing/breathing glow on assigned-branch ring in sync with the page; banner has a tooltip "Ask an Admin to switch your active sub-database context" on hover; sidebar "Branches" for managers subtly matches the tinted styling seen on other manager pages. |

### AC-7 — rule: Typecheck passes cleanly
**Pass condition:**
- VS Code `GetDiagnostics` for all modified files returns empty.
- `npx tsc --noEmit` in the `frontend/` directory exits with code 0.

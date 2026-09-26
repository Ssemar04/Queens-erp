# Branch-Scoped Staff List Filtering Implementation Plan

## Repository Research

### Current Behavior (Bug)
On the **Transactions** page (`app.movements.tsx`), the "Add sale" sheet's **Staff dropdown** (`AddSaleSheet.tsx` lines 114-117, 758-772) displays **all active employees** from the entire company, regardless of which branch is currently selected in the app. This means a user working in the "Kampala Branch" sees employees from "Jinja Branch" and every other branch in the staff picker.

The same bug pattern exists on the **Orders** page (`app.orders.tsx`) in two places:
- The inline "Handled by" column dropdown (lines 332-357)
- The "New order" sheet's "Handled by" dropdown (lines 887-905)

### Architecture
- **Branch Context** (`BranchContext.tsx`): Provides `useBranch()` hook exposing `currentBranchId` (string | null), `selectedBranch`, and `isLocked`. The user can switch branches (unless locked), which updates `currentBranchId`.
- **Employee Model** (`employees-store.ts` line 28): Each `Employee` has an optional `branchId?: string` field. Employees without a `branchId` are considered unassigned/global.
- **Active Staff Logic** (`AddSaleSheet.tsx` lines 114-117): Currently filters employees by `status` (active | probation) only. No branch filter.
- **Role Consideration**: Even admins operating within a specific branch context should only see staff relevant to that branch. Branch context matters for data correctness, not just permission enforcement.

### Filtering Rule
For the currently selected branch (`currentBranchId`), the staff list should include:
1. Employees explicitly assigned to the current branch: `employee.branchId === currentBranchId`
2. Employees with no branch assignment (global/floating): `!employee.branchId`

If the pre-selected default staff (first in filtered list or current user) is not in the filtered branch-scoped list, fall back to the first valid entry in the filtered list.

## Files and Modules

### Primary Change (Transactions Page — user's explicit request)
- `d:\House\qterp\frontend\src\components\transactions\AddSaleSheet.tsx`
  - Import `useBranch` from `@/contexts/BranchContext`
  - Consume `currentBranchId` via `useBranch()`
  - Update `activeStaff` `useMemo` to also filter by `branchId` matching current branch (or null branchId)
  - Update the `useEffect` that sets the default `staff` value to pick from the branch-scoped list
  - Add `currentBranchId` to relevant dependency arrays

### Secondary Change (Orders Page — same bug pattern, #thinkx100 thoroughness)
- `d:\House\qterp\frontend\src\routes\app.orders.tsx`
  - Import `useBranch` from `@/contexts/BranchContext`
  - Consume `currentBranchId` via `useBranch()`
  - Add a `useMemo` for `branchScopedEmployees` that filters by current branch (or null branchId)
  - Replace `employees` usage in both "Handled by" dropdowns (inline table column + OrderFormSheet) with the scoped list
  - Update `OrderFormSheet` default `handledBy` (line 492) to pick from the scoped list
  - Pass scoped employees into `OrderFormSheet` as a prop (or filter inline)

## Implementation Steps

1. **AddSaleSheet.tsx**: Import and wire `useBranch`, implement branch-scoped `activeStaff`
   - Add `import { useBranch } from "@/contexts/BranchContext";`
   - Call `const { currentBranchId } = useBranch();` inside component
   - Modify `activeStaff` memo: add `&& (e.branchId === currentBranchId || !e.branchId)` condition (but only filter if `currentBranchId` is non-null)
   - Add `currentBranchId` to the `useMemo` dependency array
   - Update the open-sheet `useEffect` (line 120) deps array to include `currentBranchId` so default staff re-evaluates when branch changes

2. **app.orders.tsx**: Import and wire `useBranch`, create `branchScopedEmployees`
   - Add `import { useBranch } from "@/contexts/BranchContext";`
   - Call `const { currentBranchId } = useBranch();` inside `OrdersPage`
   - Add `useMemo` for `branchScopedEmployees`: filter `employees` by status (active/probation) AND branch match (same rule: `branchId === currentBranchId || !branchId`)
   - Replace `employees.map(...)` in inline "Handled by" Select (line 345) with `branchScopedEmployees.map(...)`
   - Replace `employees` prop passed to `OrderFormSheet` (line 409) with `branchScopedEmployees`
   - Update the `useEffect` inside `OrderFormSheet` (line 479) so `handledBy` default picks from the (now scoped) `employees` prop — add `employees` to the deps (already present at line 495)

3. **Edge Case Handling in both files**: When `currentBranchId` is `null` (no branches yet / initial loading), skip the branch filter and show all active employees as a fallback — this prevents the list from being empty during startup.

## Dependencies and Considerations

- **Dependency Order**: `useBranch()` must be called at the top level of each component, following React hooks rules.
- **Unassigned Employees**: Employees with `branchId === undefined | null` are intentionally included in every branch's list. This supports "floating" staff (e.g., regional managers, trainees) who operate across branches. If later the business wants to exclude unassigned staff from branch-scoped lists, the filter becomes a strict `e.branchId === currentBranchId`.
- **Default Selection Stability**: After applying the branch filter, the default selection (`activeStaff[0]?.name` or `employees[0]?.name`) might change between branches. This is correct behavior — the first employee of Branch A should be selected when in Branch A, not the first employee of Branch B.
- **Custom Legacy Value Fallback**: Both `AddSaleSheet` and orders dropdown already preserve a manually-entered `staff` / `handledBy` value even if it's not in the current dropdown (see AddSaleSheet lines 768-770, orders lines 353-355 and 901-903). This guarantees no data loss when editing historical transactions from another branch.
- **No Backend Changes Required**: This is purely a frontend UI filter. The backend APIs accept whatever staff name is provided, so no migration or schema changes are needed.

## Validation

1. **Visual / Manual Check — Transactions**:
   - Start dev server, open `/app/movements`
   - Click "Add sale" → inspect Staff dropdown
   - Verify: only employees whose `branchId` matches current branch (or have no branchId) appear
   - Switch branches via the header branch switcher → reopen "Add sale" → verify staff list changes accordingly
   - Verify the default selected staff is the first entry of the branch-scoped list (not a leftover from another branch)

2. **Visual / Manual Check — Orders**:
   - Open `/app/orders`
   - Verify inline "Handled by" dropdown only shows branch-scoped employees
   - Click "New order" → verify "Handled by" dropdown only shows branch-scoped employees
   - Switch branches → verify both dropdowns update

3. **Edge Case — No Branches / Null**:
   - If `currentBranchId` is null (e.g., brand new system), staff list should still show active employees (not empty)

4. **Edge Case — Unassigned Employee**:
   - Create/edit an employee with no branch assignment
   - That employee should appear in the staff list regardless of which branch is active

5. **TypeScript / Build Check**:
   - Run `npm run build` (or the project's build script) to ensure no TS errors
   - Run `GetDiagnostics` for lint/type errors

## Risks

- **Risk — Empty staff list for a branch**: If a branch has zero assigned employees AND zero unassigned global employees, the dropdown becomes empty. 
  - **Handling**: The legacy custom-value fallback already preserves the current `staff` value, and the validation still accepts a manually typed name. Additionally we could show a disabled "No staff assigned to this branch" placeholder SelectItem. Given the scope of this change, the existing custom-value fallback is sufficient; we will document this behavior.

- **Risk — Historical transactions referencing cross-branch staff**: When viewing old transactions whose staff was from another branch, the staff filter display is not affected (TransactionsTable pulls `staffList` from transaction data, not from employee DB). Editing via AddSaleSheet would see the staff name preserved via the custom-value fallback. No data integrity issue.

- **Risk — Race with employees loading**: `useEmployees` loads asynchronously. The `activeStaff` / `branchScopedEmployees` memos already depend on `employees`, so they re-compute automatically when the employee list arrives. `currentBranchId` from `useBranch` also initializes asynchronously. Both pieces of state being async is handled correctly because `useMemo` re-runs whenever either dependency changes.

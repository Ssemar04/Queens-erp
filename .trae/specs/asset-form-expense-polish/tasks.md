# Tasks: Asset Form + Expense Form Polish + RBAC

Session: `asset-form-expense-polish`  
Approved: ⏳ Pending  
Total tasks: **10**

---

## T-1: AssetFormSheet — Add inline "+ category" button (FR-1, AC-1.1, AC-1.2, AC-1.4)

**Files touched:** `frontend/src/components/assets/AssetFormSheet.tsx`

**Steps:**
1. Import `TagPlus` from lucide-react (or `Plus` if TagPlus doesn't exist), plus `Button` + `Dialog*` from shared/ui (already imported? Confirm imports at L1-L22)
2. In the Category `Field` wrapper DIV around `label="Category"`: after the closing `</Select>` add `Button size="icon" variant="outline" onClick={() => setAddCatOpen(true)}` with tag icon
3. Gate the button: `{(isAdmin || isManager) && <Button>...</Button>}` — import `useRole` from hooks/useRole
4. Add `const [addCatOpen, setAddCatOpen] = useState(false);` near top of component BEFORE any conditional
5. Add `const [newCatName, setNewCatName] = useState("");`
6. Add `Dialog open={addCatOpen} onOpenChange={setAddCatOpen} after SheetFooter` — compact Dialog content: Label "New category name", Input, Cancel/Add buttons. Auto focus the Input. Submit on Enter key.

**AC verification:** Open AssetFormSheet. Admin/Manager sees + button next to category. Click → modal. Staff sees nothing or disabled.

---

## T-2: AssetFormSheet — Add-category submit logic & persistence (FR-1, AC-1.3, AC-1.5)

**Files touched:** `frontend/src/components/assets/AssetFormSheet.tsx`, `frontend/src/components/assets/assets-store.ts`

**Steps:**
1. In assets-store.ts: Add export function `mergeStoredCategories(): void` — reads `localStorage.getItem("qterp:asset-categories")` and pushes unique names to ASSET_CATEGORIES
2. Export also `saveCategory(name: string): boolean` — push to ASSET_CATEGORIES, dedupe, write to localStorage under "qterp:asset-categories"
3. Call `mergeStoredCategories()` at module top-level (after ASSET_CATEGORIES declaration) so at import it auto-seeds from localStorage
4. Back in AssetFormSheet: on "Add" click → call saveCategory(newCatName.trim()). Then set f.category = newName, then toast success, then close dialog.
5. **FR animation**: wrap Dialog content in `motion.div` initial opacity 0→1 spring, stagger 0.06s

**AC verification:** add "My new custom category → appears in Select; refresh page → still there; submit asset → DB stored in category column with that exact name.

---

## T-3: AssetFormSheet — Reorder — Staff dashed card AFTER Notes (FR-2, AC-2.1, AC-2.2)

**Files touched:** `frontend/src/components/assets/AssetFormSheet.tsx`

**Steps:**
1. Locate the staff dashed panel (L235-274 currently — after L226-L233: "Notes" Textarea. Move the `<div className="rounded-xl border-2 border-dashed…">…STAFF BLOCK…</div>` to be DOM AFTER notes closing div for Notes (Textarea). Ensure employee auto-select / manual fallback logic untouched (keep same exact JSX block — NO EDIT ONLY cut & paste only.
2. Verify DOM order final: Name → (Category, Serial) → (Model, Status) → Purchase → Meter → → Notes → **Staff → Footer Cancel/Submit.

**AC verification:** Screen-visible Staff dashed card visible AFTER Notes, BEFORE buttons.

---

## T-4: ExpenseFormSheet — Remove Department, Currency, Payment method fields (FR-3, AC-3.1, AC-3.2, AC-3.3)

**Files touched:** `frontend/src/components/expenses/ExpenseFormSheet.tsx`

**Steps:**
1. DELETE Department field row: `Field label="Department"` + the wrapping `<Select>…</Select>` block (L70-L75) — verify exact lines before editing)
2. DELETE Currency field row (L77-L82)
3. DELETE Payment method field row (L83-L95 entire block from Field wrapper)
4. In `mkInitial` (L150-168): KEEP `currency: "UGX"` and DELETE `department:` (L155-158 initial.department ?? DEPARTMENT_OPTIONS[0] and replace with hardcoded `department: ""`
5. In submit payload hardcode: always write `department: "",` regardless of UI; `currency: "UGX", `paymentMethod: "cash"` (hardcoded fixed, NOT UI-driven). **Never read f.department, f.currency, f.paymentMethod from form state anymore; overwrite them unconditionally.
6. Adjust grid layout: originally 4×2 grid 8 pairs → now leftover (Date, Type) (Employee, Amount) (Attachment) → Attachment span col-span-2.

---

## T-5: ExpenseFormSheet — Replace reimbursable Switch → radio group (FR-4, AC-4.1, AC-4.2)

**Files touched:** `frontend/src/components/expenses/ExpenseFormSheet.tsx`

**Steps:**
1. Import `RadioGroup`, `RadioGroupItem` if shadcn/ui/radio-group shim exists (check shadcn's RadioGroup import path — fallback if not present use Badge buttons). Fallback is fine: 2 `<button>`s of shape "Not Reimbursable / Reimbursable.
2. Delete current Switch block (L126-129). Replace with:
   ```tsx
   <div className="space-y-2">
     <Label>Reimbursable to employee</Label>
     <RadioGroup value={f.reimbursable ? "yes" : "no"} onValueChange={(v)=> setField("reimbursable", v === "yes")}>
       <div className="flex gap-2">
         <RadioGroupItem value="yes" label="Reimbursable" />
         <RadioGroupItem value="no" label="Not reimbursable" />
       </div>
     </RadioGroup>
   </div>
   ```
3. Wrap entire 2-item Flex group → animate entry: `motion.div` `initial opacity y-4→0 stagger 0.06/0.12 spring. Selected item → active tint `bg-[#003399]/10 ring-1 ring-[#003399]/30 text-[#003399] + CheckCircle2. Inactive → CircleIcon.

**AC verification:** radio clicks set `reimbursable` boolean correctly; submit → write to backend DB reimbursable: 1|0.

---

## T-6: Backend RBAC — decide + reimburse endpoints upgrade to require_manager_user (FR-5.1 FR-5.2 AC-5.1 AC-5.2)

**Files touched:** `backend/routes/expenses_routes.py`

**Steps:**
1. Line 25 existing import line: from `from routes.guards import require_current_user → add `require_manager_user` to import list.
2. L144 `def decide_expense(...)` → replace `user, error = require_current_user()` with `user, error = require_manager_user()`. If error tuple → return error (403 with "Manager or Administrator access required").
3. L161 `def reimburse_expense(...)` → same replacement: `require_manager_user()`.
4. Continue to `services/decide` call unchanged.

---

## T-7: Backend RBAC — validate_expense_payload: staff cannot force status=approved (FR-5.3 AC-5.3)

**Files touched:** `backend/routes/expenses_routes.py`

**Steps:**
1. Inside `validate_expense_payload` function (L175-197). Add at the very TOP after retrieving user from `get_current_user()`. Check if payload contains `"status"` key == "approved" or "rejected" AND user.role ∉ {"admin","manager". If true → return (False, message, 403).
2. Also: `validate_expense_payload return type check → return this error message consistent message ("Only Manager or Administrator may approve/reject expenses").
3. Keep the rest of validation rules (line175-197 untouched.

---

## T-8: Frontend ExpensesTable role gate + correct actor (FR-5d/5e AC-5.4 AC-5.5)

**Files touched:** `frontend/src/components/expenses/ExpensesTable.tsx`, `frontend/src/routes/app.expenses.tsx`

**Steps:**
1. ExpensesTable: import `useRole` from hooks. `const { isAdmin, isManager } = useRole();` top of component BEFORE conditionals.
2. Wrap DropdownMenuItems Approve/Reject L148-149:
   ```tsx
   {(isAdmin || isManager) && (
     <>
       <DropdownMenuItem …>Approve</DropdownMenuItem>
       <DropdownMenuItem …>Reject</DropdownMenuItem>
     </>
   )}
   ```
3. app.expenses.tsx: import `useAuth` → `const { user } = useAuth();` → onDecide L114 → actor = `user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Unknown" → pass as 3rd arg to decideExpense(id, d, actor, note).

---

## T-9: Lint + build passes (NFR-3 AC-7.2)

**Verification:**
- Run: `GetDiagnostics` for TS/ESLint → 0 errors.
- Frontend `cd frontend ; npm run build` → exit 0.
- Backend `cd backend; python -m py_compile routes/expenses_routes.py services/expenses_service.py routes/guards.py → exit 0.

---

## T-10: Manual spec-level AC checklist (FR + Rubrics AC-1 through AC-8)

**Execute after T1-T9 passing → walkthrough:
1. Open Asset form admin → category add visible?
2. Add custom category → appears persists refresh?
3. Staff dashed card After Notes?
4. Expense form → no dept/curr/paymentmethod? submitted→ UGX/cash/""?
5. reimbursable radio bools work?
6. Staff → no Approve/Reject in dropdown, 403 on curl /decision?
7. Admin → can approve, approved_by real name?
8. Rubric score (0-2) scored for 8.1/8.2/8.3

---

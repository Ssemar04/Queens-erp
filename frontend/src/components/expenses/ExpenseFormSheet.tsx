import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { getEmployees, type Employee as StaffMember } from "@/services/api";
import { type Expense, type ExpenseStatus, type ExpenseType, type RecurringFreq } from "./expenses-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Expense | null;
  onSubmit: (data: Omit<Expense, "id" | "reference" | "createdAt">) => void | Promise<Expense | void>;
  staffMembers?: StaffMember[];
}

const DEFAULT_CATEGORIES = [
  { value: "employee", label: "Staff Expense" },
  { value: "travel", label: "Travel" },
  { value: "recurring", label: "Recurring" },
  { value: "operations", label: "Operations" },
  { value: "utilities", label: "Utilities" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "maintenance", label: "Maintenance" },
  { value: "marketing", label: "Marketing" },
  { value: "consulting", label: "Consulting & Services" },
  { value: "software", label: "IT & Software" },
];

const TODAY = () => new Date().toISOString().slice(0, 10);

export function ExpenseFormSheet({ open, onOpenChange, initial, onSubmit, staffMembers: propStaff }: Props) {
  const [form, setForm] = useState(() => mkInitial(initial));
  const [staffList, setStaffList] = useState<StaffMember[]>(propStaff || []);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");

  useEffect(() => {
    setForm(mkInitial(initial));
  }, [initial, open]);

  useEffect(() => {
    if (propStaff && propStaff.length > 0) {
      setStaffList(propStaff);
    } else {
      getEmployees()
        .then((data) => {
          if (Array.isArray(data)) setStaffList(data);
        })
        .catch(() => {});
    }
  }, [propStaff, open]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleAddCategory = () => {
    const trimmed = customCatInput.trim();
    if (!trimmed) return;
    const catValue = trimmed.toLowerCase().replace(/\s+/g, "_");
    if (!categories.some((c) => c.value === catValue)) {
      setCategories((prev) => [...prev, { value: catValue, label: trimmed }]);
    }
    update("type", catValue as ExpenseType);
    setCustomCatInput("");
    setAddCatOpen(false);
  };

  const submit = (status: ExpenseStatus) => {
    onSubmit({
      date: form.date,
      type: form.type,
      employee: form.employee.trim() || "Unassigned Staff",
      department: "",
      amount: Number(form.amount) || 0,
      currency: "UGX",
      paymentMethod: "cash",
      description: form.description.trim(),
      attachment: null,
      status,
      reimbursable: false,
      reimbursed: false,
      approvedBy: null,
      rejectedReason: null,
      recurring: form.type === "recurring" ? { frequency: form.recurringFreq, nextRun: form.nextRun } : null,
      travel: form.type === "travel" ? { destination: form.destination, purpose: form.purpose, mileage: Number(form.mileage) || 0 } : null,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{initial ? "Edit expense" : "New expense"}</SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </Field>

              <Field label="Category">
                <div className="flex items-center gap-1.5">
                  <Select value={form.type} onValueChange={(v) => update("type", v as ExpenseType)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => setAddCatOpen(true)}
                    title="Add custom category"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Field>

              <Field label="Staff">
                <Select value={form.employee} onValueChange={(v) => update("employee", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.length === 0 ? (
                      <SelectItem value={form.employee || "Unassigned"}>
                        {form.employee || "Unassigned"}
                      </SelectItem>
                    ) : (
                      staffList.map((s) => (
                        <SelectItem key={s.id || s.name} value={s.name}>
                          {s.name} {s.role ? `(${s.role})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Amount">
                <Input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Enter details regarding this expense..." />
            </Field>

            {form.type === "travel" && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Field label="Destination"><Input value={form.destination} onChange={(e) => update("destination", e.target.value)} /></Field>
                <Field label="Purpose"><Input value={form.purpose} onChange={(e) => update("purpose", e.target.value)} /></Field>
                <Field label="Mileage (km)"><Input type="number" value={form.mileage} onChange={(e) => update("mileage", e.target.value)} /></Field>
              </div>
            )}

            {form.type === "recurring" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <Field label="Frequency">
                  <Select value={form.recurringFreq} onValueChange={(v) => update("recurringFreq", v as RecurringFreq)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Next run"><Input type="date" value={form.nextRun} onChange={(e) => update("nextRun", e.target.value)} /></Field>
              </motion.div>
            )}
          </div>

          <div className="mt-6 flex gap-1.5">
            <Button variant="outline" className="flex-1" onClick={() => submit("draft")}>Save draft</Button>
            <Button className="flex-1" onClick={() => submit("submitted")}>Submit for approval</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category Name</Label>
            <Input
              value={customCatInput}
              onChange={(e) => setCustomCatInput(e.target.value)}
              placeholder="e.g. Legal Fees, Equipment, Fleet Fuel..."
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCatOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} disabled={!customCatInput.trim()}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function mkInitial(initial?: Expense | null) {
  return {
    date: initial?.date ?? TODAY(),
    type: (initial?.type ?? "employee") as ExpenseType,
    employee: initial?.employee ?? "",
    department: "",
    amount: initial ? String(initial.amount) : "",
    currency: "UGX",
    paymentMethod: "cash",
    description: initial?.description ?? "",
    destination: initial?.travel?.destination ?? "",
    purpose: initial?.travel?.purpose ?? "",
    mileage: initial ? String(initial.travel?.mileage ?? 0) : "0",
    recurringFreq: (initial?.recurring?.frequency ?? "monthly") as RecurringFreq,
    nextRun: initial?.recurring?.nextRun ?? TODAY(),
  };
}


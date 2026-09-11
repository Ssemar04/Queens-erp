import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEPARTMENT_OPTIONS, type Expense, type ExpensePaymentMethod, type ExpenseStatus, type ExpenseType, type RecurringFreq } from "./expenses-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Expense | null;
  onSubmit: (data: Omit<Expense, "id" | "reference" | "createdAt">) => void | Promise<Expense | void>;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export function ExpenseFormSheet({ open, onOpenChange, initial, onSubmit }: Props) {
  const [form, setForm] = useState(() => mkInitial(initial));

  useEffect(() => { setForm(mkInitial(initial)); }, [initial, open]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const submit = (status: ExpenseStatus) => {
    onSubmit({
      date: form.date,
      type: form.type,
      employee: form.employee.trim() || "Unassigned",
      department: form.department,
      amount: Number(form.amount) || 0,
      currency: form.currency,
      paymentMethod: form.paymentMethod,
      description: form.description.trim(),
      attachment: form.attachment.trim() || null,
      status,
      reimbursable: form.reimbursable,
      reimbursed: false,
      approvedBy: null,
      rejectedReason: null,
      recurring: form.type === "recurring" ? { frequency: form.recurringFreq, nextRun: form.nextRun } : null,
      travel: form.type === "travel" ? { destination: form.destination, purpose: form.purpose, mileage: Number(form.mileage) || 0 } : null,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit expense" : "New expense"}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => update("type", v as ExpenseType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employee"><Input value={form.employee} onChange={(e) => update("employee", e.target.value)} placeholder="Full name" /></Field>
            <Field label="Department">
              <Select value={form.department} onValueChange={(v) => update("department", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENT_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} /></Field>
            <Field label="Currency">
              <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["UGX", "USD", "EUR", "GBP", "TZS"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment method">
              <Select value={form.paymentMethod} onValueChange={(v) => update("paymentMethod", v as ExpensePaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Personal card</SelectItem>
                  <SelectItem value="company_card">Company card</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="mobile">Mobile money</SelectItem>
                  <SelectItem value="petty_cash">Petty cash</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Attachment"><Input value={form.attachment} onChange={(e) => update("attachment", e.target.value)} placeholder="receipt.pdf" /></Field>
          </div>

          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>

          {form.type === "travel" && (
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Field label="Destination"><Input value={form.destination} onChange={(e) => update("destination", e.target.value)} /></Field>
              <Field label="Purpose"><Input value={form.purpose} onChange={(e) => update("purpose", e.target.value)} /></Field>
              <Field label="Mileage (km)"><Input type="number" value={form.mileage} onChange={(e) => update("mileage", e.target.value)} /></Field>
            </div>
          )}

          {form.type === "recurring" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3">
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
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <Label className="text-sm">Reimbursable to employee</Label>
            <Switch checked={form.reimbursable} onCheckedChange={(v) => update("reimbursable", v)} />
          </div>
        </div>

        <div className="mt-6 flex gap-1.5">
          <Button variant="outline" className="flex-1" onClick={() => submit("draft")}>Save draft</Button>
          <Button className="flex-1" onClick={() => submit("submitted")}>Submit for approval</Button>
        </div>
      </SheetContent>
    </Sheet>
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
    department: initial?.department ?? DEPARTMENT_OPTIONS[0],
    amount: initial ? String(initial.amount) : "",
    currency: initial?.currency ?? "UGX",
    paymentMethod: (initial?.paymentMethod ?? "card") as ExpensePaymentMethod,
    description: initial?.description ?? "",
    attachment: initial?.attachment ?? "",
    reimbursable: initial?.reimbursable ?? false,
    destination: initial?.travel?.destination ?? "",
    purpose: initial?.travel?.purpose ?? "",
    mileage: initial ? String(initial.travel?.mileage ?? 0) : "0",
    recurringFreq: (initial?.recurring?.frequency ?? "monthly") as RecurringFreq,
    nextRun: initial?.recurring?.nextRun ?? TODAY(),
  };
}

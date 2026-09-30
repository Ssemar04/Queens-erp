import { useEffect, useMemo, useState } from "react";
import { Calendar, Hash, Wallet, FileText, CheckCircle2, User } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/components/employees/employees-store";
import { useBranch } from "@/contexts/BranchContext";
import { balance, type LedgerEntry, type Payment } from "./ledger-store";

interface Props {
  entry: LedgerEntry | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPay: (id: string, payment: Payment) => Promise<void>;
}

export function PaymentSheet({ entry, open, onOpenChange, onPay }: Props) {
  if (!entry) return null;
  return <PaymentSheetBody entry={entry} open={open} onOpenChange={onOpenChange} onPay={onPay} />;
}

function PaymentSheetBody({
  entry, open, onOpenChange, onPay,
}: Props & { entry: NonNullable<Props["entry"]> }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<Payment["method"]>("mpesa");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { employees } = useEmployees();
  const { currentBranchId } = useBranch();

  const branchStaff = useMemo(
    () =>
      employees.filter((e) => {
        const statusOk =
          !e.status ||
          e.status.toLowerCase() === "active" ||
          e.status.toLowerCase() === "probation";
        if (!statusOk) return false;
        if (!currentBranchId) return true;
        return e.branchId === currentBranchId || !e.branchId;
      }),
    [employees, currentBranchId],
  );

  const selectedStaff = branchStaff.find((e) => e.id === staffId) ?? null;

  useEffect(() => {
    if (open && entry) {
      setAmount(String(balance(entry)));
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("mpesa");
      setReference("");
      setNote("");
      setStaffId("");
      setSubmitting(false);
    }
  }, [open, entry]);

  const bal = balance(entry);
  const num = Number(amount);
  const valid = num > 0 && num <= bal + 0.01 && !submitting;

  async function submit() {
    if (!entry || !valid || submitting) return;
    setSubmitting(true);
    try {
      await onPay(entry.id, {
        id: crypto.randomUUID(),
        date,
        amount: num,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        receivedBy: selectedStaff?.name || undefined,
        staffId: selectedStaff?.id || undefined,
      });
      toast.success(
        entry.kind === "debtor"
          ? `Received UGX ${num.toLocaleString()} payment from ${entry.partyName}`
          : `Recorded UGX ${num.toLocaleString()} payment to ${entry.partyName}`
      );
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Could not record payment";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const action = entry.kind === "debtor" ? "Receive payment" : "Record payment";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[460px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {action}
          </SheetTitle>
          <SheetDescription className="text-xs font-mono">
            {entry.reference} · {entry.partyName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs text-blue-800">
              <span>Total Amount</span>
              <span className="font-mono font-medium">UGX {entry.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-blue-800">
              <span>Amount Paid</span>
              <span className="font-mono font-medium text-emerald-700">UGX {entry.paid.toLocaleString()}</span>
            </div>
            <div className="pt-1 flex justify-between text-sm font-bold border-t border-blue-200/80">
              <span className="text-blue-950">Outstanding Balance</span>
              <span className="font-mono text-primary">UGX {bal.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount to pay (UGX)" icon={Hash}>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={bal}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Payment date" icon={Calendar}>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-xs"
              />
            </Field>
          </div>

          <Field label="Payment method" icon={Wallet}>
            <Select value={method} onValueChange={(v) => setMethod(v as Payment["method"])}>
              <SelectTrigger className="text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">Mobile Money (MTN / Airtel)</SelectItem>
                <SelectItem value="bank">Bank Transfer / EFT / RTGS</SelectItem>
                <SelectItem value="cash">Cash Payment</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Credit / Debit Card</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Received by (staff)" icon={User}>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="text-xs bg-white">
                <SelectValue placeholder={branchStaff.length ? "Select staff" : "No staff in this branch"} />
              </SelectTrigger>
              <SelectContent>
                {branchStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.role ? ` · ${s.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Reference / Transaction ID" icon={FileText}>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. M-PESA Ref / Cheque No / Bank Slip"
              className="font-mono text-xs"
            />
          </Field>

          <Field label="Note" icon={FileText}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional remark for internal records..."
              rows={2}
              className="text-xs"
            />
          </Field>

          {entry.payments.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Payment History ({entry.payments.length})</span>
                <span className="text-[10px] text-emerald-600 font-mono">Synced to database</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {entry.payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                    <div>
                      <span className="font-semibold text-foreground">{p.method.toUpperCase()}</span>
                      {p.reference && <span className="font-mono text-[11px] text-muted-foreground ml-1.5">({p.reference})</span>}
                      <span className="block text-[10px] text-muted-foreground">{p.date}</span>
                      {p.receivedBy && (
                        <span className="block text-[10px] text-muted-foreground">by {p.receivedBy}</span>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-emerald-700">+UGX {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>
            {submitting ? "Posting payment..." : action}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label, icon: Icon, children,
}: { label: string; icon: typeof Hash; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      {children}
    </label>
  );
}

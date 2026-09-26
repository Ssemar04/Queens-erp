import { useEffect, useState } from "react";
import { Calendar, Hash, Wallet, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  useEffect(() => {
    if (open && entry) {
      setAmount(String(balance(entry)));
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("mpesa");
      setReference("");
      setNote("");
    }
  }, [open, entry]);

  const bal = balance(entry);
  const num = Number(amount);
  const valid = num > 0 && num <= bal;

  async function submit() {
    if (!entry || !valid) return;
    try {
      await onPay(entry.id, {
        id: crypto.randomUUID(),
        date,
        amount: num,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      onOpenChange(false);
    } catch {
      toast.error("Could not record payment");
    }
  }

  const action = entry.kind === "debtor" ? "Receive payment" : "Record payment";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[460px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{action}</SheetTitle>
          <SheetDescription>
            {entry.reference} · {entry.partyName}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Total</span>
              <span className="font-mono">UGX {entry.amount.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Paid</span>
              <span className="font-mono">UGX {entry.paid.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm font-medium">
              <span>Balance</span>
              <span className="font-mono text-foreground">UGX {bal.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" icon={Hash}>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={bal}
              />
            </Field>
            <Field label="Date" icon={Calendar}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Method" icon={Wallet}>
            <Select value={method} onValueChange={(v) => setMethod(v as Payment["method"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Reference" icon={Hash}>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN-…" />
          </Field>

          <Field label="Note" icon={FileText}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>

          {entry.payments.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Recent payments</div>
              <div className="space-y-1">
                {entry.payments.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded border border-border bg-white px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-muted-foreground">
                      {p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ""}
                    </span>
                    <span className="font-mono">UGX {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>{action}</Button>
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

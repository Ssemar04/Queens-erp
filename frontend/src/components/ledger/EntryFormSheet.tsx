import { useEffect, useState } from "react";
import { Calendar, FileText, User, Tag, Hash } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type LedgerEntry, type LedgerKind } from "./ledger-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: LedgerKind;
  nextRef: string;
  onCreate: (e: LedgerEntry) => Promise<void>;
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function EntryFormSheet({ open, onOpenChange, kind, nextRef, onCreate }: Props) {
  const partyLabel = kind === "debtor" ? "Customer" : "Supplier";
  const refLabel = kind === "debtor" ? "Invoice #" : "Bill #";
  const theirRefLabel = kind === "debtor" ? "Customer quotation / LPO" : "Supplier invoice / PO";

  const [ref, setRef] = useState(nextRef);
  const [partyName, setPartyName] = useState("");
  const [partyRef, setPartyRef] = useState("");
  const [issueDate, setIssue] = useState(today());
  const [dueDate, setDue] = useState(plusDays(30));
  const [amount, setAmount] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setRef(nextRef);
      setPartyName("");
      setPartyRef("");
      setIssue(today());
      setDue(plusDays(30));
      setAmount("");
      setTags("");
      setNotes("");
    }
  }, [open, nextRef]);

  const valid = ref.trim() && partyName.trim() && amount && Number(amount) > 0 && dueDate;

  async function submit() {
    if (!valid) return;
    await onCreate({
      id: crypto.randomUUID(),
      kind,
      reference: ref.trim(),
      partyName: partyName.trim(),
      partyRef: partyRef.trim() || undefined,
      issueDate,
      dueDate,
      amount: Number(amount),
      currency: "UGX",
      paid: 0,
      status: "open",
      payments: [],
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New {kind === "debtor" ? "invoice" : "bill"}</SheetTitle>
          <SheetDescription>
            {kind === "debtor"
              ? "Record an invoice owed to you by a customer."
              : "Record a bill you owe to a supplier."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={refLabel} icon={Hash}>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Issue date" icon={Calendar}>
              <Input type="date" value={issueDate} onChange={(e) => setIssue(e.target.value)} />
            </Field>
          </div>

          <Field label={partyLabel} icon={User}>
            <Input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder={kind === "debtor" ? "e.g. Acme Holdings Ltd" : "e.g. Global Supplies Co"}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={theirRefLabel} icon={FileText}>
              <Input
                value={partyRef}
                onChange={(e) => setPartyRef(e.target.value)}
                placeholder="optional"
                className="font-mono"
              />
            </Field>
            <Field label="Due date" icon={Calendar}>
              <Input type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (UGX)" icon={Hash}>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Tags (comma sep.)" icon={Tag}>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="retail, project" />
            </Field>
          </div>

          <Field label="Notes" icon={FileText}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note (optional)"
              rows={3}
            />
          </Field>
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>
            Create {kind === "debtor" ? "invoice" : "bill"}
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

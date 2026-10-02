import { useEffect, useState } from "react";
import { Calendar, FileText, User, Tag, Hash, Building2, AlertCircle } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getCustomers, getSuppliers, type Customer } from "@/services/api";
import type { Supplier } from "@/types/inventory";
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
  const [submitting, setSubmitting] = useState(false);

  // Database party lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("custom");

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
      setSelectedPartyId("custom");
      setSubmitting(false);

      if (kind === "debtor") {
        getCustomers().then(setCustomers).catch(() => setCustomers([]));
      } else {
        getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
      }
    }
  }, [open, nextRef, kind]);

  const handleSelectParty = (val: string) => {
    setSelectedPartyId(val);
    if (val === "custom") {
      setPartyName("");
      setPartyRef("");
      return;
    }
    if (kind === "debtor") {
      const found = customers.find((c) => c.id === val);
      if (found) {
        setPartyName(found.name);
        setPartyRef(found.reference || found.id);
      }
    } else {
      const found = suppliers.find((s) => s.id === val);
      if (found) {
        setPartyName(found.name);
        setPartyRef(found.code || found.contactName || found.id);
      }
    }
  };

  const selectedCustomerObj = kind === "debtor" ? customers.find((c) => c.id === selectedPartyId) : undefined;
  const valid = ref.trim() && partyName.trim() && amount && Number(amount) > 0 && dueDate && !submitting;

  async function submit() {
    if (!valid) return;
    setSubmitting(true);
    try {
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
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            New {kind === "debtor" ? "debtor invoice" : "creditor bill"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {kind === "debtor"
              ? "Post a new receivable invoice to the database for tracking customer payments."
              : "Post a new payable bill to the database for tracking supplier payments."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={refLabel} icon={Hash}>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono text-xs" />
            </Field>
            <Field label="Issue date" icon={Calendar}>
              <Input type="date" value={issueDate} onChange={(e) => setIssue(e.target.value)} className="text-xs" />
            </Field>
          </div>

          <Field label={`Select ${partyLabel} from database`} icon={User}>
            <Select value={selectedPartyId} onValueChange={handleSelectParty}>
              <SelectTrigger className="text-xs bg-white">
                <SelectValue placeholder={`Choose ${partyLabel.toLowerCase()}...`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">-- Custom / Manual Entry --</SelectItem>
                {kind === "debtor"
                  ? customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.reference || c.phone || "Customer"})
                      </SelectItem>
                    ))
                  : suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code || s.category || s.contactName || "Supplier"})
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </Field>

          {selectedCustomerObj && (
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 text-xs text-blue-900 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span>{selectedCustomerObj.name}</span>
                <Badge variant="outline" className="bg-white text-blue-800 text-[10px]">
                  {selectedCustomerObj.stage.toUpperCase()}
                </Badge>
              </div>
              <div className="text-[11px] text-blue-700 flex gap-4">
                <span>Ref: <span className="font-mono">{selectedCustomerObj.reference}</span></span>
                <span>Outstanding: <span className="font-mono font-medium">UGX {(selectedCustomerObj.outstandingBalance || 0).toLocaleString()}</span></span>
              </div>
            </div>
          )}

          <Field label={`${partyLabel} Name`} icon={User}>
            <Input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder={kind === "debtor" ? "e.g. Acme Holdings Ltd" : "e.g. Global Supplies Co"}
              className="text-xs"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={theirRefLabel} icon={FileText}>
              <Input
                value={partyRef}
                onChange={(e) => setPartyRef(e.target.value)}
                placeholder="optional"
                className="font-mono text-xs"
              />
            </Field>
            <Field label="Due date" icon={Calendar}>
              <Input type="date" value={dueDate} onChange={(e) => setDue(e.target.value)} className="text-xs" />
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
                className="text-xs font-mono"
              />
            </Field>
            <Field label="Tags (comma sep.)" icon={Tag}>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="retail, project" className="text-xs" />
            </Field>
          </div>

          <Field label="Notes" icon={FileText}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note (optional)"
              rows={3}
              className="text-xs"
            />
          </Field>
        </div>

        <SheetFooter className="mt-6 flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>
            {submitting ? "Posting to database..." : `Post ${kind === "debtor" ? "Invoice" : "Bill"}`}
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

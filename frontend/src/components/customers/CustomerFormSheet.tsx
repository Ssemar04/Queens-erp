import { useEffect, useState } from "react";
import { Building2, User as UserIcon, Mail, Phone, MapPin, Briefcase, CreditCard } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Customer, CustomerType } from "./customers-store";
import { nextDatabaseReference, nextReference } from "./customers-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: Customer[];
  editing?: Customer | null;
  onSave: (c: Customer) => void | Promise<void>;
  saving?: boolean;
}

const blank = (ref: string): Customer => ({
  id: crypto.randomUUID(),
  reference: ref,
  name: "",
  type: "company",
  stage: "lead",
  tier: "bronze",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Uganda",
  industry: "",
  contactPerson: "",
  salesRep: "",
  paymentTerms: "postpaid",
  creditLimit: 0,
  outstandingBalance: 0,
  lifetimeValue: 0,
  totalOrders: 0,
  avgOrderValue: 0,
  loyaltyPoints: 0,
  tags: [],
  notes: "",
  interactions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function CustomerFormSheet({ open, onOpenChange, existing, editing, onSave, saving = false }: Props) {
  const [c, setC] = useState<Customer>(blank(nextReference(existing)));
  const [tagsInput, setTagsInput] = useState("");
  const [referenceTouched, setReferenceTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (editing) {
      setC(editing);
      setTagsInput(editing.tags.join(", "));
      setReferenceTouched(true);
    } else {
      const fallback = blank(nextReference(existing));
      setC(fallback);
      setTagsInput("");
      setReferenceTouched(false);
      nextDatabaseReference(existing).then((reference) => {
        if (!cancelled) setC((current) => ({ ...current, reference }));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [open, editing, existing]);

  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  function submit() {
    if (!c.name.trim()) return;
    onSave({
      ...c,
      name: c.name.trim(),
      email: c.email.trim(),
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      autoReference: !editing && !referenceTouched,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit customer" : "New customer"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update customer details." : `Reference ${c.reference} · creates a 360° contact record.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" icon={c.type === "company" ? Building2 : UserIcon}>
              <Select value={c.type} onValueChange={(v) => set("type", v as CustomerType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference" icon={Briefcase}>
              <Input
                value={c.reference}
                onChange={(e) => {
                  setReferenceTouched(true);
                  set("reference", e.target.value);
                }}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label={c.type === "company" ? "Company name" : "Full name"} icon={Building2}>
            <Input value={c.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Acme Holdings Ltd" />
          </Field>

          {c.type === "company" && (
            <Field label="Contact person" icon={UserIcon}>
              <Input
                value={c.contactPerson || ""}
                onChange={(e) => set("contactPerson", e.target.value)}
                placeholder="Primary contact"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" icon={Mail}>
              <Input type="email" value={c.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone" icon={Phone}>
              <Input value={c.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>

          <Field label="Address" icon={MapPin}>
            <Input value={c.address} onChange={(e) => set("address", e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><Input value={c.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Country"><Input value={c.country} onChange={(e) => set("country", e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry"><Input value={c.industry} onChange={(e) => set("industry", e.target.value)} /></Field>
            <Field label="Sales rep"><Input value={c.salesRep} onChange={(e) => set("salesRep", e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment terms" icon={CreditCard}>
              <Select value={c.paymentTerms} onValueChange={(v) => set("paymentTerms", v as Customer["paymentTerms"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="postpaid">Postpaid</SelectItem>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  {c.paymentTerms && !["postpaid", "prepaid"].includes(c.paymentTerms) && (
                    <SelectItem value={c.paymentTerms}>
                      {c.paymentTerms.replace("_", " ").toUpperCase()}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Loyalty points">
              <Input
                type="number"
                value={c.loyaltyPoints}
                onChange={(e) => set("loyaltyPoints", parseInt(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Credit limit (UGX)">
              <Input
                type="number"
                value={c.creditLimit}
                onChange={(e) => set("creditLimit", parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Tax ID">
              <Input value={c.taxId || ""} onChange={(e) => set("taxId", e.target.value)} />
            </Field>
          </div>

          <Field label="Tags (comma separated)">
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="vip, recurring, coast" />
          </Field>

          <Field label="Internal notes">
            <Textarea value={c.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </Field>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!c.name.trim() || saving}>
            {saving ? "Saving..." : editing ? "Save changes" : "Create customer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </Label>
      {children}
    </div>
  );
}

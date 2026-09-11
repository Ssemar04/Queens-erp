import { useState, useEffect, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Asset, AssetStatus, AssetCondition, MeterUnit } from "./assets-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Asset | null;
  onSubmit: (a: AssetDraft) => void;
  onUpdate?: (id: string, patch: Partial<Asset>) => void;
}

type AssetDraft = Omit<Asset, "id" | "tag" | "createdAt" | "updatedAt" | "meterReadings" | "services" | "income">;

const CATEGORIES = ["Vehicle", "Generator", "Machinery", "IT", "Furniture", "Equipment", "Building"];
const UNITS: MeterUnit[] = ["km", "hours", "kwh", "litres", "cycles", "pages"];

export function AssetFormSheet({ open, onOpenChange, initial, onSubmit, onUpdate }: Props) {
  const [f, setF] = useState<AssetDraft>({
    name: "", category: "Equipment", serialNumber: "", manufacturer: "", model: "",
    location: "Headquarters", assignedTo: "Operations",
    purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: 0, salvageValue: 0, usefulLifeYears: 5,
    status: "active", condition: "good",
    meterUnit: "km", serviceIntervalMeter: 5000, serviceIntervalDays: 90,
    notes: "",
  });

  useEffect(() => {
    if (initial) {
      const { id: _i, tag: _t, createdAt: _c, updatedAt: _u, meterReadings: _r, services: _s, income: _in, ...rest } = initial;
      setF(rest);
    }
  }, [initial]);

  function submit() {
    if (!f.name.trim()) return;
    if (initial && onUpdate) onUpdate(initial.id, f);
    else onSubmit(f);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>{initial ? "Edit asset" : "New asset"}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <Field label="Asset name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Toyota Hilux · KCA 442X" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Serial number"><Input value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></Field>
            <Field label="Manufacturer"><Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Field>
            <Field label="Model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
            <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
            <Field label="Assigned to"><Input value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase date"><Input type="date" value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} /></Field>
            <Field label="Useful life (years)"><Input type="number" value={f.usefulLifeYears} onChange={(e) => setF({ ...f, usefulLifeYears: Number(e.target.value) })} /></Field>
            <Field label="Purchase cost (UGX)"><Input type="number" value={f.purchaseCost} onChange={(e) => setF({ ...f, purchaseCost: Number(e.target.value) })} /></Field>
            <Field label="Salvage value (UGX)"><Input type="number" value={f.salvageValue} onChange={(e) => setF({ ...f, salvageValue: Number(e.target.value) })} /></Field>
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as AssetStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condition">
              <Select value={f.condition} onValueChange={(v) => setF({ ...f, condition: v as AssetCondition })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Meter unit">
              <Select value={f.meterUnit} onValueChange={(v) => setF({ ...f, meterUnit: v as MeterUnit })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Service every (meter)"><Input type="number" value={f.serviceIntervalMeter} onChange={(e) => setF({ ...f, serviceIntervalMeter: Number(e.target.value) })} /></Field>
            <Field label="Service every (days)"><Input type="number" value={f.serviceIntervalDays} onChange={(e) => setF({ ...f, serviceIntervalDays: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warranty expiry"><Input type="date" value={f.warrantyExpiry ?? ""} onChange={(e) => setF({ ...f, warrantyExpiry: e.target.value })} /></Field>
            <Field label="Insurance expiry"><Input type="date" value={f.insuranceExpiry ?? ""} onChange={(e) => setF({ ...f, insuranceExpiry: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit}>{initial ? "Save changes" : "Create asset"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

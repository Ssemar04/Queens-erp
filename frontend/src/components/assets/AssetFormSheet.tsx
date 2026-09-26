import { useState, useEffect, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getEmployees, type Employee } from "@/services/api";
import { ASSET_CATEGORIES, isStandardAssetCategory, type Asset, type AssetStatus, type MeterUnit } from "./assets-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Asset | null;
  onSubmit: (a: AssetDraft) => void;
  onUpdate?: (id: string, patch: Partial<Asset>) => void;
}

export type AssetDraft = Omit<
  Asset,
  "id" | "tag" | "createdAt" | "updatedAt" | "meterReadings" | "services" | "income"
>;

const UNITS: MeterUnit[] = ["km", "hours", "kwh", "litres", "cycles", "pages"];

export function AssetFormSheet({ open, onOpenChange, initial, onSubmit, onUpdate }: Props) {
  const [staffList, setStaffList] = useState<Employee[]>([]);

  const [f, setF] = useState<AssetDraft>({
    name: "",
    category: ASSET_CATEGORIES[0],
    serialNumber: "",
    model: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: 0,
    usefulLifeYears: 5,
    status: "active",
    meterUnit: "km",
    serviceIntervalMeter: 5000,
    serviceIntervalDays: 90,
    staff: "",
    warrantyExpiry: "",
    notes: "",
    consumables: [],
    monthlyTargets: [],
  });

  useEffect(() => {
    getEmployees()
      .then((data) => {
        if (Array.isArray(data)) setStaffList(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initial) {
      const {
        id: _i, tag: _t, createdAt: _c, updatedAt: _u, meterReadings: _r, services: _s, income: _in,
        ...rest
      } = initial;
      const staffVal = initial.staff || "";
      setF({
        ...rest,
        staff: staffVal,
        consumables: initial.consumables || [],
        monthlyTargets: initial.monthlyTargets || [],
      });
    } else {
      setF({
        name: "",
        category: ASSET_CATEGORIES[0],
        serialNumber: "",
        model: "",
        purchaseDate: new Date().toISOString().slice(0, 10),
        purchaseCost: 0,
        usefulLifeYears: 5,
        status: "active",
        meterUnit: "km",
        serviceIntervalMeter: 5000,
        serviceIntervalDays: 90,
        staff: "",
        warrantyExpiry: "",
        notes: "",
        consumables: [],
        monthlyTargets: [],
      });
    }
  }, [initial, open]);

  function submit() {
    if (!f.name.trim()) {
      toast.error("Asset name is required");
      return;
    }
    if (initial && onUpdate) onUpdate(initial.id, { ...f });
    else onSubmit({ ...f });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{initial ? "Edit asset" : "New asset"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Field label="Asset name">
              <Input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                placeholder="e.g. Toyota Hilux · KCA 442X"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    {initial && initial.category && !isStandardAssetCategory(initial.category) && (
                      <SelectItem key={initial.category} value={initial.category} disabled>
                        {initial.category} (legacy)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Serial number">
                <Input
                  value={f.serialNumber}
                  onChange={(e) => setF({ ...f, serialNumber: e.target.value })}
                  placeholder="SN-XXXX-XXXX"
                />
              </Field>

              <Field label="Model">
                <Input
                  value={f.model}
                  onChange={(e) => setF({ ...f, model: e.target.value })}
                  placeholder="e.g. 2024 Double Cab"
                />
              </Field>

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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Purchase date">
                <Input
                  type="date"
                  value={f.purchaseDate}
                  onChange={(e) => setF({ ...f, purchaseDate: e.target.value })}
                />
              </Field>
              <Field label="Purchase cost (UGX)">
                <Input
                  type="number"
                  value={f.purchaseCost}
                  onChange={(e) => setF({ ...f, purchaseCost: Number(e.target.value) })}
                />
              </Field>
              <Field label="Useful life (years)">
                <Input
                  type="number"
                  value={f.usefulLifeYears}
                  onChange={(e) => setF({ ...f, usefulLifeYears: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Meter unit">
                <Select value={f.meterUnit} onValueChange={(v) => setF({ ...f, meterUnit: v as MeterUnit })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Service every (meter)">
                <Input
                  type="number"
                  value={f.serviceIntervalMeter}
                  onChange={(e) => setF({ ...f, serviceIntervalMeter: Number(e.target.value) })}
                />
              </Field>
              <Field label="Service every (days)">
                <Input
                  type="number"
                  value={f.serviceIntervalDays}
                  onChange={(e) => setF({ ...f, serviceIntervalDays: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Warranty expiry">
              <Input
                type="date"
                value={f.warrantyExpiry ?? ""}
                onChange={(e) => setF({ ...f, warrantyExpiry: e.target.value })}
              />
            </Field>

            <Field label="Notes">
              <Textarea
                rows={2}
                value={f.notes ?? ""}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
                placeholder="Additional notes or maintenance guidelines..."
              />
            </Field>

            <div className="rounded-xl border border-dashed border-[#003399]/25 bg-gradient-to-br from-[#003399]/[0.04] to-transparent p-4">
              <Field
                label={
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#003399]/10 text-[#003399]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </span>
                    Assigned staff
                  </div>
                }
              >
                <div className="space-y-1.5">
                  <Select
                    value={staffList.some((s) => s.name === f.staff) ? f.staff : (f.staff ? "custom" : "")}
                    onValueChange={(val) => {
                      if (val === "custom") return;
                      setF({ ...f, staff: val });
                    }}
                  >
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select the staff member responsible" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((emp) => (
                        <SelectItem key={emp.id || emp.name} value={emp.name}>
                          {emp.name} {emp.role ? `(${emp.role})` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">-- Write custom staff name --</SelectItem>
                    </SelectContent>
                  </Select>
                  {(!staffList.some((s) => s.name === f.staff) || f.staff === "" || !staffList.length) && (
                    <Input
                      placeholder="Or enter a staff name manually..."
                      value={f.staff || ""}
                      onChange={(e) => setF({ ...f, staff: e.target.value })}
                      className="bg-white"
                    />
                  )}
                </div>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={submit}
                className="bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white shadow-[0_4px_14px_-4px_rgba(0,51,153,0.55)] hover:brightness-105 active:scale-[0.98] transition-all"
              >
                {initial ? "Save changes" : "Create asset"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
  );
}

function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {typeof label === "string" ? (
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      ) : (
        label
      )}
      {children}
    </div>
  );
}

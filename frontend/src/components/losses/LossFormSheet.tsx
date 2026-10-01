import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Item } from "@/types/inventory";
import {
  LOSS_KIND_LABELS,
  LOSS_REASON_OPTIONS,
  LOSS_STATUS_LABELS,
  type LossDraft,
  type LossKind,
  type LossReason,
  type LossRecord,
  type LossStatus,
} from "./loss-store";

export interface AssetOption {
  id: string;
  name: string;
  tag: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: LossRecord | null;
  items: Item[];
  assets: AssetOption[];
  onSubmit: (data: LossDraft) => void | Promise<unknown>;
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const NONE = "__none__";

const KIND_OPTIONS = (Object.keys(LOSS_KIND_LABELS) as LossKind[]).map((value) => ({
  value,
  label: LOSS_KIND_LABELS[value],
}));

const CONDITION_OPTIONS = [
  { value: "", label: "Don't change" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "damaged", label: "Damaged" },
];

const money = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

function defaultReasonForKind(kind: LossKind): LossReason {
  if (kind === "inventory") return "damaged";
  if (kind === "asset") return "accident";
  if (kind === "cash") return "theft";
  return "write_off";
}

interface FormState {
  kind: LossKind;
  date: string;
  itemId: string;
  assetId: string;
  assetCondition: string;
  quantity: string;
  unitValue: string;
  totalValue: string;
  reasonCode: LossReason;
  description: string;
  reportedBy: string;
  insuranceClaim: boolean;
  status: LossStatus;
}

function mkInitial(initial: LossRecord | null | undefined, reportedBy: string): FormState {
  return {
    kind: initial?.kind ?? "inventory",
    date: initial?.date ?? TODAY(),
    itemId: initial?.itemId ?? "",
    assetId: initial?.assetId ?? "",
    assetCondition: "",
    quantity: initial ? String(initial.quantity ?? 0) : "",
    unitValue: initial ? String(initial.unitValue ?? 0) : "",
    totalValue: initial ? String(initial.totalValue ?? 0) : "",
    reasonCode: initial?.reasonCode ?? "damaged",
    description: initial?.description ?? "",
    reportedBy: initial?.reportedBy ?? reportedBy,
    insuranceClaim: initial?.insuranceClaim ?? false,
    status: initial?.status ?? "reported",
  };
}

export function LossFormSheet({ open, onOpenChange, initial, items, assets, onSubmit }: Props) {
  const { user } = useAuth();
  const authenticatedName = useMemo(() => {
    const fullName = (user?.user_metadata?.full_name as string) || "";
    const emailPrefix = user?.email?.split("@")[0] || "";
    return fullName || emailPrefix || "System Admin";
  }, [user]);

  const [form, setForm] = useState<FormState>(() => mkInitial(initial, authenticatedName));
  const [valueTouched, setValueTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(initial);

  useEffect(() => {
    if (open) {
      setForm(mkInitial(initial, authenticatedName));
      setValueTouched(Boolean(initial));
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initial, authenticatedName]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const selectedItem = useMemo(() => items.find((i) => i.id === form.itemId), [items, form.itemId]);
  const showItem = form.kind === "inventory";
  const showAsset = form.kind === "asset";
  const showQuantity = form.kind === "inventory" || form.kind === "asset" || form.kind === "other";
  const showUnit = form.kind === "inventory" || form.kind === "other";

  // Default unit value from the selected item's cost price.
  useEffect(() => {
    if (showItem && selectedItem && !valueTouched) {
      setForm((p) => ({ ...p, unitValue: String(selectedItem.costPrice ?? 0) }));
    }
  }, [showItem, selectedItem, valueTouched]);

  // Keep total = qty * unit in sync until the user overrides it.
  const computedTotal = (Number(form.quantity) || 0) * (Number(form.unitValue) || 0);
  useEffect(() => {
    if (!valueTouched) {
      setForm((p) => ({ ...p, totalValue: String(Math.round(computedTotal * 100) / 100) }));
    }
  }, [computedTotal, valueTouched]);

  const changeKind = (kind: LossKind) => {
    setValueTouched(false);
    setForm((p) => ({
      ...p,
      kind,
      itemId: kind === "inventory" ? p.itemId : "",
      assetId: kind === "asset" ? p.assetId : "",
      assetCondition: "",
      quantity: kind === "cash" ? "0" : kind === "asset" ? "1" : p.quantity || "",
      reasonCode: defaultReasonForKind(kind),
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.date) errs.date = "Date is required";
    if (showItem && !form.itemId) errs.itemId = "Select the item that was lost or damaged";
    if (showAsset && !form.assetId) errs.assetId = "Select the affected asset";

    const qty = Number(form.quantity);
    if (showQuantity && form.kind !== "other" && (!form.quantity || isNaN(qty) || qty <= 0)) {
      errs.quantity = "Quantity must be greater than zero";
    }
    if (showItem && selectedItem && qty > selectedItem.currentStock) {
      errs.quantity = `Insufficient stock. On hand: ${selectedItem.currentStock}`;
    }

    const total = Number(form.totalValue);
    if (form.kind === "cash" && (!form.totalValue || isNaN(total) || total <= 0)) {
      errs.totalValue = "Enter the amount lost";
    } else if (form.totalValue && (isNaN(total) || total < 0)) {
      errs.totalValue = "Value must not be negative";
    }
    if (!form.description.trim()) errs.description = "A short description is required";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const qty = Number(form.quantity) || 0;
    const unit = Number(form.unitValue) || 0;
    const total = Number(form.totalValue) || 0;

    const draft: LossDraft = {
      date: form.date,
      kind: form.kind,
      itemId: form.kind === "inventory" ? form.itemId || null : null,
      itemName: selectedItem?.name ?? initial?.itemName ?? "",
      assetId: form.kind === "asset" ? form.assetId || null : null,
      assetName:
        form.kind === "asset"
          ? assets.find((a) => a.id === form.assetId)?.name ?? initial?.assetName ?? ""
          : "",
      quantity: form.kind === "cash" ? 0 : qty,
      unitValue: form.kind === "cash" ? 0 : unit,
      totalValue: total,
      currency: "UGX",
      reasonCode: form.reasonCode,
      description: form.description.trim(),
      locationId: null,
      reportedBy: form.reportedBy.trim() || authenticatedName,
      status: isEditing ? form.status : "reported",
      approvedBy: initial?.approvedBy ?? null,
      statusNote: initial?.statusNote ?? null,
      insuranceClaim: form.insuranceClaim,
      attachment: initial?.attachment ?? null,
      movementId: initial?.movementId ?? null,
    };

    // assetCondition is a create-only side effect handled by the backend.
    const payload = (form.kind === "asset" && form.assetCondition && !isEditing
      ? { ...draft, assetCondition: form.assetCondition }
      : draft) as LossDraft & { assetCondition?: string };

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save loss record");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit loss record" : "Record a loss / damage"}</SheetTitle>
          <SheetDescription>
            Write off damaged, lost, expired, or stolen value. Inventory losses reduce on-hand stock automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loss type">
              <Select value={form.kind} onValueChange={(v) => changeKind(v as LossKind)} disabled={isEditing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" error={errors.date}>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </Field>
          </div>

          {showItem && (
            <Field label="Item" error={errors.itemId}>
              <Select
                value={form.itemId || NONE}
                onValueChange={(v) => { setValueTouched(false); update("itemId", v === NONE ? "" : v); }}
                disabled={isEditing}
              >
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>Select item</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} · {i.currentStock} on hand
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {showAsset && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Asset" error={errors.assetId}>
                <Select
                  value={form.assetId || NONE}
                  onValueChange={(v) => update("assetId", v === NONE ? "" : v)}
                  disabled={isEditing}
                >
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} disabled>Select asset</SelectItem>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.tag})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {!isEditing && (
                <Field label="Set condition">
                  <Select value={form.assetCondition || NONE} onValueChange={(v) => update("assetCondition", v === NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Don't change" /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value || NONE} value={o.value || NONE}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {showQuantity && (
              <Field label="Quantity" error={errors.quantity}>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.quantity}
                  disabled={isEditing}
                  onChange={(e) => update("quantity", e.target.value)}
                  placeholder="0"
                />
              </Field>
            )}
            {showUnit && (
              <Field label="Unit value">
                <Input
                  type="number"
                  min={0}
                  value={form.unitValue}
                  disabled={isEditing && form.kind === "inventory"}
                  onChange={(e) => { setValueTouched(true); update("unitValue", e.target.value); }}
                  placeholder="0"
                />
              </Field>
            )}
            <Field
              label={form.kind === "cash" ? "Amount lost" : "Total value"}
              error={errors.totalValue}
            >
              <Input
                type="number"
                min={0}
                value={form.totalValue}
                onChange={(e) => { setValueTouched(true); update("totalValue", e.target.value); }}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reason">
              <Select value={form.reasonCode} onValueChange={(v) => update("reasonCode", v as LossReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOSS_REASON_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reported by">
              <Input value={form.reportedBy} onChange={(e) => update("reportedBy", e.target.value)} placeholder="Staff name" />
            </Field>
          </div>

          {isEditing && (
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => update("status", v as LossStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOSS_STATUS_LABELS) as LossStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{LOSS_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Description" error={errors.description}>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What happened, where, and any follow-up needed..."
            />
          </Field>

          <label className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Flag for insurance claim
            </span>
            <Switch checked={form.insuranceClaim} onCheckedChange={(v) => update("insuranceClaim", v)} />
          </label>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Estimated loss value</span>
            <span className="font-semibold">{money(Number(form.totalValue) || 0)}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEditing ? "Save changes" : "Record loss"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

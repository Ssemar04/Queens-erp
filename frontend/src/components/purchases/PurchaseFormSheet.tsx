import { useState, useEffect, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getEmployees, getNextPurchaseNumber, type Employee } from "@/services/api";
import type { Purchase } from "./purchases-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Purchase | null;
  onSubmit: (p: Partial<Purchase>) => Promise<unknown>;
  onUpdate?: (id: string, patch: Partial<Purchase>) => Promise<unknown>;
}

const CATEGORIES = ["Inventory", "Assets", "Raw Materials", "Office Supplies", "Services", "Maintenance", "Equipment"];
const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "mpesa", label: "Mobile Money (M-Pesa)" },
  { value: "credit", label: "Supplier Credit" },
];

export function PurchaseFormSheet({ open, onOpenChange, initial, onSubmit, onUpdate }: Props) {
  const [staffList, setStaffList] = useState<Employee[]>([]);
  const [form, setForm] = useState<Partial<Purchase>>({
    purchaseNumber: "",
    supplierName: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: "",
    category: "Inventory",
    itemsSummary: "",
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    paidAmount: 0,
    paymentStatus: "unpaid",
    orderStatus: "received",
    paymentMethod: "bank_transfer",
    purchasedBy: "",
    notes: "",
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
      setForm(initial);
    } else if (open) {
      getNextPurchaseNumber()
        .then((num) => {
          setForm((prev) => ({ ...prev, purchaseNumber: num }));
        })
        .catch(() => {});
    }
  }, [initial, open]);

  // Recalculate total amount when subtotal, tax, or discount change
  function updateCalc(sub: number, tax: number, disc: number, paid: number) {
    const total = Math.max(0, sub + tax - disc);
    let pStatus: Purchase["paymentStatus"] = "unpaid";
    if (paid >= total && total > 0) pStatus = "paid";
    else if (paid > 0) pStatus = "partially_paid";

    setForm((prev) => ({
      ...prev,
      subtotal: sub,
      taxAmount: tax,
      discountAmount: disc,
      totalAmount: total,
      paidAmount: paid,
      paymentStatus: pStatus,
    }));
  }

  async function handleSubmit() {
    if (!form.supplierName?.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (!form.totalAmount || form.totalAmount <= 0) {
      toast.error("Total amount must be greater than 0");
      return;
    }

    try {
      if (initial && onUpdate) {
        await onUpdate(initial.id, form);
      } else {
        await onSubmit(form);
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save purchase record");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit purchase record" : "New company purchase"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="PO Number">
              <Input
                value={form.purchaseNumber || ""}
                onChange={(e) => setForm({ ...form, purchaseNumber: e.target.value })}
                placeholder="PO-1001"
              />
            </Field>

            <Field label="Category">
              <Select
                value={form.category || "Inventory"}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Supplier Name">
            <Input
              value={form.supplierName || ""}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
              placeholder="e.g. Kampala Tech Suppliers"
            />
          </Field>

          <Field label="Items Summary / Description">
            <Textarea
              rows={2}
              value={form.itemsSummary || ""}
              onChange={(e) => setForm({ ...form, itemsSummary: e.target.value })}
              placeholder="e.g. 10x Wireless Keyboards, 5x USB-C Hubs"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase date">
              <Input
                type="date"
                value={form.purchaseDate || ""}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </Field>

            <Field label="Expected delivery date">
              <Input
                type="date"
                value={form.expectedDeliveryDate || ""}
                onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border p-3 bg-muted/20">
            <Field label="Subtotal (UGX)">
              <Input
                type="number"
                value={form.subtotal || ""}
                onChange={(e) =>
                  updateCalc(
                    Number(e.target.value),
                    form.taxAmount || 0,
                    form.discountAmount || 0,
                    form.paidAmount || 0,
                  )
                }
              />
            </Field>

            <Field label="Tax VAT (UGX)">
              <Input
                type="number"
                value={form.taxAmount || ""}
                onChange={(e) =>
                  updateCalc(
                    form.subtotal || 0,
                    Number(e.target.value),
                    form.discountAmount || 0,
                    form.paidAmount || 0,
                  )
                }
              />
            </Field>

            <Field label="Discount (UGX)">
              <Input
                type="number"
                value={form.discountAmount || ""}
                onChange={(e) =>
                  updateCalc(
                    form.subtotal || 0,
                    form.taxAmount || 0,
                    Number(e.target.value),
                    form.paidAmount || 0,
                  )
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Amount (UGX)">
              <Input
                type="number"
                value={form.totalAmount || 0}
                readOnly
                className="font-mono font-bold bg-muted"
              />
            </Field>

            <Field label="Paid Amount (UGX)">
              <Input
                type="number"
                value={form.paidAmount || ""}
                onChange={(e) =>
                  updateCalc(
                    form.subtotal || 0,
                    form.taxAmount || 0,
                    form.discountAmount || 0,
                    Number(e.target.value),
                  )
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Payment Status">
              <Select
                value={form.paymentStatus || "unpaid"}
                onValueChange={(v) =>
                  setForm({ ...form, paymentStatus: v as Purchase["paymentStatus"] })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Order Status">
              <Select
                value={form.orderStatus || "received"}
                onValueChange={(v) =>
                  setForm({ ...form, orderStatus: v as Purchase["orderStatus"] })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Payment Method">
              <Select
                value={form.paymentMethod || "bank_transfer"}
                onValueChange={(v) => setForm({ ...form, paymentMethod: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Purchased By (Staff)">
            <Select
              value={
                staffList.some((s) => s.name === form.purchasedBy)
                  ? form.purchasedBy
                  : form.purchasedBy
                  ? "custom"
                  : ""
              }
              onValueChange={(val) => {
                if (val === "custom") return;
                setForm({ ...form, purchasedBy: val });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staffList.map((emp) => (
                  <SelectItem key={emp.id || emp.name} value={emp.name}>
                    {emp.name} {emp.role ? `(${emp.role})` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="custom">-- Custom Staff Name --</SelectItem>
              </SelectContent>
            </Select>
            {(!staffList.some((s) => s.name === form.purchasedBy) ||
              form.purchasedBy === "" ||
              !staffList.length) && (
              <Input
                className="mt-1.5"
                placeholder="Or type staff member name..."
                value={form.purchasedBy || ""}
                onChange={(e) => setForm({ ...form, purchasedBy: e.target.value })}
              />
            )}
          </Field>

          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional delivery instructions or payment notes..."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {initial ? "Save changes" : "Record purchase"}
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

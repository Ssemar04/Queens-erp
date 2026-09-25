import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Purchase } from "./purchases-store";
import { fmtUGX } from "./purchases-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purchase: Purchase | null;
  onEdit?: (p: Purchase) => void;
}

export function PurchaseDetailSheet({ open, onOpenChange, purchase, onEdit }: Props) {
  if (!purchase) return null;

  const balance = Math.max(0, purchase.totalAmount - purchase.paidAmount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span>{purchase.purchaseNumber}</span>
          </SheetTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline">{purchase.category}</Badge>
            <Badge
              variant="outline"
              className={cn(
                purchase.paymentStatus === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                purchase.paymentStatus === "partially_paid" && "border-amber-200 bg-amber-50 text-amber-700",
                purchase.paymentStatus === "unpaid" && "border-rose-200 bg-rose-50 text-rose-700",
              )}
            >
              {purchase.paymentStatus.replace("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                purchase.orderStatus === "received" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                purchase.orderStatus === "ordered" && "border-blue-200 bg-blue-50 text-blue-700",
                purchase.orderStatus === "draft" && "border-slate-200 bg-slate-50 text-slate-700",
                purchase.orderStatus === "cancelled" && "border-rose-200 bg-rose-50 text-rose-700",
              )}
            >
              {purchase.orderStatus}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-4 text-sm">
          <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
            <Row label="Supplier" value={purchase.supplierName} />
            <Row label="Items Summary" value={purchase.itemsSummary || "—"} />
            <Row label="Purchase Date" value={purchase.purchaseDate} />
            {purchase.expectedDeliveryDate && (
              <Row label="Expected Delivery" value={purchase.expectedDeliveryDate} />
            )}
            <Row label="Purchased By" value={purchase.purchasedBy || "—"} />
            <Row label="Payment Method" value={purchase.paymentMethod.replace("_", " ")} />
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2 bg-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial Breakdown</p>
            <div className="flex justify-between py-1 text-muted-foreground text-xs">
              <span>Subtotal</span>
              <span className="font-mono">{fmtUGX(purchase.subtotal)}</span>
            </div>
            {purchase.taxAmount > 0 && (
              <div className="flex justify-between py-1 text-muted-foreground text-xs">
                <span>Tax (VAT)</span>
                <span className="font-mono">+{fmtUGX(purchase.taxAmount)}</span>
              </div>
            )}
            {purchase.discountAmount > 0 && (
              <div className="flex justify-between py-1 text-emerald-600 text-xs">
                <span>Discount</span>
                <span className="font-mono">-{fmtUGX(purchase.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-t border-border font-bold text-sm">
              <span>Total Amount</span>
              <span className="font-mono">{fmtUGX(purchase.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1 text-emerald-700 text-xs">
              <span>Paid Amount</span>
              <span className="font-mono">{fmtUGX(purchase.paidAmount)}</span>
            </div>
            <div className={cn("flex justify-between py-1 font-semibold text-xs", balance > 0 ? "text-rose-600" : "text-emerald-600")}>
              <span>Outstanding Balance</span>
              <span className="font-mono">{fmtUGX(balance)}</span>
            </div>
          </div>

          {purchase.notes && (
            <div className="rounded-xl border border-border p-3 bg-white space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{purchase.notes}</p>
            </div>
          )}

          {onEdit && (
            <div className="pt-2 flex justify-end">
              <Button onClick={() => { onOpenChange(false); onEdit(purchase); }}>
                Edit purchase
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

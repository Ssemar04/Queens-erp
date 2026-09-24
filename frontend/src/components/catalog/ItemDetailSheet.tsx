import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  X,
  Pencil,
  Archive,
  Package,
  PlusCircle,
  ShoppingBag,
  TrendingUp,
  Boxes,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Layers3,
  RefreshCw,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionGate } from "@/hooks/usePermissions";
import { MovementTimeline } from "@/components/catalog/MovementTimeline";
import { BarcodeDisplay } from "@/components/catalog/BarcodeDisplay";
import { useMovements } from "@/hooks/useInventoryData";
import { useUpdateItem } from "@/hooks/useInventoryMutations";
import { getOrders } from "@/services/api";
import { saveMovementTransaction } from "@/lib/movements-backend-api";
import type { Item, Category, Supplier, Branch, StockMovement } from "@/types/inventory";
import { MovementType } from "@/types/inventory";
import type { SalesOrder, OrderStatus } from "@/types/sales-order";
import { cn } from "@/lib/utils";

type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

function stockStatus(item: Item): StockStatus {
  if (item.currentStock === 0) return "out-of-stock";
  if (item.currentStock <= item.reorderPoint) return "low-stock";
  return "in-stock";
}

function stockColor(item: Item) {
  const s = stockStatus(item);
  if (s === "out-of-stock") return "text-stock-out";
  if (s === "low-stock") return "text-stock-low";
  return "text-stock-healthy";
}

const ORDER_STATUS_META: Record<OrderStatus, { label: string; cls: string; icon: typeof Clock }> = {
  submitted: { label: "Submitted", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-500", icon: Clock },
  declined: { label: "Declined", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: XCircle },
  successful: { label: "Successful", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500", icon: CheckCircle2 },
};

interface ItemDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null | undefined;
  categories: Category[];
  suppliers: Supplier[];
  branches?: Branch[];
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-sm font-semibold text-foreground" : "text-sm text-foreground"}>{value || "—"}</span>
    </div>
  );
}

export function ItemDetailSheet({
  open,
  onOpenChange,
  item,
  categories,
  suppliers,
  onEdit,
  onArchive,
}: ItemDetailSheetProps) {
  const queryClient = useQueryClient();
  const { data: allMovements = [] } = useMovements();
  const updateItem = useUpdateItem();

  // Dialog state for updating stock / reorder
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateMode, setUpdateMode] = useState<"receive" | "reorder" | "adjust">("receive");
  const [qtyInput, setQtyInput] = useState<string>("10");
  const [reorderThresholdInput, setReorderThresholdInput] = useState<string>("");
  const [reorderQtyInput, setReorderQtyInput] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Fetch sales orders for sales history tab
  const { data: allOrders = [] } = useQuery<SalesOrder[]>({
    queryKey: ["db", "orders"],
    queryFn: getOrders,
    initialData: [],
  });

  // Filter sales orders that include this item
  const itemSales = useMemo(() => {
    if (!item) return [];
    const salesList: Array<{
      order: SalesOrder;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }> = [];

    for (const order of allOrders) {
      if (!order.items || order.items.length === 0) continue;
      for (const lineItem of order.items) {
        const matchesId = lineItem.id === item.id || (item.name && lineItem.name?.toLowerCase() === item.name.toLowerCase());
        if (matchesId) {
          salesList.push({
            order,
            quantity: lineItem.quantity || 1,
            unitPrice: lineItem.unitPrice || item.sellingPrice,
            totalAmount: (lineItem.quantity || 1) * (lineItem.unitPrice || item.sellingPrice),
          });
        }
      }
    }
    return salesList.sort((a, b) => new Date(b.order.dateReceived || b.order.createdAt || 0).getTime() - new Date(a.order.dateReceived || a.order.createdAt || 0).getTime());
  }, [allOrders, item]);

  const totalUnitsSold = useMemo(() => itemSales.reduce((acc, curr) => acc + curr.quantity, 0), [itemSales]);
  const totalSalesRevenue = useMemo(() => itemSales.reduce((acc, curr) => acc + curr.totalAmount, 0), [itemSales]);

  if (!item) return null;

  const category = categories.find((c) => c.id === item.categoryId);
  const supplier = suppliers.find((s) => s.id === item.supplierId);
  const status = stockStatus(item);

  function handleOpenUpdateDialog(mode: "receive" | "reorder" | "adjust" = "receive") {
    setUpdateMode(mode);
    setQtyInput(mode === "adjust" ? String(item?.currentStock ?? 0) : "10");
    setReorderThresholdInput(String(item?.reorderPoint ?? 0));
    setReorderQtyInput(String(item?.reorderQuantity ?? 0));
    setUpdateNotes("");
    setUpdateDialogOpen(true);
  }

  async function handleConfirmStockUpdate() {
    if (!item) return;
    const qtyVal = Number(qtyInput);
    if (isNaN(qtyVal) || (updateMode !== "adjust" && qtyVal <= 0)) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setUpdating(true);
    let newStock = item.currentStock;
    let movementType: MovementType = MovementType.Received;

    if (updateMode === "receive") {
      newStock = item.currentStock + qtyVal;
      movementType = MovementType.Received;
    } else if (updateMode === "reorder") {
      newStock = item.currentStock + qtyVal;
      movementType = MovementType.Received;
    } else if (updateMode === "adjust") {
      newStock = Math.max(0, qtyVal);
      movementType = MovementType.Adjusted;
    }

    const newThreshold = Number(reorderThresholdInput);
    const newReorderQty = Number(reorderQtyInput);

    const updates: Partial<Item> = {
      currentStock: newStock,
      reorderPoint: !isNaN(newThreshold) ? Math.max(0, newThreshold) : item.reorderPoint,
      reorderQuantity: !isNaN(newReorderQty) ? Math.max(0, newReorderQty) : item.reorderQuantity,
      updatedAt: new Date().toISOString(),
    };

    updateItem.mutate(
      { id: item.id, updates },
      {
        onSuccess: async () => {
          // Record stock movement record
          try {
            const movementData: StockMovement = {
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              itemId: item.id,
              type: movementType,
              quantity: updateMode === "adjust" ? newStock - item.currentStock : qtyVal,
              reference: updateMode === "receive" ? "Stock received" : updateMode === "reorder" ? "Reorder restock" : "Quantity adjustment",
              notes: updateNotes || (updateMode === "receive" ? "Stock received" : updateMode === "reorder" ? "Reorder received" : "Quantity adjustment"),
              performedBy: "Manager",
              fromLocationId: null,
              toLocationId: null,
              createdAt: new Date().toISOString(),
            };
            await saveMovementTransaction(movementData);
          } catch (e) {
            // non-blocking if movement log fails
          }

          await queryClient.invalidateQueries({ queryKey: ["db", "items"] });
          await queryClient.invalidateQueries({ queryKey: ["db", "movements"] });

          toast.success(
            updateMode === "receive"
              ? `Received ${qtyVal} ${item.unit || "units"}. New stock: ${newStock}`
              : updateMode === "reorder"
              ? `Reordered & received ${qtyVal} ${item.unit || "units"}. New stock: ${newStock}`
              : `Stock adjusted to ${newStock} ${item.unit || "units"}`
          );
          setUpdateDialogOpen(false);
          setUpdating(false);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Failed to update quantity";
          toast.error(msg);
          setUpdating(false);
        },
      }
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-foreground tracking-tight">{item.name}</h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={status} />
                  <StatusBadge status={item.status} />
                  <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/60">
                    {item.sku}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <PermissionGate permission="edit_item">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-[#003399]/10 hover:text-[#003399]"
                    onClick={() => onEdit?.(item)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={() => onArchive?.(item)}
                    aria-label="Archive"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </PermissionGate>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="px-6 pt-4 pb-8">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                History & Sales
                {itemSales.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-mono bg-[#003399]/10 text-[#003399]">
                    {itemSales.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="mt-5 space-y-6">
              {/* Quantity Hero Card with Update Stock Action */}
              <div className="relative overflow-hidden rounded-2xl border border-[#003399]/20 bg-gradient-to-br from-[#003399]/[0.04] via-white to-white p-5 text-center shadow-sm">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#003399] font-semibold mb-1">
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="h-4 w-4" />
                    Quantity on Hand
                  </span>
                  <span className="font-mono text-muted-foreground">Unit: {item.unit || "each"}</span>
                </div>
                
                <div className="my-2 flex items-baseline justify-center gap-2">
                  <span className={`font-mono text-4xl font-bold tracking-tight ${stockColor(item)}`}>
                    {item.currentStock.toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{item.unit || "units"}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenUpdateDialog("receive")}
                    className="gap-1.5 bg-[#003399] hover:bg-[#002266] text-white shadow-sm"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Update Quantity / Receive Stock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenUpdateDialog("reorder")}
                    className="gap-1.5 border-[#003399]/30 text-[#003399] hover:bg-[#003399]/5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reorder Stock
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground/80">Initial Stock</span>
                    <strong className="font-mono text-foreground font-semibold">{item.initialQuantity ?? item.currentStock}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground/80">Reorder Point</span>
                    <strong className="font-mono text-foreground font-semibold">{item.reorderPoint}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-muted-foreground/80">Reorder Qty</span>
                    <strong className="font-mono text-foreground font-semibold">{item.reorderQuantity || 0}</strong>
                  </div>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 pb-2">
                  Product Details & Pricing (UGX)
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <DetailRow label="SKU" value={item.sku} mono />
                  <DetailRow label="Category" value={category?.name} />
                  <DetailRow label="Unit of Measure" value={item.unit || "each"} />
                  <DetailRow label="Preferred Supplier" value={supplier?.name} />
                  <DetailRow
                    label="Cost Per Unit"
                    value={<span className="text-[#003399] font-bold">UGX {item.costPrice.toLocaleString()}</span>}
                    mono
                  />
                  <DetailRow
                    label="Selling Price"
                    value={<span className="text-emerald-700 font-bold">UGX {item.sellingPrice.toLocaleString()}</span>}
                    mono
                  />
                  <DetailRow label="Reorder Threshold" value={`${item.reorderPoint} ${item.unit || "units"}`} mono />
                  <DetailRow label="Reorder Batch Qty" value={`${item.reorderQuantity || 0} ${item.unit || "units"}`} mono />
                  <DetailRow label="Description" value={item.description} />
                  <DetailRow label="Created Date" value={item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy") : "—"} />
                  <DetailRow label="Last Updated" value={item.updatedAt ? format(new Date(item.updatedAt), "MMM d, yyyy") : "—"} />
                </div>
              </div>

              {/* Barcode Display */}
              <BarcodeDisplay
                barcode={item.barcode}
                itemName={item.name}
                sku={item.sku}
                location={undefined}
                onBarcodeChange={(value) => updateItem.mutate({ id: item.id, updates: { barcode: value } })}
              />
            </TabsContent>

            {/* TAB 2: HISTORY & SALES */}
            <TabsContent value="history" className="mt-5 space-y-6">
              {/* Sales Performance Summary */}
              <div className="rounded-2xl border border-[#003399]/20 bg-gradient-to-br from-[#003399]/[0.03] to-white p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#003399] mb-3">
                  <ShoppingBag className="h-4 w-4" />
                  Sales Performance History
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-border bg-white p-3 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales Orders</span>
                    <div className="font-mono text-lg font-bold text-foreground mt-0.5">{itemSales.length}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Units Sold</span>
                    <div className="font-mono text-lg font-bold text-[#003399] mt-0.5">{totalUnitsSold.toLocaleString()}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Income</span>
                    <div className="font-mono text-base font-bold text-emerald-700 mt-0.5 truncate">
                      UGX {totalSalesRevenue.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Orders List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Sales Orders Containing {item.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{itemSales.length} order{itemSales.length === 1 ? "" : "s"}</span>
                </h4>

                {itemSales.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium text-foreground">No sales recorded yet for this item</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                      When sales orders are created containing this product, the LPO breakdown and income will automatically populate here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {itemSales.map(({ order, quantity, unitPrice, totalAmount }) => {
                      const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.submitted;
                      const StatusIcon = meta.icon;
                      return (
                        <div
                          key={`${order.id}-${item.id}`}
                          className="rounded-xl border border-border bg-white p-3.5 shadow-2xs transition-all hover:border-[#003399]/30 hover:shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-foreground">{order.lpoNumber}</span>
                                <Badge variant="outline" className={cn("gap-1 border-0 text-[10px]", meta.cls)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {meta.label}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="truncate font-medium text-foreground">{order.customerName}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 shrink-0 font-mono text-[11px]">
                                  <Calendar className="h-3 w-3" />
                                  {order.dateReceived || (order.createdAt ? order.createdAt.slice(0, 10) : "")}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono text-sm font-bold text-emerald-700">
                                UGX {totalAmount.toLocaleString()}
                              </div>
                              <div className="text-[11px] font-mono text-muted-foreground">
                                {quantity} unit{quantity > 1 ? "s" : ""} @ UGX {unitPrice.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          {order.handledBy && (
                            <div className="mt-2 border-t border-border/40 pt-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground/70" />
                                Handled by <span className="font-medium text-foreground">{order.handledBy}</span>
                              </span>
                              {order.customerQuotation && (
                                <span className="truncate max-w-[200px] italic">Ref: {order.customerQuotation}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stock Movement Audit Log */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Stock Movement Audit Log</span>
                  <span className="text-[11px] font-mono text-muted-foreground">Inventory log</span>
                </h4>
                <MovementTimeline movements={allMovements} itemId={item.id} />
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* UPDATE STOCK QUANTITY DIALOG */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Boxes className="h-5 w-5 text-[#003399]" />
              Update Quantity for {item.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Receive stock delivery, adjust reorder levels, or modify current stock on hand.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Mode Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Update Type</Label>
              <Select value={updateMode} onValueChange={(v) => setUpdateMode(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">
                    <span className="font-medium text-emerald-700">📥 Receive Stock (Add to current stock)</span>
                  </SelectItem>
                  <SelectItem value="reorder">
                    <span className="font-medium text-[#003399]">🔄 Reorder Stock (Restock & adjust reorder level)</span>
                  </SelectItem>
                  <SelectItem value="adjust">
                    <span className="font-medium text-amber-700">✏️ Direct Stock Adjustment (Set exact quantity)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Current Stock Banner */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Current Stock on Hand:</span>
              <span className="font-mono font-bold text-foreground text-sm">
                {item.currentStock} {item.unit || "units"}
              </span>
            </div>

            {/* Quantity Input */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-qty-input" className="text-xs font-semibold">
                {updateMode === "receive" || updateMode === "reorder" ? "Quantity Received / Added *" : "New Total Quantity *"}
              </Label>
              <Input
                id="stock-qty-input"
                type="number"
                min="0"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                placeholder="Enter quantity..."
                className="font-mono"
                autoFocus
              />
            </div>

            {/* Reorder Thresholds */}
            {updateMode === "reorder" && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="reorder-point-input" className="text-xs">Reorder Point</Label>
                  <Input
                    id="reorder-point-input"
                    type="number"
                    min="0"
                    value={reorderThresholdInput}
                    onChange={(e) => setReorderThresholdInput(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reorder-qty-input" className="text-xs">Reorder Quantity</Label>
                  <Input
                    id="reorder-qty-input"
                    type="number"
                    min="0"
                    value={reorderQtyInput}
                    onChange={(e) => setReorderQtyInput(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* Reference / Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="update-notes" className="text-xs">Reference / Notes (Optional)</Label>
              <Input
                id="update-notes"
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                placeholder="e.g. Received shipment from supplier LPO-2026"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUpdateDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmStockUpdate}
              disabled={updating}
              className="bg-[#003399] hover:bg-[#002266] text-white"
            >
              {updating ? "Saving..." : "Confirm Stock Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

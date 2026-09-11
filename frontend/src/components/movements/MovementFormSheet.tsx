import { useMemo, useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ItemStatus, MovementType } from "@/types/inventory";
import type { Item, Location, StockMovement } from "@/types/inventory";
import { useCreateMovement } from "@/hooks/useInventoryMutations";
import { createItem as createDatabaseItem } from "@/lib/db-api";
import { useQueryClient } from "@tanstack/react-query";

interface MovementFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  locations: Location[];
  /** Pre-selected item (locks the field) */
  preSelectedItemId?: string | null;
}

const TYPE_OPTIONS = [
  { value: MovementType.Received, label: "Received" },
  { value: MovementType.Shipped, label: "Shipped" },
  { value: MovementType.Adjusted, label: "Adjusted" },
  { value: MovementType.Transferred, label: "Transferred" },
];

function directionForType(type: MovementType): "in" | "out" | "configurable" {
  if (type === MovementType.Received) return "in";
  if (type === MovementType.Shipped) return "out";
  if (type === MovementType.Transferred) return "out";
  return "configurable";
}

function buildSkuSeed(value: string) {
  const seed = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);

  return seed || "ITEM";
}

function generateManualSku(name: string, items: Item[]) {
  const existing = new Set(items.map((item) => item.sku));
  const seed = buildSkuSeed(name);
  let suffix = 1;
  let sku = `SKU-${seed}`;

  while (existing.has(sku)) {
    suffix += 1;
    sku = `SKU-${seed}-${String(suffix).padStart(2, "0")}`;
  }

  return sku;
}

export function MovementFormSheet({
  open,
  onOpenChange,
  items,
  locations,
  preSelectedItemId,
}: MovementFormSheetProps) {
  const { mutate, isLoading } = useCreateMovement();
  const queryClient = useQueryClient();

  const [itemId, setItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [type, setType] = useState<MovementType>(MovementType.Received);
  const [quantity, setQuantity] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reference, setReference] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCreatingManualItem, setIsCreatingManualItem] = useState(false);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId), [itemId, items]);
  const manualItemName = itemSearch.trim();
  const isManualItem = !itemId && manualItemName.length > 0;
  const canCreateManualMovement =
    type === MovementType.Received || (type === MovementType.Adjusted && direction === "in");

  const matchingItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    const candidates = items.filter((candidate) => candidate.status !== ItemStatus.Archived);
    if (!query) return candidates.slice(0, 8);

    return candidates
      .filter((candidate) =>
        [candidate.name, candidate.sku, candidate.barcode ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [itemSearch, items]);

  const exactNameMatch = useMemo(() => {
    const query = manualItemName.toLowerCase();
    if (!query) return null;
    return items.find((candidate) => candidate.name.toLowerCase() === query) ?? null;
  }, [items, manualItemName]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      const presetId = preSelectedItemId ?? "";
      const presetItem = items.find((candidate) => candidate.id === presetId);
      setItemId(presetId);
      setItemSearch(presetItem?.name ?? "");
      setItemSearchOpen(false);
      setType(MovementType.Received);
      setQuantity("");
      setDirection("in");
      setReference("");
      setFromLocationId("");
      setToLocationId("");
      setErrors({});
      setIsCreatingManualItem(false);
    }
  }, [open, preSelectedItemId, items]);

  // Auto-set direction when type changes
  useEffect(() => {
    const dir = directionForType(type);
    if (dir !== "configurable") setDirection(dir);
  }, [type]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!itemId && !manualItemName) errs.itemId = "Item is required";
    if (isManualItem && exactNameMatch) errs.itemId = "Select the matching database item.";
    if (isManualItem && !canCreateManualMovement) {
      errs.itemId = "New manual items can only be received or adjusted in.";
    }

    const num = Number(quantity);
    const qty = parseInt(quantity, 10);
    if (!quantity || isNaN(qty) || qty <= 0 || !Number.isInteger(num)) {
      errs.quantity = "Quantity must be a positive integer";
    }

    // Shipped: cannot exceed current stock
    if (!errs.quantity && selectedItem && (type === MovementType.Shipped || (type === MovementType.Transferred))) {
      if (qty > selectedItem.currentStock) {
        errs.quantity = `Insufficient stock. Current quantity: ${selectedItem.currentStock}`;
      }
    }

    // Adjusted out: also cannot exceed current stock
    if (!errs.quantity && selectedItem && type === MovementType.Adjusted && direction === "out") {
      if (qty > selectedItem.currentStock) {
        errs.quantity = `Insufficient stock. Current quantity: ${selectedItem.currentStock}`;
      }
    }

    // Adjusted: note required
    if (type === MovementType.Adjusted && !reference.trim()) {
      errs.reference = "Reason for adjustment is required";
    }

    // Transferred: both locations required and different
    if (type === MovementType.Transferred) {
      if (!fromLocationId) errs.fromLocationId = "Source location is required";
      if (!toLocationId) errs.toLocationId = "Destination location is required";
      if (fromLocationId && toLocationId && fromLocationId === toLocationId) {
        errs.toLocationId = "Source and destination must differ";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createManualItem = async (name: string): Promise<Item> => {
    const now = new Date().toISOString();
    const newItem: Item = {
      id: crypto.randomUUID(),
      sku: generateManualSku(name, items),
      barcode: null,
      name,
      description: "Created from stock movement entry",
      categoryId: null,
      status: ItemStatus.Active,
      unit: "each",
      initialQuantity: 0,
      currentStock: 0,
      reorderPoint: 0,
      reorderQuantity: 0,
      costPrice: 0,
      sellingPrice: 0,
      branchId: null,
      supplierId: null,
      imageUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    await createDatabaseItem(newItem);
    await queryClient.invalidateQueries({ queryKey: ["db", "items"] });
    return newItem;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const qty = parseInt(quantity, 10);
    let movementItemId = itemId;
    let movementItemName = selectedItem?.name ?? manualItemName;

    if (!movementItemId) {
      setIsCreatingManualItem(true);
      try {
        const created = await createManualItem(manualItemName);
        movementItemId = created.id;
        movementItemName = created.name;
        setItemId(created.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create item";
        toast.error(message);
        setIsCreatingManualItem(false);
        return;
      }
      setIsCreatingManualItem(false);
    }

    const signedQty = direction === "in" ? qty : -qty;

    const movement: StockMovement = {
      id: crypto.randomUUID(),
      itemId: movementItemId,
      type,
      quantity: signedQty,
      fromLocationId: type === MovementType.Transferred ? fromLocationId || null : null,
      toLocationId: type === MovementType.Transferred ? toLocationId || null : null,
      reference,
      notes: reference,
      performedBy: "Admin User",
      createdAt: new Date().toISOString(),
    };

    mutate(movement, {
      onSuccess: () => {
        const label = movementItemName || movementItemId;
        const sign = direction === "in" ? "+" : "−";
        toast.success(`Movement logged: ${sign}${qty} ${label} (${type})`, {
          duration: 5000,
        });
        onOpenChange(false);
      },
      onError: (e) => toast.error(e.message || "Failed to log movement. Please try again."),
    });
  };

  const isTransfer = type === MovementType.Transferred;
  const isAdjusted = type === MovementType.Adjusted;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Log Movement</SheetTitle>
          <SheetDescription>Record a stock movement for an inventory item.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Item */}
          <div>
            <Label className="mb-1.5 block text-sm">Item *</Label>
            <Select
              value={itemId || "__none__"}
              onValueChange={(v) => setItemId(v === "__none__" ? "" : v)}
              disabled={!!preSelectedItemId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Select item</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.itemId && <p className="mt-1 text-xs text-destructive">{errors.itemId}</p>}
          </div>

          {/* Type */}
          <div>
            <Label className="mb-1.5 block text-sm">Movement Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div>
            <Label className="mb-1.5 block text-sm">Quantity *</Label>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {errors.quantity && <p className="mt-1 text-xs text-destructive">{errors.quantity}</p>}
          </div>

          {/* Direction (only for adjusted) */}
          {isAdjusted && (
            <div>
              <Label className="mb-1.5 block text-sm">Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">In (add stock)</SelectItem>
                  <SelectItem value="out">Out (remove stock)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transfer locations */}
          {isTransfer && (
            <>
              <div>
                <Label className="mb-1.5 block text-sm">From Location</Label>
                <Select value={fromLocationId || "__none__"} onValueChange={(v) => setFromLocationId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>Select location</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fromLocationId && <p className="mt-1 text-xs text-destructive">{errors.fromLocationId}</p>}
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">To Location</Label>
                <Select value={toLocationId || "__none__"} onValueChange={(v) => setToLocationId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>Select location</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.toLocationId && <p className="mt-1 text-xs text-destructive">{errors.toLocationId}</p>}
              </div>
            </>
          )}

          {/* Reference note */}
          <div>
            <Label className="mb-1.5 block text-sm">Reference Note{isAdjusted ? " *" : ""}</Label>
            <Textarea
              placeholder={isAdjusted ? "Reason for adjustment (required)" : "Optional note or reference"}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={3}
            />
            {errors.reference && <p className="mt-1 text-xs text-destructive">{errors.reference}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isLoading} className="flex-1">
              {isLoading ? "Saving…" : "Save Movement"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

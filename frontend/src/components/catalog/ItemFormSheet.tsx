import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Item, Category, Supplier, Branch } from "@/types/inventory";
import { ItemStatus } from "@/types/inventory";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional().nullable(),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  unit: z.string().min(1, "Unit is required"),
  currentStock: z.coerce.number().min(0),
  reorderPoint: z.coerce.number().min(0),
  reorderQuantity: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  status: z.nativeEnum(ItemStatus),
});

type FormValues = z.infer<typeof schema>;

interface ItemFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  categories: Category[];
  suppliers: Supplier[];
  branches: Branch[];
  items?: Item[];
  existingSkus: string[];
  existingBarcodes: (string | null)[];
  onSave: (data: Partial<Item>) => void;
  loading?: boolean;
}

// Function to generate unique barcode
function generateUniqueBarcode(existingBarcodes: (string | null)[]): string {
  const existingSet = new Set(existingBarcodes.filter(Boolean) as string[]);
  let barcode: string;
  do {
    barcode = `BC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  } while (existingSet.has(barcode));
  return barcode;
}

// Function to generate unique SKU (simple for now, backend also generates)
function generateUniqueSku(existingSkus: string[]): string {
  const existingSet = new Set(existingSkus);
  let sku: string;
  let num = 1;
  do {
    sku = `SKU-${String(num).padStart(3, '0')}`;
    num++;
  } while (existingSet.has(sku));
  return sku;
}

export function ItemFormSheet({
  open,
  onOpenChange,
  item,
  categories,
  suppliers,
  branches,
  items = [],
  existingSkus,
  existingBarcodes,
  onSave,
  loading,
}: ItemFormSheetProps) {
  const isEdit = !!item;
  const [nameSearchOpen, setNameSearchOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      barcode: null,
      description: "",
      categoryId: "",
      supplierId: "",
      branchId: "",
      unit: "each",
      currentStock: 0,
      reorderPoint: 0,
      reorderQuantity: 0,
      costPrice: 0,
      sellingPrice: 0,
      status: ItemStatus.Active,
    },
  });

  useEffect(() => {
    if (open && item) {
      reset({
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        description: item.description,
        categoryId: item.categoryId ?? undefined,
        supplierId: item.supplierId ?? undefined,
        branchId: item.branchId ?? undefined,
        unit: item.unit,
        currentStock: item.currentStock,
        reorderPoint: item.reorderPoint,
        reorderQuantity: item.reorderQuantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        status: item.status,
      });
    } else if (open) {
      const newSku = generateUniqueSku(existingSkus);
      const newBarcode = generateUniqueBarcode(existingBarcodes);
      reset({
        name: "",
        sku: newSku,
        barcode: newBarcode,
        description: "",
        categoryId: "",
        supplierId: "",
        branchId: "",
        unit: "each",
        currentStock: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
        costPrice: 0,
        sellingPrice: 0,
        status: ItemStatus.Active,
      });
    }
  }, [open, item, reset, existingSkus, existingBarcodes]);

  const itemName = watch("name");
  const matchingItems = useMemo(() => {
    const query = itemName.trim().toLowerCase();
    if (!query) return items.slice(0, 8);

    return items
      .filter((candidate) => {
        const haystack = [
          candidate.name,
          candidate.sku,
          candidate.barcode ?? "",
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [itemName, items]);

  const selectExistingItemName = (selectedItem: Item) => {
    setValue("name", selectedItem.name, { shouldValidate: true, shouldDirty: true });
    setNameSearchOpen(false);
  };

  const handleRegenerateSku = () => {
    const newSku = generateUniqueSku(existingSkus);
    setValue("sku", newSku);
  };

  const onSubmit = (data: FormValues) => {
    // Validate SKU is unique
    const skuConflict = existingSkus.filter((s) => s === data.sku);
    const allowedSku = isEdit && item?.sku === data.sku ? 1 : 0;
    if (skuConflict.length > allowedSku) {
      setError("sku", { message: "SKU already exists" });
      return;
    }
    // Validate barcode is unique (if provided)
    if (data.barcode) {
      const barcodeConflict = existingBarcodes.filter(b => b === data.barcode);
      const allowedBarcode = isEdit && item?.barcode === data.barcode ? 1 : 0;
      if (barcodeConflict.length > allowedBarcode) {
        setError("barcode", { message: "Barcode already exists" });
        return;
      }
    }

    const saveData: Partial<Item> = {
      ...data,
      categoryId: data.categoryId || null,
      supplierId: data.supplierId || null,
      branchId: data.branchId || null,
    };
    // Only set initialQuantity when creating new item
    if (!isEdit) {
      saveData.initialQuantity = data.currentStock;
    }
    onSave(saveData);
  };

  const handleRegenerateBarcode = () => {
    const newBarcode = generateUniqueBarcode(existingBarcodes);
    setValue("barcode", newBarcode);
  };

  const inputCls = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
  const labelCls = "text-sm font-medium";
  const errCls = "text-xs text-destructive";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetTitle>{isEdit ? "Edit Item" : "New Item"}</SheetTitle>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {/* Basic Info */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Basic Info</legend>
            <div>
              <label className={labelCls}>Name *</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  {...register("name")}
                  className={`${inputCls} pl-9`}
                  placeholder="Search item, or type a new name"
                  autoComplete="off"
                  onFocus={() => setNameSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setNameSearchOpen(false), 120)}
                />
                {nameSearchOpen && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                    {matchingItems.length > 0 ? (
                      matchingItems.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectExistingItemName(candidate);
                          }}
                          className="flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        >
                          <span className="font-medium">{candidate.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {candidate.sku} {candidate.currentStock > 0 ? `- In stock: ${candidate.currentStock}` : "- Out of stock"}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-2 text-xs text-muted-foreground">
                        No database match. Keep typing to create this item manually.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.name && <p className={errCls}>{errors.name.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={`${labelCls} flex items-center gap-1`}>SKU * <HelpTooltip text="Unique identifier for this item. Must be different from all other items." /></label>
                <Button type="button" variant="ghost" size="sm" onClick={handleRegenerateSku} className="h-7 px-2">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regenerate
                </Button>
              </div>
              <input {...register("sku")} className={inputCls} placeholder="SKU-XXXX" />
              {errors.sku && <p className={errCls}>{errors.sku.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className={`${labelCls} flex items-center gap-1`}>Barcode <HelpTooltip text="Scannable barcode for this item. Auto-generated but can be edited." /></label>
                <Button type="button" variant="ghost" size="sm" onClick={handleRegenerateBarcode} className="h-7 px-2">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Regenerate
                </Button>
              </div>
              <input {...register("barcode")} className={inputCls} placeholder="Auto-generated barcode" />
              {errors.barcode && <p className={errCls}>{errors.barcode.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea {...register("description")} rows={2} className={`${inputCls} h-auto py-2`} />
            </div>
          </fieldset>

          {/* Classification */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Classification</legend>
            <div>
              <label className={labelCls}>Category</label>
              <Select value={watch("categoryId") ?? ""} onValueChange={(v) => setValue("categoryId", v || "")}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className={labelCls}>Unit of Measure</label>
              <input {...register("unit")} className={inputCls} placeholder="each, kg, box…" />
            </div>
          </fieldset>

          {/* Stock Settings */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stock Settings</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Current Stock</label>
                <input type="number" {...register("currentStock")} className={inputCls} />
              </div>
              <div>
                <label className={`${labelCls} flex items-center gap-1`}>Reorder Point <HelpTooltip text="Minimum quantity before a low-stock alert is triggered. Set based on your typical usage rate." /></label>
                <input type="number" {...register("reorderPoint")} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Reorder Quantity</label>
              <input type="number" {...register("reorderQuantity")} className={inputCls} />
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pricing</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cost Price</label>
                <input type="number" step="0.01" {...register("costPrice")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Selling Price</label>
                <input type="number" step="0.01" {...register("sellingPrice")} className={inputCls} />
              </div>
            </div>
          </fieldset>

          {/* Assignment */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assignment</legend>
            <div>
              <label className={labelCls}>Supplier</label>
              <Select value={watch("supplierId") ?? ""} onValueChange={(v) => setValue("supplierId", v || "")}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          {/* Status */}
          <fieldset className="space-y-3">
            <legend className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</legend>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as ItemStatus)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ItemStatus.Active}>Active</SelectItem>
                <SelectItem value={ItemStatus.Discontinued}>Discontinued</SelectItem>
                <SelectItem value={ItemStatus.Archived}>Archived</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

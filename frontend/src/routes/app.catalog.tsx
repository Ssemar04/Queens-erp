import { useState, useMemo, useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CSVExportButton, type CSVColumn } from "@/components/data/CSVExportButton";
import { CSVImportSheet, type ImportField } from "@/components/data/CSVImportSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InventoryTable, type SortState } from "@/components/catalog/InventoryTable";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { ItemFormSheet } from "@/components/catalog/ItemFormSheet";
import { BulkActionBar } from "@/components/catalog/BulkActionBar";
import { ItemDetailSheet } from "@/components/catalog/ItemDetailSheet";
import { RowActionsMenu } from "@/components/catalog/RowActionsMenu";
import { MovementFormSheet } from "@/components/movements/MovementFormSheet";
import { printBarcodeLabels } from "@/components/catalog/PrintBarcodeLabel";
import { PermissionGate, usePermissions } from "@/hooks/usePermissions";
import { useRole } from "@/hooks/useRole";
import type { Branch, Category, Item, StockMovement, Supplier } from "@/types/inventory";
import { ItemStatus } from "@/types/inventory";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  createCategory as createDatabaseCategory,
  createItem as createDatabaseItem,
  deleteItem as deleteDatabaseItem,
  fetchCategories,
  fetchBranches,
  fetchSuppliers,
  updateItem as updateDatabaseItem,
} from "@/lib/db-api";
import {
  fetchCatalogServiceItems,
  fetchMovementTransactions,
} from "@/lib/movements-backend-api";

interface ItemFilters {
  categoryId?: string;
  supplierId?: string;
  branchId?: string;
  status?: string;
  search?: string;
}

interface CatalogSearch {
  item?: string;
  newItem?: string;
}

interface DatabaseMutation<TData> {
  mutate: (data: TData, opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) => void;
  isLoading: boolean;
}

function useCatalogQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T[]>,
) {
  return useQuery({
    queryKey,
    queryFn,
    initialData: [] as T[],
  });
}

function useCatalogMutation<TData>(
  mutateFn: (data: TData) => Promise<void>,
  invalidateKeys: readonly unknown[],
): DatabaseMutation<TData> {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    (data: TData, opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
      setIsLoading(true);

      mutateFn(data)
        .then(async () => {
          await queryClient.invalidateQueries({ queryKey: invalidateKeys });
          opts?.onSuccess?.();
        })
        .catch((e) => {
          opts?.onError?.(e instanceof Error ? e : new Error(String(e)));
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [invalidateKeys, mutateFn, queryClient],
  );

  return { mutate, isLoading };
}

function useCatalogCreateItem() {
  return useCatalogMutation<Item>(createDatabaseItem, ["db", "items"]);
}

function useCatalogUpdateItem() {
  return useCatalogMutation<{ id: string; updates: Partial<Item> }>(
    ({ id, updates }) => updateDatabaseItem(id, updates),
    ["db", "items"],
  );
}

function useCatalogDeleteItem() {
  return useCatalogMutation<string>(deleteDatabaseItem, ["db", "items"]);
}

function useCatalogCreateCategory() {
  return useCatalogMutation<Category>(createDatabaseCategory, ["db", "categories"]);
}

export const Route = createFileRoute("/app/catalog")({
  component: CatalogPage,
  head: () => ({ meta: [{ title: "Inventory — Queenstech ERP" }] }),
  validateSearch: (search: Record<string, unknown>): CatalogSearch => ({
    item: typeof search.item === "string" ? search.item : undefined,
    newItem: typeof search.newItem === "string" ? search.newItem : undefined,
  }),
});

function CatalogPage() {
  const { item: itemId, newItem } = Route.useSearch();
  const navigate = useNavigate();

  // Auto-open create form when navigated with newItem param
  useEffect(() => {
    if (newItem) {
      setSheetOpen(true);
      navigate({ to: "/app/catalog", search: {}, replace: true });
    }
  }, [newItem, navigate]);

  const [filters, setFilters] = useState<ItemFilters>({});
  const [sort, setSort] = useState<SortState>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [movementItemId, setMovementItemId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const importFields = useMemo<ImportField[]>(() => [
    { key: "name", label: "Name", required: true },
    { key: "sku", label: "SKU", required: true },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "supplier", label: "Supplier" },
    { key: "location", label: "Location" },
    { key: "quantity", label: "Quantity", numeric: true },
    { key: "reorderPoint", label: "Reorder Point", numeric: true },
    { key: "unit", label: "Unit" },
    { key: "costPrice", label: "Unit Cost", numeric: true },
    { key: "sellingPrice", label: "Price", numeric: true },
    { key: "barcode", label: "Barcode" },
  ], []);

  // Strip stock-level status before passing to store
  const storeFilters = useMemo(() => {
    const { status, branchId, ...rest } = filters;
    return {
      ...rest,
      locationId: branchId,
    };
  }, [filters]);

  const { data: allItems } = useCatalogQuery<Item>(
    ["db", "items", storeFilters.categoryId, storeFilters.supplierId, storeFilters.search, storeFilters.locationId],
    async () => {
      const items = await fetchCatalogServiceItems(storeFilters);
      return items.map((item) => ({
        ...item,
        branchId: item.branchId ?? item.locationId ?? null,
        locationId: item.locationId ?? item.branchId ?? null,
      }));
    },
  );
  const { data: categories } = useCatalogQuery<Category>(["db", "categories"], fetchCategories);
  const { data: suppliers } = useCatalogQuery<Supplier>(["db", "suppliers"], fetchSuppliers);
  const { data: branches } = useCatalogQuery<Branch>(["db", "branches"], fetchBranches);
  const { data: movements } = useCatalogQuery<StockMovement>(["db", "stock_movements"], () => fetchMovementTransactions());
  const createItem = useCatalogCreateItem();
  const updateItem = useCatalogUpdateItem();
  const deleteItem = useCatalogDeleteItem();
  const createCategory = useCatalogCreateCategory();
  const { can } = usePermissions();
  const { isAdmin } = useRole();

  // Derive detail item from URL search param
  const detailItem = useMemo(() => {
    if (!itemId) return null;
    return allItems.find((i) => i.id === itemId) ?? null;
  }, [itemId, allItems]);

  const openDetail = useCallback((item: Item) => {
    navigate({ to: "/app/catalog", search: { item: item.id } });
  }, [navigate]);

  const closeDetail = useCallback(() => {
    navigate({ to: "/app/catalog", search: {} });
  }, [navigate]);
  const items = useMemo(() => {
    let result = allItems.filter((i) => i.status !== ItemStatus.Archived);
    if (filters.status === "in-stock") result = result.filter((i) => i.currentStock > i.reorderPoint);
    else if (filters.status === "low-stock") result = result.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderPoint);
    else if (filters.status === "out-of-stock") result = result.filter((i) => i.currentStock === 0);
    else if (filters.status === "most-selling") {
      const sold = new Map<string, number>();
      for (const m of movements) {
        if (m.sale || m.type === "shipped") {
          sold.set(m.itemId, (sold.get(m.itemId) ?? 0) + Math.abs(m.quantity));
        }
      }
      result = [...result]
        .filter((i) => (sold.get(i.id) ?? 0) > 0)
        .sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0));
    }
    return result;
  }, [allItems, filters.status, movements]);


  const existingSkus = useMemo(() => allItems.map((i) => i.sku), [allItems]);

  const csvColumns = useMemo<CSVColumn<Item>[]>(() => [
    { header: "Name", accessor: (i) => i.name },
    { header: "SKU", accessor: (i) => i.sku },
    { header: "Category", accessor: (i) => categories.find((c) => c.id === i.categoryId)?.name ?? "" },
    { header: "Supplier", accessor: (i) => suppliers.find((s) => s.id === i.supplierId)?.name ?? "" },
    { header: "Branch", accessor: (i) => branches.find((branch) => branch.id === (i.branchId ?? i.locationId))?.name ?? "" },
    { header: "Quantity", accessor: (i) => i.currentStock },
    { header: "Reorder Point", accessor: (i) => i.reorderPoint },
    { header: "Unit Cost", accessor: (i) => i.costPrice },
    { header: "Price", accessor: (i) => i.sellingPrice },
    { header: "Status", accessor: (i) => i.status },
  ], [branches, categories, suppliers]);

  const handleSave = useCallback((data: Partial<Item>) => {
    if (editItem) {
      updateItem.mutate({ id: editItem.id, updates: data }, {
        onSuccess: () => { toast.success("Item updated"); setSheetOpen(false); setEditItem(null); },
        onError: (e) => toast.error(e.message || "Failed to update item. Please try again."),
      });
    } else {
      const newItem: Item = {
        id: `item-${Date.now()}`,
        sku: data.sku ?? "",
        barcode: data.barcode ?? null,
        name: data.name ?? "",
        description: data.description ?? "",
        categoryId: data.categoryId ?? null,
        status: data.status ?? ItemStatus.Active,
        unit: data.unit ?? "each",
        currentStock: data.currentStock ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        reorderQuantity: data.reorderQuantity ?? 0,
        costPrice: data.costPrice ?? 0,
        sellingPrice: data.sellingPrice ?? 0,
        branchId: data.branchId ?? data.locationId ?? null,
        locationId: data.locationId ?? data.branchId ?? null,
        supplierId: data.supplierId ?? null,
        imageUrl: null,
        customFields: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      createItem.mutate(newItem, {
        onSuccess: () => {
          toast.success("Item created", {
            action: { label: "Undo", onClick: () => { deleteItem.mutate(newItem.id, { onSuccess: () => toast.success("Item creation undone") }); } },
            duration: 5000,
          });
          setSheetOpen(false);
        },
        onError: (e) => toast.error(e.message || "Failed to create item. Please try again."),
      });
    }
  }, [editItem, createItem, updateItem, deleteItem]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (isAdmin) {
      deleteItem.mutate(deleteTarget.id, {
        onSuccess: () => { toast.success(`${deleteTarget.name} deleted`); setDeleteTarget(null); },
        onError: (e) => toast.error(e.message || "Failed to delete item."),
      });
    } else {
      updateItem.mutate({ id: deleteTarget.id, updates: { status: ItemStatus.Archived } }, {
        onSuccess: () => { toast.success(`${deleteTarget.name} archived`); setDeleteTarget(null); },
        onError: (e) => toast.error(e.message || "Failed to archive item."),
      });
    }
  }, [deleteTarget, isAdmin, deleteItem, updateItem]);

  const openEdit = (item: Item) => { setEditItem(item); setSheetOpen(true); };
  const openCreate = () => { setEditItem(null); setSheetOpen(true); };
  const openCreateCategory = () => {
    setCategoryName("");
    setCategoryDescription("");
    setCategoryError("");
    setCategoryDialogOpen(true);
  };

  const handleCreateCategory = useCallback(() => {
    const name = categoryName.trim();
    if (!name) {
      setCategoryError("Category name is required.");
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCategoryError("A category with this name already exists.");
      return;
    }

    const now = new Date().toISOString();
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name,
      description: categoryDescription.trim(),
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };

    createCategory.mutate(newCategory, {
      onSuccess: () => {
        toast.success("Category created");
        setFilters((current) => ({ ...current, categoryId: newCategory.id }));
        setCategoryDialogOpen(false);
        setCategoryName("");
        setCategoryDescription("");
        setCategoryError("");
      },
      onError: (e) => toast.error(e.message || "Failed to create category."),
    });
  }, [categories, categoryDescription, categoryName, createCategory]);

  const handleBulkUpdate = useCallback((updates: Partial<Item>) => {
    const ids = Array.from(selected);
    const count = ids.length;
    ids.forEach((id) => {
      updateItem.mutate({ id, updates });
    });
    toast.success(`Updated ${count} items`);
    setSelected(new Set());
  }, [selected, updateItem]);

  const actionRenderer = (item: Item) => (
    <RowActionsMenu
      item={item}
      onViewDetails={(i) => openDetail(i)}
      onEdit={(i) => openEdit(i)}
      onLogMovement={(i) => setMovementItemId(i.id)}
      onDelete={(i) => setDeleteTarget(i)}
    />
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">{items.length} items in stock</p>
        </div>
        <div className="flex items-center gap-2">
          <CSVExportButton
            data={items}
            columns={csvColumns}
            filename="Queenstech ERP-items"
          />
          <PermissionGate permission="create_item">
            <Button variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />Import
            </Button>
          </PermissionGate>
          <PermissionGate permission="create_item">
            <Button onClick={openCreate} className="hidden gap-1.5 sm:inline-flex">
              <Plus className="h-4 w-4" />New Item
            </Button>
          </PermissionGate>
        </div>
      </div>

      <Card className="p-4">
        <CatalogFilters
          filters={filters}
          onChange={setFilters}
          categories={categories}
          suppliers={suppliers}
          branches={branches}
          onAddCategory={openCreateCategory}
        />
      </Card>

      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) setCategoryError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add new category</DialogTitle>
            <DialogDescription>Create a category for organizing inventory items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Category name</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setCategoryError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCategory();
                }}
                placeholder="e.g. Safety Equipment"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={createCategory.isLoading}>
              {createCategory.isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ErrorBoundary>
      {allItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items in your inventory yet"
          description="Start building your catalog by adding your first product or item."
          actionLabel={can("create_item") ? "Add First Item" : undefined}
          onAction={can("create_item") ? openCreate : undefined}
        />
      ) : (
        <InventoryTable
          items={items}
          movements={movements}
          sort={sort}
          onSortChange={setSort}
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(item) => openDetail(item)}
          actionRenderer={actionRenderer}
          showCheckboxes={can("edit_item")}
        />
      )}
      </ErrorBoundary>

      <ItemFormSheet
        open={sheetOpen}
        onOpenChange={(v) => { setSheetOpen(v); if (!v) setEditItem(null); }}
        item={editItem}
        categories={categories}
        suppliers={suppliers}
        branches={branches}
        items={allItems}
        existingSkus={existingSkus}
        existingBarcodes={allItems.map((i) => i.barcode)}
        onSave={handleSave}
        loading={createItem.isLoading || updateItem.isLoading}
      />

      <ItemDetailSheet
        open={!!detailItem}
        onOpenChange={(v) => { if (!v) closeDetail(); }}
        item={detailItem}
        categories={categories}
        suppliers={suppliers}
        branches={branches}
        onEdit={(item) => { closeDetail(); openEdit(item); }}
        onArchive={(item) => { closeDetail(); setDeleteTarget(item); }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAdmin ? "Delete" : "Archive"} {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? "This action cannot be undone. Movement history will be preserved but the item will be removed."
                : "The item will be archived and hidden from the default view."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{isAdmin ? "Delete" : "Archive"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PermissionGate permission="create_item">
        <button
          type="button"
          onClick={openCreate}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-accent shadow-lg transition-transform hover:scale-105 sm:hidden"
          aria-label="New Item"
        >
          <Plus className="h-6 w-6" />
        </button>
      </PermissionGate>

      <PermissionGate permission="edit_item">
        <BulkActionBar
          selectedCount={selected.size}
          categories={categories}
          suppliers={suppliers}
          branches={branches}
          onUpdateCategory={(id) => handleBulkUpdate({ categoryId: id })}
          onUpdateSupplier={(id) => handleBulkUpdate({ supplierId: id })}
          onUpdateBranch={(id: string) => handleBulkUpdate({ branchId: id, locationId: id })}
          onUpdateStatus={(s) => handleBulkUpdate({ status: s })}
          onDeselectAll={() => setSelected(new Set())}
          onPrintLabels={() => {
            const selectedItems = allItems.filter((i) => selected.has(i.id));
            const locMap = new Map(branches.map((branch) => [branch.id, branch.name]));
            printBarcodeLabels(selectedItems, locMap);
          }}
        />
      </PermissionGate>

      <MovementFormSheet
        open={!!movementItemId}
        onOpenChange={(v) => { if (!v) setMovementItemId(null); }}
        items={allItems}
        locations={branches}
        preSelectedItemId={movementItemId}
      />

      <CSVImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        fields={importFields}
        entityName="items"
        existingSkus={existingSkus}
        knownCategories={categories.map((c) => c.name)}
        knownSuppliers={suppliers.map((s) => s.name)}
        onImport={async (rows) => {
          let created = 0;
          let failed = 0;
          for (const row of rows) {
            try {
              const newItem: Item = {
                id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sku: row.sku ?? "",
                barcode: row.barcode ?? null,
                name: row.name ?? "",
                description: row.description ?? "",
                categoryId: categories.find((c) => c.name.toLowerCase() === row.category?.toLowerCase())?.id ?? null,
                status: ItemStatus.Active,
                unit: row.unit || "each",
                currentStock: Number(row.quantity) || 0,
                reorderPoint: Number(row.reorderPoint) || 0,
                reorderQuantity: 0,
                costPrice: Number(row.costPrice) || 0,
                sellingPrice: Number(row.sellingPrice) || 0,
                branchId: branches.find((branch) => branch.name.toLowerCase() === row.location?.toLowerCase())?.id ?? null,
                locationId: branches.find((branch) => branch.name.toLowerCase() === row.location?.toLowerCase())?.id ?? null,
                supplierId: suppliers.find((s) => s.name.toLowerCase() === row.supplier?.toLowerCase())?.id ?? null,
                imageUrl: null,
                customFields: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              createItem.mutate(newItem);
              created++;
            } catch {
              failed++;
            }
          }
          toast.success(`Imported ${created} items${failed > 0 ? `, ${failed} failed` : ""}`);
          return { created, failed };
        }}
      />
    </div>
  );
}

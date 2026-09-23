import { useState, useMemo, useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Sparkles, Package, TrendingUp, AlertTriangle, TrendingDown, ShoppingCart, Tag, Pencil, Trash2, Archive, CheckCircle2, Boxes, Search as SearchIcon, Clock } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ScrollText } from "lucide-react";
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
  updateCategory as updateDatabaseCategory,
  deleteCategory as deleteDatabaseCategory,
} from "@/lib/db-api";
import {
  fetchCatalogServiceItems,
  fetchMovementTransactions,
} from "@/lib/movements-backend-api";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

function useCatalogUpdateCategory() {
  return useCatalogMutation<{ id: string; updates: Partial<Category> }>(
    ({ id, updates }) => updateDatabaseCategory(id, updates),
    ["db", "categories"],
  );
}

function useCatalogDeleteCategory() {
  return useCatalogMutation<string>(deleteDatabaseCategory, ["db", "categories"]);
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
  const [categoryMode, setCategoryMode] = useState<"list" | "create" | "edit">("list");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Category | null>(null);

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
  const updateCategory = useCatalogUpdateCategory();
  const deleteCategory = useCatalogDeleteCategory();
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

  const dashboardStats = useMemo(() => {
    const totalItems = items.length;
    const totalStock = items.reduce((s, i) => s + (i.currentStock || 0), 0);
    const inventoryValue = items.reduce(
      (s, i) => s + (i.currentStock || 0) * (i.costPrice || i.sellingPrice || 0),
      0,
    );
    const lowStock = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderPoint).length;
    const outOfStock = items.filter((i) => i.currentStock === 0).length;
    const totalCategories = categories.length;
    const totalSuppliers = suppliers.length;
    const activeItems = items.filter((i) => i.status === ItemStatus.Active).length;
    const avgCost = totalStock > 0 ? Math.round(inventoryValue / totalStock) : 0;

    return {
      totalItems,
      totalStock,
      inventoryValue,
      lowStock,
      outOfStock,
      totalCategories,
      totalSuppliers,
      activeItems,
      avgCost,
    };
  }, [items, categories.length, suppliers.length]);

  const recentNewItems = useMemo(() => {
    const withCreated = items
      .filter((i) => i.createdAt)
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (withCreated.length >= 5) return withCreated.slice(0, 6);
    const latest = items.slice().sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
    return latest;
  }, [items]);

  const categoryUsageMap = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it) => {
      if (it.categoryId) m.set(it.categoryId, (m.get(it.categoryId) || 0) + 1);
    });
    return m;
  }, [items]);

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const recentlyAddedCount = useMemo(() => {
    return items.filter((it) => it.createdAt && it.createdAt.slice(0, 10) >= sevenDaysAgo).length;
  }, [items, sevenDaysAgo]);

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
  const openListCategories = () => {
    setCategoryMode("list");
    setEditingCategory(null);
    setCategoryDialogOpen(true);
  };
  const openCreateCategory = () => {
    setCategoryMode("create");
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryError("");
    setCategoryDialogOpen(true);
  };
  const openEditCategory = (cat: Category) => {
    setCategoryMode("edit");
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDescription(cat.description || "");
    setCategoryError("");
    setCategoryDialogOpen(true);
  };
  const confirmDeleteCategory = (cat: Category) => {
    setDeleteCategoryTarget(cat);
  };
  const handleDeleteCategory = useCallback(() => {
    if (!deleteCategoryTarget) return;
    const catId = deleteCategoryTarget.id;
    const inUse = categoryUsageMap.get(catId) || 0;
    if (inUse > 0) {
      toast.error(`Can't delete: ${inUse} item${inUse > 1 ? "s" : ""} still use this category`);
      setDeleteCategoryTarget(null);
      return;
    }
    deleteCategory.mutate(catId, {
      onSuccess: () => {
        toast.success(`Category "${deleteCategoryTarget.name}" deleted`);
        setDeleteCategoryTarget(null);
        if (filters.categoryId === catId) {
          setFilters((curr) => ({ ...curr, categoryId: undefined }));
        }
      },
      onError: (e) => toast.error(e.message || "Failed to delete category"),
    });
  }, [deleteCategory, deleteCategoryTarget, categoryUsageMap, filters.categoryId]);

  const handleSaveCategory = useCallback(() => {
    const name = categoryName.trim();
    if (!name) {
      setCategoryError("Category name is required.");
      return;
    }
    const conflict = categories.some((c) => {
      if (categoryMode === "edit" && editingCategory && c.id === editingCategory.id) return false;
      return c.name.toLowerCase() === name.toLowerCase();
    });
    if (conflict) {
      setCategoryError("A category with this name already exists.");
      return;
    }

    if (categoryMode === "edit" && editingCategory) {
      updateCategory.mutate(
        {
          id: editingCategory.id,
          updates: {
            name,
            description: categoryDescription.trim(),
            updatedAt: new Date().toISOString(),
          },
        },
        {
          onSuccess: () => {
            toast.success("Category updated");
            setCategoryDialogOpen(false);
            setEditingCategory(null);
            setCategoryName("");
            setCategoryDescription("");
            setCategoryError("");
          },
          onError: (e) => toast.error(e.message || "Failed to update category"),
        },
      );
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
  }, [categories, categoryDescription, categoryName, categoryMode, editingCategory, createCategory, updateCategory]);

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

  const visibleDashboardSections = ["hero", "kpis", "newItems", "categories"];

  function sectionIndex(key: string) {
    return Math.max(0, visibleDashboardSections.indexOf(key));
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* HERO / DASHBOARD BANNER */}
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * sectionIndex("hero"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] rotate-6">
              <Boxes className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -left-3 h-8 w-8 rounded-xl bg-amber-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Inventory dashboard
              {recentlyAddedCount > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{recentlyAddedCount} new this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {dashboardStats.totalItems.toLocaleString()} catalog items · UGX {dashboardStats.inventoryValue.toLocaleString()} on hand
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {dashboardStats.totalStock.toLocaleString()} units stocked across {dashboardStats.totalCategories}
              {dashboardStats.totalCategories === 1 ? " category" : " categories"}
              {dashboardStats.totalSuppliers > 0 && ` · from ${dashboardStats.totalSuppliers} supplier${dashboardStats.totalSuppliers === 1 ? "" : "s"}`}
              {dashboardStats.lowStock + dashboardStats.outOfStock > 0 && (
                <> · <span className="font-semibold text-amber-200">
                  {dashboardStats.lowStock} low{dashboardStats.outOfStock > 0 ? ` · ${dashboardStats.outOfStock} out` : ""} stock alerts
                </span></>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <PermissionGate permission="create_item">
              <Button
                onClick={openCreate}
                size="sm"
                className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
              >
                <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
                New Item
              </Button>
            </PermissionGate>

            <PermissionGate permission="create_item">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white backdrop-blur ring-1 ring-white/15 transition-all"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Import
              </Button>
            </PermissionGate>

            <CSVExportButton
              data={items}
              columns={csvColumns}
              filename="Queenstech ERP-items"
              variant="outline"
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white backdrop-blur ring-1 ring-white/15 transition-all"
            />

            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={openListCategories}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white backdrop-blur ring-1 ring-white/15 transition-all"
              >
                <Tag className="mr-1.5 h-4 w-4" />
                Manage categories
              </Button>
            )}
          </div>
        </div>
      </motion.section>

      {/* KPI / STAT CARDS */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIndex("kpis"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <KpiCard
          label="Total items"
          value={dashboardStats.totalItems.toLocaleString()}
          icon={Package}
          hint={`${dashboardStats.activeItems} active`}
          tone="brand"
          onClick={() => setFilters({})}
        />
        <KpiCard
          label="In stock (units)"
          value={dashboardStats.totalStock.toLocaleString()}
          icon={Boxes}
          hint={`UGX ${dashboardStats.avgCost.toLocaleString()} avg cost`}
          tone="emerald"
        />
        <KpiCard
          label="Inventory value"
          value={`UGX ${dashboardStats.inventoryValue.toLocaleString()}`}
          icon={TrendingUp}
          hint={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          tone="blue"
        />
        <KpiCard
          label="Stock alerts"
          value={(dashboardStats.lowStock + dashboardStats.outOfStock).toLocaleString()}
          icon={AlertTriangle}
          hint={`${dashboardStats.lowStock} low · ${dashboardStats.outOfStock} out`}
          tone={dashboardStats.outOfStock > 0 ? "rose" : "amber"}
          onClick={() => setFilters({ status: dashboardStats.outOfStock > 0 ? "out-of-stock" : "low-stock" })}
        />
      </motion.section>

      {/* NEW ITEMS + CATEGORIES PREVIEW ROW */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* RECENTLY ADDED ITEMS */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * sectionIndex("newItems"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2 rounded-2xl border border-border bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
                <Sparkles className="h-3.5 w-3.5" />
                New items
              </div>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">Recently added to catalog</h3>
            </div>
            <PermissionGate permission="create_item">
              <Button
                size="sm"
                variant="outline"
                onClick={openCreate}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            </PermissionGate>
          </div>

          {recentNewItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm font-medium text-foreground">No items yet</p>
            <p className="text-xs text-muted-foreground/80">Add your first item to see it here.</p>
          </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {recentNewItems.map((it, idx) => {
                const cat = it.categoryId ? categories.find((c) => c.id === it.categoryId)?.name : undefined;
                const lowWarn = it.currentStock > 0 && it.currentStock <= it.reorderPoint;
                const outWarn = it.currentStock === 0;
                return (
                  <motion.button
                    key={it.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + idx * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    type="button"
                    onClick={() => openDetail(it)}
                    className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-white to-white p-3.5 text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-16px_rgba(0,0,0,0.12),inset_3px_0_0_rgba(0,51,153,0.5)] hover:border-[#003399]/25]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-semibold text-foreground">
                        {it.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        {it.sku}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 border-0 text-[10px] font-medium",
                        outWarn
                          ? "bg-rose-500/10 text-rose-600"
                          : lowWarn
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-emerald-500/10 text-emerald-600",
                      )}
                    >
                      {outWarn ? "Out" : lowWarn ? "Low" : "In stock"}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Price</div>
                      <div className="font-mono text-sm font-semibold text-foreground">
                        UGX {it.sellingPrice?.toLocaleString() ?? 0}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        Stock
                      </div>
                      <div className="font-mono text-sm font-semibold text-[#003399]">
                        {it.currentStock} {it.unit || "ea"}
                      </div>
                    </div>
                  </div>
                  {cat && (
                    <div className="mt-2.5 flex items-center gap-1 border-t border-border/70 pt-2">
                      <Tag className="h-3 w-3 text-muted-foreground/60" />
                      <span className="line-clamp-1 text-[11px] text-muted-foreground">{cat}</span>
                    </div>
                  )}
                  {it.createdAt && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                      <Clock className="h-2.5 w-2.5" />
                      Added {it.createdAt.slice(0, 10)}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
        </motion.section>

        {/* CATEGORY DISTRIBUTION */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * sectionIndex("categories"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-border bg-white p-5 shadow-sm flex flex-col"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
                <Tag className="h-3.5 w-3.5" />
                Category overview
              </div>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">
                {categories.length} categor{categories.length === 1 ? "y" : "ies"}
              </h3>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={openListCategories}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Manage
              </Button>
            )}
          </div>

          {categories.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <Tag className="h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium text-foreground">No categories yet</p>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={openCreateCategory} className="mt-3 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Create first category
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[...categories]
                .sort((a, b) => (categoryUsageMap.get(b.id) || 0) - (categoryUsageMap.get(a.id) || 0))
                .slice(0, 8)
                .map((c, idx) => {
                  const count = categoryUsageMap.get(c.id) || 0;
                  const maxCount = Math.max(1, ...Array.from(categoryUsageMap.values()));
                  const pct = Math.max(4, Math.round((count / maxCount) * 100));
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + idx * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() =>
                        setFilters((curr) => ({ ...curr, categoryId: curr.categoryId === c.id ? undefined : c.id }))}
                      className={cn(
                        "w-full rounded-xl p-2.5 text-left transition-all duration-150",
                        filters.categoryId === c.id
                          ? "bg-[#003399]/10 ring-1 ring-[#003399]/25 shadow-[inset_3px_0_0_rgba(0,51,153,0.55)]"
                          : "hover:bg-muted/40 border border-transparent hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#003399]/10 text-[#003399]">
                            <Tag className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              {c.name}
                            </div>
                            {c.description && (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {c.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-semibold text-[#003399]">
                          {count}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#003399] to-[#004CCC] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              {categories.length > 8 && (
                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  + {categories.length - 8} more categor{categories.length - 8 === 1 ? "y" : "ies"}
                </p>
              )}
            </div>
          )}
        </motion.section>
      </div>

      <Card className="p-4">
        <CatalogFilters
          filters={filters}
          onChange={setFilters}
          categories={categories}
          suppliers={suppliers}
          branches={branches}
          onAddCategory={isAdmin ? openCreateCategory : undefined}
        />
      </Card>

      <Dialog
        open={categoryDialogOpen}
        onOpenChange={(open) => {
          setCategoryDialogOpen(open);
          if (!open) {
            setCategoryError("");
            setEditingCategory(null);
            setCategoryMode("list");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,640px)] overflow-hidden p-0">
          {categoryMode === "list" ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white px-6 py-5 pr-12"
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                <div className="absolute -left-14 -bottom-20 h-56 w-56 rounded-full bg-white/5 blur-3xl pointer-events-none" />
                <div className="relative flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                    <Tag className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle asChild>
                      <h2 className="text-lg font-semibold tracking-tight">Manage categories</h2>
                    </DialogTitle>
                    <DialogDescription asChild>
                      <p className="mt-0.5 text-sm text-white/80">
                        Create, edit, and organize item categories. {categories.length} total
                      </p>
                    </DialogDescription>
                  </div>
                </div>
              </motion.div>

              <div className="max-h-[calc(90vh-170px)] overflow-y-auto px-6 py-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value=""
                      readOnly
                      placeholder={`Search ${categories.length} categor${categories.length === 1 ? "y" : "ies"}…`}
                      className="pl-9 bg-muted/30"
                    />
                  </div>
                  <Button onClick={openCreateCategory} className="gap-1.5 shrink-0">
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                </div>

                {categories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                    <Tag className="mx-auto h-9 w-9 text-muted-foreground/60" />
                    <p className="mt-2 text-sm font-medium text-foreground">No categories yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">Click "New" to create your first category.</p>
                    <Button size="sm" onClick={openCreateCategory} className="mt-3 gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Create first category
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...categories]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c, idx) => {
                        const count = categoryUsageMap.get(c.id) || 0;
                        return (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="group flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition-all hover:shadow-[0_0_0_1px_rgba(0,51,153,0.1),0_8px_24px_-16px_rgba(0,0,0,0.1)] hover:border-[#003399]/25"
                          >
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003399]/[0.08] ring-1 ring-[#003399]/15">
                              <Tag className="h-4 w-4 text-[#003399]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold text-foreground">
                                  {c.name}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="border-0 shrink-0 font-mono text-[10px] bg-[#003399]/[0.08] text-[#003399]"
                                >
                                  {count} item{count === 1 ? "" : "s"}
                                </Badge>
                              </div>
                              {c.description && (
                                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                                  {c.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-[#003399]/10 hover:text-[#003399]"
                                onClick={() => openEditCategory(c)}
                                title="Edit category"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-30"
                                onClick={() => confirmDeleteCategory(c)}
                                disabled={count > 0}
                                title={count > 0 ? "Can't delete: items still in this category" : "Delete category"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3">
                <div className="flex w-full items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      Categories are used to group, filter, and report on inventory items
                    </span>
                  </p>
                  <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                    Done
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white px-6 py-5 pr-12"
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                <div className="relative flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                    {categoryMode === "edit" ? (
                      <Pencil className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle asChild>
                      <h2 className="text-lg font-semibold tracking-tight">
                        {categoryMode === "edit" ? "Edit category" : "Create category"}
                      </h2>
                    </DialogTitle>
                    <DialogDescription asChild>
                      <p className="mt-0.5 text-sm text-white/80">
                        {categoryMode === "edit"
                          ? "Update the name and optional description below."
                          : "Give your category a clear name so team members can quickly group items."}
                      </p>
                    </DialogDescription>
                  </div>
                </div>
              </motion.div>

              <div className="max-h-[calc(90vh-170px)] overflow-y-auto px-6 py-5 space-y-4">
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
                      if (e.key === "Enter") handleSaveCategory();
                    }}
                    placeholder="e.g. Safety Equipment"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-description">Description</Label>
                  <Textarea
                    id="category-description"
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    placeholder="Optional — what types of items belong here?"
                    rows={3}
                  />
                </div>
                {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
              </div>

              <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategoryMode("list");
                    setEditingCategory(null);
                    setCategoryName("");
                    setCategoryDescription("");
                    setCategoryError("");
                  }}
                >
                  Back
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveCategory}
                    disabled={createCategory.isLoading || updateCategory.isLoading}
                    className="gap-1.5"
                  >
                    {createCategory.isLoading || updateCategory.isLoading ? "Saving…" : categoryMode === "edit" ? "Save changes" : "Create category"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteCategoryTarget}
        onOpenChange={(v) => !v && setDeleteCategoryTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteCategoryTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Make sure no items are still using this category before deleting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteCategory}
              disabled={deleteCategory.isLoading}
            >
              {deleteCategory.isLoading ? "Deleting…" : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

type KpiTone = "brand" | "emerald" | "blue" | "amber" | "rose";

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: typeof Package;
  hint?: string;
  tone?: KpiTone;
  onClick?: () => void;
}) {
  const tones: Record<KpiTone, { chip: string; ring: string; accent: string; border: string }> = {
    brand: {
      chip: "bg-[#003399]/10 text-[#003399]",
      ring: "ring-[#003399]/15",
      accent: "bg-gradient-to-br from-[#003399]/95 to-[#004CCC]",
      border: "group-hover:border-[#003399]/25 group-hover:shadow-[0_10px_34px_-20px_rgba(0,51,153,0.45),inset_3px_0_0_rgba(0,51,153,0.5)]",
    },
    emerald: {
      chip: "bg-emerald-500/10 text-emerald-600",
      ring: "ring-emerald-500/15",
      accent: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      border: "group-hover:border-emerald-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(16,185,129,0.45),inset_3px_0_0_rgba(16,185,129,0.5)]",
    },
    blue: {
      chip: "bg-blue-500/10 text-blue-600",
      ring: "ring-blue-500/15",
      accent: "bg-gradient-to-br from-blue-500 to-blue-600",
      border: "group-hover:border-blue-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(59,130,246,0.45),inset_3px_0_0_rgba(59,130,246,0.5)]",
    },
    amber: {
      chip: "bg-amber-500/10 text-amber-600",
      ring: "ring-amber-500/15",
      accent: "bg-gradient-to-br from-amber-500 to-amber-600",
      border: "group-hover:border-amber-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(245,158,11,0.45),inset_3px_0_0_rgba(245,158,11,0.5)]",
    },
    rose: {
      chip: "bg-rose-500/10 text-rose-600",
      ring: "ring-rose-500/15",
      accent: "bg-gradient-to-br from-rose-500 to-rose-600",
      border: "group-hover:border-rose-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(244,63,94,0.45),inset_3px_0_0_rgba(244,63,94,0.5)]",
    },
  };
  const t = tones[tone];
  return (
    <motion.button
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      type="button"
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        onClick && "cursor-pointer",
        t.border,
      )}
    >
      <div className={cn(
        "absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.07] transition-transform duration-500 group-hover:scale-125",
        t.accent,
      )} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">
            {label}
          </span>
          <div className="mt-1 font-mono text-xl font-bold text-foreground leading-tight">
            {value}
          </div>
          {hint && (
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              {hint}
            </p>
          )}
        </div>
        <span className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110",
          t.chip,
          t.ring,
        )}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </motion.button>
  );
}

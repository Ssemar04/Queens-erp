import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCategories,
  fetchItemById,
  fetchItems,
  fetchLocations,
  fetchMovements,
  fetchPurchaseOrders,
  fetchRequests,
  fetchSuppliers,
} from "@/lib/db-api";
import type {
  Item,
  Category,
  Supplier,
  Location,
  StockMovement,
  PurchaseOrder,
  InventoryRequest,
} from "@/types/inventory";
import type { ItemFilters, StockSummary } from "@/lib/demo-store";

import { useBranch } from "@/contexts/BranchContext";

interface QueryResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
}

function useBackendQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
): QueryResult<T> {
  const { currentBranchId } = useBranch();
  const query = useQuery({
    queryKey: [currentBranchId || "default", ...queryKey],
    queryFn,
    enabled: true,
  });

  return {
    data: query.data || ([] as unknown as T),
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}

export function useItems(filters?: ItemFilters): QueryResult<Item[]> {
  return useBackendQuery(
    ["db", "items", filters?.categoryId, filters?.supplierId, filters?.status, filters?.search, filters?.locationId],
    () => fetchItems(filters),
  );
}

export function useItemById(id: string): QueryResult<Item | undefined> {
  return useBackendQuery(["db", "items", id], () => fetchItemById(id));
}

export function useCategories(): QueryResult<Category[]> {
  return useBackendQuery(["db", "categories"], fetchCategories);
}

export function useSuppliers(): QueryResult<Supplier[]> {
  return useBackendQuery(["db", "suppliers"], fetchSuppliers);
}

export function useLocations(): QueryResult<Location[]> {
  return useBackendQuery(["db", "locations"], fetchLocations);
}

export function useMovements(limit?: number): QueryResult<StockMovement[]> {
  return useBackendQuery(["db", "stock_movements", limit], () => fetchMovements(limit));
}

export function useStockSummary(): QueryResult<StockSummary> {
  const { data: items, isLoading, error } = useItems();
  const data = useMemo<StockSummary>(
    () => ({
      total: items.length,
      inStock: items.filter((i) => i.currentStock > i.reorderPoint).length,
      lowStock: items.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderPoint).length,
      outOfStock: items.filter((i) => i.currentStock === 0).length,
    }),
    [items],
  );

  return { data, isLoading, error };
}

export function usePurchaseOrders(): QueryResult<PurchaseOrder[]> {
  return useBackendQuery(["db", "purchase_orders"], fetchPurchaseOrders);
}

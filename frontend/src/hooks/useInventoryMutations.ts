import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createItem as createDbItem,
  deleteItem as deleteDbItem,
  updateItem as updateDbItem,
  createMovement,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createRequest,
  updateRequest,
  createLocation,
  updateLocation,
  deleteLocation,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/db-api";
import type {
  Item,
  Supplier,
  Location,
  StockMovement,
  PurchaseOrder,
  InventoryRequest,
} from "@/types/inventory";

interface MutationResult<TData> {
  mutate: (
    data: TData,
    opts?: { onSuccess?: () => void; onError?: (e: Error) => void; onSettled?: () => void },
  ) => void;
  isLoading: boolean;
  error: Error | null;
}

function useMutation<TData>(
  dbHandler: (data: TData) => Promise<void>,
  invalidateKeys: readonly unknown[] = ["db"],
): MutationResult<TData> {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    (data: TData, opts?: { onSuccess?: () => void; onError?: (e: Error) => void; onSettled?: () => void }) => {
      setIsLoading(true);
      const run = async () => {
        await dbHandler(data);
        await queryClient.invalidateQueries({ queryKey: invalidateKeys });
      };

      run()
        .then(() => {
          setError(null);
          opts?.onSuccess?.();
        })
        .catch((e) => {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          opts?.onError?.(err);
        })
        .finally(() => {
          setIsLoading(false);
          opts?.onSettled?.();
        });
    },
    [dbHandler, invalidateKeys, queryClient],
  );

  return { mutate, isLoading, error };
}

export function useCreateItem() {
  return useMutation<Item>(createDbItem, ["db", "items"]);
}

export function useUpdateItem() {
  return useMutation<{ id: string; updates: Partial<Item> }>(
    ({ id, updates }) => updateDbItem(id, updates),
    ["db", "items"],
  );
}

export function useDeleteItem() {
  return useMutation<string>(deleteDbItem, ["db", "items"]);
}

export function useCreateMovement() {
  return useMutation<StockMovement>(createMovement, ["db", "stock_movements", "db", "items"]);
}

export function useCreatePurchaseOrder() {
  return useMutation<PurchaseOrder>(createPurchaseOrder, ["db", "purchase_orders"]);
}

export function useUpdatePurchaseOrder() {
  return useMutation<{ id: string; updates: Partial<PurchaseOrder> }>(
    ({ id, updates }) => updatePurchaseOrder(id, updates),
    ["db", "purchase_orders"],
  );
}

export function useDeletePurchaseOrder() {
  return useMutation<string>(deletePurchaseOrder, ["db", "purchase_orders"]);
}

export function useCreateSupplier() {
  return useMutation<Supplier>(createSupplier, ["db", "suppliers"]);
}

export function useUpdateSupplier() {
  return useMutation<{ id: string; updates: Partial<Supplier> }>(
    ({ id, updates }) => updateSupplier(id, updates),
    ["db", "suppliers"],
  );
}

export function useDeleteSupplier() {
  return useMutation<string>(deleteSupplier, ["db", "suppliers"]);
}

export function useCreateLocation() {
  return useMutation<Location>(createLocation, ["db", "locations"]);
}

export function useUpdateLocation() {
  return useMutation<{ id: string; updates: Partial<Location> }>(
    ({ id, updates }) => updateLocation(id, updates),
    ["db", "locations"],
  );
}

export function useDeleteLocation() {
  return useMutation<string>(deleteLocation, ["db", "locations"]);
}

// ─── Category mutations ─────────────────────────────────
export function useCreateCategory() {
  return useMutation<import("@/types/inventory").Category>(createCategory, ["db", "categories"]);
}

export function useUpdateCategory() {
  return useMutation<{ id: string; updates: Partial<import("@/types/inventory").Category> }>(
    ({ id, updates }) => updateCategory(id, updates),
    ["db", "categories"],
  );
}

export function useDeleteCategory() {
  return useMutation<string>(deleteCategory, ["db", "categories"]);
}

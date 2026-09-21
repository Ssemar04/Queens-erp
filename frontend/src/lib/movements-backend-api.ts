import type { Item, StockMovement } from "@/types/inventory";
import type { ItemFilters } from "@/lib/demo-store";
import {
  createCatalogMovement,
  createCatalogMovements,
  deleteTransactionByReceipt,
  getItems,
  getMovements,
  updateTransactionStatusByReceipt,
} from "@/services/api";

export function fetchCatalogServiceItems(filters?: ItemFilters): Promise<Item[]> {
  return getItems(filters);
}

export function fetchMovementTransactions(limit?: number): Promise<StockMovement[]> {
  return getMovements(limit);
}

export async function saveMovementTransaction(movement: StockMovement): Promise<StockMovement> {
  return createCatalogMovement(movement);
}

export async function saveMovementTransactions(movements: StockMovement[]): Promise<StockMovement[]> {
  if (movements.length === 0) return [];
  if (movements.length === 1) return [await saveMovementTransaction(movements[0])];
  return createCatalogMovements(movements);
}

export async function updateMovementTransactionStatus(
  receiptNumber: string,
  status: string,
): Promise<StockMovement[]> {
  const result = await updateTransactionStatusByReceipt(receiptNumber, status);
  return result.movements;
}

export async function deleteMovementTransaction(receiptNumber: string): Promise<void> {
  await deleteTransactionByReceipt(receiptNumber);
}

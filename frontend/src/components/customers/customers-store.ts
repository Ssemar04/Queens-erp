import { useCallback, useEffect, useState } from "react";
import {
  addCustomerInteraction,
  createCustomer,
  deleteCustomer,
  getCustomers,
  getNextCustomerReference,
  updateCustomer,
} from "@/services/api";
import type {
  Customer as ApiCustomer,
  CustomerInteraction as ApiCustomerInteraction,
} from "@/services/api";

export type Customer = ApiCustomer;
export type CustomerInteraction = ApiCustomerInteraction;
export type CustomerType = Customer["type"];
export type CustomerStage = Customer["stage"];
export type CustomerTier = Customer["tier"];

export function nextReference(list: Customer[]): string {
  const nums = list
    .map((c) => parseInt(c.reference.split("-").pop() || "0", 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `CUS-${String(next).padStart(5, "0")}`;
}

export async function nextDatabaseReference(fallback: Customer[]): Promise<string> {
  try {
    return await getNextCustomerReference();
  } catch {
    return nextReference(fallback);
  }
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await getCustomers());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load customers";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload().catch(() => undefined);
    const handleBranchChange = () => {
      reload().catch(() => undefined);
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);

    return () => {
      window.removeEventListener("qterp:branch-changed", handleBranchChange);
    };
  }, [reload]);

  const add = useCallback(async (customer: Customer) => {
    const created = await createCustomer(customer);
    setCustomers((current) => [created, ...current.filter((c) => c.id !== created.id)]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<Customer>) => {
    const updated = await updateCustomer(id, patch);
    setCustomers((current) => current.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteCustomer(id);
    setCustomers((current) => current.filter((c) => c.id !== id));
  }, []);

  const addInteraction = useCallback(async (id: string, interaction: CustomerInteraction) => {
    const updated = await addCustomerInteraction(id, interaction);
    setCustomers((current) => current.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  return { customers, loading, error, reload, add, update, remove, addInteraction };
}

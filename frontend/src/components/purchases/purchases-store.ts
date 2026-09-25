import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getPurchases,
  createPurchase as createPurchaseApi,
  updatePurchase as updatePurchaseApi,
  deletePurchase as deletePurchaseApi,
  type Purchase,
} from "@/services/api";

export type { Purchase };
export type PurchaseDraft = Omit<Purchase, "id" | "createdAt" | "updatedAt">;

export function usePurchasesStore() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      setReady(false);
      return () => {
        cancelled = true;
      };
    }

    if (!isAuthenticated) {
      setPurchases([]);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    async function loadPurchases() {
      setReady(false);
      try {
        const fetched = await getPurchases();
        if (!cancelled) setPurchases(fetched);
      } catch {
        if (!cancelled) toast.error("Could not load purchases");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    loadPurchases();
    const handleBranchChange = () => {
      loadPurchases();
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);

    return () => {
      cancelled = true;
      window.removeEventListener("qterp:branch-changed", handleBranchChange);
    };
  }, [authLoading, isAuthenticated]);

  const assertCanUseBackend = useCallback(() => {
    if (!isAuthenticated) {
      throw new Error("Sign in to continue.");
    }
  }, [isAuthenticated]);

  const addPurchase = useCallback(
    async (p: Partial<Purchase>) => {
      assertCanUseBackend();
      const created = await createPurchaseApi(p);
      setPurchases((current) => [created, ...current]);
      toast.success(`Purchase ${created.purchaseNumber} recorded`);
      return created;
    },
    [assertCanUseBackend],
  );

  const updatePurchase = useCallback(
    async (id: string, patch: Partial<Purchase>) => {
      assertCanUseBackend();
      const updated = await updatePurchaseApi(id, patch);
      setPurchases((current) => current.map((item) => (item.id === id ? updated : item)));
      toast.success("Purchase updated");
      return updated;
    },
    [assertCanUseBackend],
  );

  const removePurchase = useCallback(
    async (id: string) => {
      assertCanUseBackend();
      await deletePurchaseApi(id);
      setPurchases((current) => current.filter((item) => item.id !== id));
      toast.success("Purchase record removed");
    },
    [assertCanUseBackend],
  );

  return {
    ready,
    purchases,
    addPurchase,
    updatePurchase,
    removePurchase,
  };
}

export const fmtUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

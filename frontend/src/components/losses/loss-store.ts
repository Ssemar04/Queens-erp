import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  createLoss,
  deleteLoss,
  getLosses,
  setLossStatus,
  updateLoss,
} from "@/services/api";

export type LossKind = "inventory" | "asset" | "cash" | "other";
export type LossReason =
  | "damaged"
  | "expired"
  | "theft"
  | "spoilage"
  | "transit"
  | "accident"
  | "write_off"
  | "shortage"
  | "return"
  | "other";
export type LossStatus = "reported" | "approved" | "written_off" | "rejected";

export interface LossRecord {
  id: string;
  reference: string;
  date: string;
  kind: LossKind;
  itemId?: string | null;
  itemName: string;
  assetId?: string | null;
  assetName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  currency: string;
  reasonCode: LossReason;
  description: string;
  locationId?: string | null;
  reportedBy: string;
  status: LossStatus;
  approvedBy?: string | null;
  statusNote?: string | null;
  insuranceClaim: boolean;
  attachment?: string | null;
  movementId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type LossDraft = Omit<LossRecord, "id" | "reference" | "createdAt">;

export const LOSS_KIND_LABELS: Record<LossKind, string> = {
  inventory: "Inventory",
  asset: "Asset",
  cash: "Cash",
  other: "Other",
};

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  damaged: "Damaged",
  expired: "Expired",
  theft: "Theft",
  spoilage: "Spoilage",
  transit: "Damaged in transit",
  accident: "Accident",
  write_off: "Write-off",
  shortage: "Stock shortage",
  return: "Customer return",
  other: "Other",
};

export const LOSS_STATUS_LABELS: Record<LossStatus, string> = {
  reported: "Reported",
  approved: "Approved",
  written_off: "Written off",
  rejected: "Rejected",
};

export const LOSS_REASON_OPTIONS = (Object.keys(LOSS_REASON_LABELS) as LossReason[]).map(
  (value) => ({ value, label: LOSS_REASON_LABELS[value] }),
);

export interface LossStats {
  count: number;
  totalValue: number;
  thisMonthValue: number;
  pending: number;
  byKind: Record<string, { count: number; value: number }>;
  byReason: Record<string, { count: number; value: number }>;
}

function emptyStats(): LossStats {
  return { count: 0, totalValue: 0, thisMonthValue: 0, pending: 0, byKind: {}, byReason: {} };
}

export function computeStats(losses: LossRecord[]): LossStats {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const stats = emptyStats();
  for (const l of losses) {
    const value = Number(l.totalValue) || 0;
    stats.count += 1;
    stats.totalValue += value;
    if ((l.date || "").slice(0, 7) === thisMonth) stats.thisMonthValue += value;
    if (l.status === "reported") stats.pending += 1;

    const kind = stats.byKind[l.kind] ?? { count: 0, value: 0 };
    kind.count += 1;
    kind.value += value;
    stats.byKind[l.kind] = kind;

    const reason = stats.byReason[l.reasonCode] ?? { count: 0, value: 0 };
    reason.count += 1;
    reason.value += value;
    stats.byReason[l.reasonCode] = reason;
  }
  stats.totalValue = Math.round(stats.totalValue * 100) / 100;
  stats.thisMonthValue = Math.round(stats.thisMonthValue * 100) / 100;
  return stats;
}

export function useLosses() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [losses, setLosses] = useState<LossRecord[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setReady(false);
    try {
      const rows = await getLosses();
      setLosses(rows);
    } catch {
      toast.error("Could not load losses");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      setReady(false);
      return;
    }
    if (!isAuthenticated) {
      setLosses([]);
      setReady(true);
      return;
    }
    reload();
    const handleBranchChange = () => reload();
    window.addEventListener("qterp:branch-changed", handleBranchChange);
    return () => window.removeEventListener("qterp:branch-changed", handleBranchChange);
  }, [authLoading, isAuthenticated, reload]);

  const add = useCallback(async (draft: LossDraft) => {
    const created = await createLoss(draft);
    setLosses((prev) => [created, ...prev]);
    toast.success(`Loss ${created.reference} recorded`);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<LossRecord>) => {
    const updated = await updateLoss(id, patch);
    setLosses((prev) => prev.map((l) => (l.id === id ? updated : l)));
    toast.success("Loss updated");
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteLoss(id);
    setLosses((prev) => prev.filter((l) => l.id !== id));
    toast.success("Loss removed and stock restored");
  }, []);

  const changeStatus = useCallback(async (id: string, status: LossStatus, note?: string) => {
    const updated = await setLossStatus(id, status, note);
    setLosses((prev) => prev.map((l) => (l.id === id ? updated : l)));
    toast.success(`Loss marked ${LOSS_STATUS_LABELS[status].toLowerCase()}`);
    return updated;
  }, []);

  const stats = useMemo(() => computeStats(losses), [losses]);

  return { ready, losses, stats, add, update, remove, changeStatus, reload };
}

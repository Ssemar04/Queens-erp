import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  createAsset,
  updateAsset as updateAssetApi,
  deleteAsset,
  addMeterReading,
  addServiceRecord,
  getAssets,
  getNextAssetTag,
  addAssetIncome as addAssetIncomeApi,
  deleteAssetIncome as deleteAssetIncomeApi,
} from "@/services/api";

export type AssetStatus = "active" | "idle" | "maintenance" | "retired";
export type AssetCondition = "excellent" | "good" | "fair" | "poor";
export type MeterUnit = "km" | "hours" | "kwh" | "litres" | "cycles" | "pages";

export interface MeterReading {
  id: string;
  date: string;
  value: number;
  recordedBy: string;
  note?: string;
}

export interface ServiceRecord {
  id: string;
  date: string;
  type: "preventive" | "corrective" | "inspection" | "upgrade";
  performedBy: string;
  cost: number;
  notes: string;
  nextDueDate?: string;
  nextDueMeter?: number;
}

export interface AssetIncome {
  id: string;
  date: string;
  source: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  recordedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  location: string;
  assignedTo: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLifeYears: number;
  status: AssetStatus;
  condition: AssetCondition;
  meterUnit: MeterUnit;
  serviceIntervalMeter: number;
  serviceIntervalDays: number;
  lastServiceDate?: string;
  lastServiceMeter?: number;
  warrantyExpiry?: string;
  insuranceExpiry?: string;
  notes?: string;
  meterReadings: MeterReading[];
  services: ServiceRecord[];
  income: AssetIncome[];
  createdAt: string;
  updatedAt: string;
}

const COLORS = ["#0EA5E9", "#10B981", "#F59E0B", "#6366F1", "#EC4899", "#14B8A6"];
export const CATEGORY_COLOR = (cat: string) =>
  COLORS[Math.abs(hash(cat)) % COLORS.length];
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export function useAssetsStore() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
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
      setAssets([]);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    async function loadAssets() {
      setReady(false);
      try {
        const fetchedAssets = await getAssets();
        if (!cancelled) setAssets(fetchedAssets);
      } catch {
        if (!cancelled) toast.error("Could not load assets");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    loadAssets();
    const handleBranchChange = () => {
      loadAssets();
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

  const addAsset = useCallback(
    async (
      a: Omit<Asset, "id" | "tag" | "createdAt" | "updatedAt" | "meterReadings" | "services" | "income">,
    ) => {
      assertCanUseBackend();
      const asset = await createAsset(a);
      setAssets((current) => [asset, ...current]);
      return asset;
    },
    [assertCanUseBackend],
  );

  const updateAsset = useCallback(
    async (id: string, patch: Partial<Asset>) => {
      assertCanUseBackend();
      const asset = await updateAssetApi(id, patch);
      setAssets((current) => current.map((a) => (a.id === id ? asset : a)));
      return asset;
    },
    [assertCanUseBackend],
  );

  const removeAsset = useCallback(
    async (id: string) => {
      assertCanUseBackend();
      await deleteAsset(id);
      setAssets((current) => current.filter((a) => a.id !== id));
    },
    [assertCanUseBackend],
  );

  const addReading = useCallback(
    async (id: string, r: Omit<MeterReading, "id">) => {
      assertCanUseBackend();
      const updatedAsset = await addMeterReading(id, r);
      setAssets((current) =>
        current.map((a) => (a.id === id ? updatedAsset : a)),
      );
    },
    [assertCanUseBackend],
  );

  const addService = useCallback(
    async (id: string, s: Omit<ServiceRecord, "id">) => {
      assertCanUseBackend();
      const updatedAsset = await addServiceRecord(id, s);
      setAssets((current) =>
        current.map((a) => (a.id === id ? updatedAsset : a)),
      );
    },
    [assertCanUseBackend],
  );

  const addIncome = useCallback(
    async (id: string, income: Omit<AssetIncome, "id" | "createdAt" | "updatedAt">) => {
      assertCanUseBackend();
      const row = await addAssetIncomeApi(id, income);
      setAssets((current) =>
        current.map((a) => (a.id === id ? { ...a, income: [row, ...(a.income ?? [])], updatedAt: new Date().toISOString() } : a)),
      );
      return row;
    },
    [assertCanUseBackend],
  );

  const removeIncome = useCallback(
    async (assetId: string, incomeId: string) => {
      assertCanUseBackend();
      await deleteAssetIncomeApi(assetId, incomeId);
      setAssets((current) =>
        current.map((a) =>
          a.id === assetId
            ? { ...a, income: (a.income ?? []).filter((x) => x.id !== incomeId), updatedAt: new Date().toISOString() }
            : a,
        ),
      );
    },
    [assertCanUseBackend],
  );

  return {
    ready,
    assets,
    addAsset,
    updateAsset,
    removeAsset,
    addReading,
    addService,
    addIncome,
    removeIncome,
  };
}

// --- Computations ---
export function currentMeter(a: Asset): number {
  return a.meterReadings[0]?.value ?? a.lastServiceMeter ?? 0;
}

export function ageYears(a: Asset): number {
  return (
    (Date.now() - new Date(a.purchaseDate).getTime()) /
    (365 * 86400000)
  );
}

export function bookValue(a: Asset): number {
  const annual =
    (a.purchaseCost - a.salvageValue) / Math.max(1, a.usefulLifeYears);
  const v = a.purchaseCost - annual * ageYears(a);
  return Math.max(a.salvageValue, v);
}

export function nextServiceDueDate(a: Asset): string | null {
  if (!a.lastServiceDate) return null;
  const d = new Date(a.lastServiceDate);
  d.setDate(d.getDate() + a.serviceIntervalDays);
  return d.toISOString().slice(0, 10);
}

export function nextServiceDueMeter(a: Asset): number | null {
  if (a.lastServiceMeter == null) return null;
  return a.lastServiceMeter + a.serviceIntervalMeter;
}

export interface ServiceHealth {
  daysToService: number | null;
  meterToService: number | null;
  pressure: number;
  state: "ok" | "due_soon" | "overdue";
}

export function serviceHealth(a: Asset): ServiceHealth {
  const due = nextServiceDueDate(a);
  const cur = currentMeter(a);
  const meterDue = nextServiceDueMeter(a);
  const days = due
    ? Math.round((new Date(due).getTime() - Date.now()) / 86400000)
    : null;
  const meterLeft = meterDue != null ? meterDue - cur : null;

  const dayPressure =
    days != null ? 1 - days / a.serviceIntervalDays : 0;
  const meterPressure =
    meterLeft != null ? 1 - meterLeft / a.serviceIntervalMeter : 0;
  const pressure = Math.max(0, Math.min(1.2, Math.max(dayPressure, meterPressure)));
  const state: ServiceHealth["state"] =
    pressure >= 1 ? "overdue" : pressure >= 0.8 ? "due_soon" : "ok";
  return { daysToService: days, meterToService: meterLeft, pressure, state };
}

export const fmtKES = (n: number) =>
  `UGX ${Math.round(n).toLocaleString()}`;

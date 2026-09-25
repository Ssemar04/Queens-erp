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
  createExpense,
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

export interface AssetConsumable {
  id: string;
  name: string;
  unit: string;
  dateReplaced: string;
  quantity: number;
  replacedBy?: string;
  reason?: string;
}

export interface AssetMonthlyTarget {
  id: string;
  period: string;
  incomeTarget?: number;
}

export interface Asset {
  id: string;
  tag: string;
  name: string;
  category: string;
  serialNumber: string;
  manufacturer?: string;
  model: string;
  location?: string;
  assignedTo?: string;
  staff?: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue?: number;
  usefulLifeYears: number;
  status: AssetStatus;
  condition?: AssetCondition;
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
  consumables: AssetConsumable[];
  monthlyTargets: AssetMonthlyTarget[];
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
        if (!cancelled) {
          const normalized: Asset[] = (fetchedAssets ?? []).map((a: Asset) => ({
            ...a,
            consumables: Array.isArray(a.consumables) ? a.consumables : [],
            monthlyTargets: Array.isArray(a.monthlyTargets) ? a.monthlyTargets : [],
            income: Array.isArray(a.income) ? a.income : [],
            meterReadings: Array.isArray(a.meterReadings) ? a.meterReadings : [],
            services: Array.isArray(a.services) ? a.services : [],
          }));
          setAssets(normalized);
        }
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
      try {
        if (s.cost && s.cost > 0) {
          const asset = updatedAsset as Asset;
          const now = new Date().toISOString().slice(0, 10);
          await createExpense({
            date: s.date || now,
            type: "employee",
            employee: s.performedBy || asset.staff || "System",
            department: "Operations",
            amount: Number(s.cost) || 0,
            currency: "UGX",
            paymentMethod: "petty_cash",
            description: `${s.type ? s.type.charAt(0).toUpperCase() + s.type.slice(1) : "Asset"} service — ${asset.name}${s.notes ? ` · ${s.notes}` : ""}`,
            attachment: null,
            status: "paid",
            reimbursable: false,
            reimbursed: false,
            approvedBy: null,
            rejectedReason: null,
          });
        }
      } catch (err) {
        toast.warning("Service logged; expense sync skipped");
      }
    },
    [assertCanUseBackend],
  );

  const addConsumable = useCallback(
    (id: string, c: Omit<AssetConsumable, "id">) => {
      const row: AssetConsumable = { id: crypto.randomUUID(), ...c };
      setAssets((current) =>
        current.map((a) => a.id === id ? { ...a, consumables: [...(a.consumables ?? []), row], updatedAt: new Date().toISOString() } : a),
      );
      return row;
    },
    [],
  );

  const updateConsumable = useCallback(
    (assetId: string, consumableId: string, patch: Partial<AssetConsumable>) => {
      setAssets((current) =>
        current.map((a) => a.id === assetId
          ? { ...a, consumables: (a.consumables ?? []).map((c) => c.id === consumableId ? { ...c, ...patch } : c), updatedAt: new Date().toISOString() }
          : a),
      );
    },
    [],
  );

  const removeConsumable = useCallback(
    (assetId: string, consumableId: string) => {
      setAssets((current) =>
        current.map((a) => a.id === assetId
          ? { ...a, consumables: (a.consumables ?? []).filter((c) => c.id !== consumableId), updatedAt: new Date().toISOString() }
          : a),
      );
    },
    [],
  );

  const setMonthlyTarget = useCallback(
    (id: string, t: Omit<AssetMonthlyTarget, "id">) => {
      setAssets((current) =>
        current.map((a) => {
          if (a.id !== id) return a;
          const existing = (a.monthlyTargets ?? []).find((m) => m.period === t.period);
          let updatedTargets: AssetMonthlyTarget[];
          if (existing) {
            updatedTargets = (a.monthlyTargets ?? []).map((m) => m.period === t.period ? { ...m, ...t } : m);
          } else {
            updatedTargets = [...(a.monthlyTargets ?? []), { id: crypto.randomUUID(), ...t }];
          }
          return { ...a, monthlyTargets: updatedTargets, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [],
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
    addConsumable,
    updateConsumable,
    removeConsumable,
    setMonthlyTarget,
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
  const salvage = a.salvageValue ?? 0;
  const annual =
    (a.purchaseCost - salvage) / Math.max(1, a.usefulLifeYears);
  const v = a.purchaseCost - annual * ageYears(a);
  return Math.max(salvage, v);
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

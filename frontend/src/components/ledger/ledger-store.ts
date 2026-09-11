import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createLedgerEntry,
  createLedgerPayment,
  deleteLedgerEntry,
  getLedgerEntries,
} from "@/services/api";

export type LedgerKind = "debtor" | "creditor";
export type EntryStatus = "draft" | "open" | "partial" | "paid" | "overdue" | "disputed";

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: "cash" | "mpesa" | "bank" | "cheque" | "card";
  reference?: string;
  note?: string;
}

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  reference: string;
  partyName: string;
  partyRef?: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  paid: number;
  status: EntryStatus;
  notes?: string;
  payments: Payment[];
  promiseToPay?: string;
  tags: string[];
  createdAt: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

export function ageDays(e: LedgerEntry, today = todayISO()): number {
  return daysBetween(today, e.dueDate);
}

export function balance(e: LedgerEntry): number {
  return Math.max(0, e.amount - e.paid);
}

export function bucket(e: LedgerEntry): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  const d = ageDays(e);
  if (d <= 0) return "current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

export function computeStatus(e: Pick<LedgerEntry, "amount" | "paid" | "dueDate" | "status">): EntryStatus {
  if (e.status === "draft" || e.status === "disputed") return e.status;
  const bal = Math.max(0, e.amount - e.paid);
  if (bal === 0) return "paid";
  const overdue = new Date() > new Date(e.dueDate);
  if (e.paid > 0) return overdue ? "overdue" : "partial";
  return overdue ? "overdue" : "open";
}

export function nextReference(kind: LedgerKind, list: LedgerEntry[]): string {
  const prefix = kind === "debtor" ? "INV" : "BILL";
  const nums = list
    .map((e) => parseInt(e.reference.split("-").pop() || "0", 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

export function useLedger(kind: LedgerKind) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      setReady(false);
      try {
        const nextEntries = await getLedgerEntries(kind);
        if (!cancelled) {
          setEntries(nextEntries);
        }
      } catch {
        if (!cancelled) {
          toast.error(`Could not load ${kind === "debtor" ? "debtors" : "creditors"}`);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    loadEntries();
    const handleBranchChange = () => {
      loadEntries();
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);

    return () => {
      cancelled = true;
      window.removeEventListener("qterp:branch-changed", handleBranchChange);
    };
  }, [kind]);

  const add = useCallback(
    async (entry: LedgerEntry) => {
      const created = await createLedgerEntry(kind, { ...entry, status: computeStatus(entry) });
      setEntries((current) => [created, ...current]);
      return created;
    },
    [kind],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteLedgerEntry(kind, id);
      setEntries((current) => current.filter((e) => e.id !== id));
    },
    [kind],
  );

  const pay = useCallback(
    async (id: string, payment: Payment) => {
      const updated = await createLedgerPayment(kind, id, payment);
      setEntries((current) => current.map((e) => (e.id === id ? updated : e)));
      return updated;
    },
    [kind],
  );

  return {
    ready,
    entries,
    add,
    remove,
    pay,
  };
}

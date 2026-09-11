import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  createExpense,
  decideExpenseRecord,
  deleteExpenseRecord,
  getExpensesState,
  reimburseExpenseRecord,
  updateExpenseRecord,
} from "@/services/api";

export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "reimbursed" | "paid";
export type ExpensePaymentMethod = "cash" | "card" | "bank_transfer" | "mobile" | "petty_cash" | "company_card";
export type ExpenseType = "employee" | "travel" | "recurring";
export type RecurringFreq = "weekly" | "monthly" | "quarterly" | "yearly";

export interface Expense {
  id: string;
  reference: string;
  date: string;
  type: ExpenseType;
  employee: string;
  department: string;
  amount: number;
  currency: string;
  paymentMethod: ExpensePaymentMethod;
  description: string;
  attachment: string | null;
  status: ExpenseStatus;
  reimbursable: boolean;
  reimbursed: boolean;
  approvedBy: string | null;
  rejectedReason: string | null;
  recurring?: { frequency: RecurringFreq; nextRun: string } | null;
  travel?: { destination: string; purpose: string; mileage: number } | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  expenseId: string;
  action: string;
  actor: string;
  note: string;
  at: string;
}

interface ExpensesData {
  expenses: Expense[];
  audit: AuditEntry[];
}

const DEPARTMENTS = ["Operations", "Sales", "Finance", "Engineering", "Marketing", "HR", "Procurement"];

export const DEPARTMENT_OPTIONS = DEPARTMENTS;

export function useExpensesStore() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ExpensesData>({ expenses: [], audit: [] });
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
      setData({ expenses: [], audit: [] });
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    async function loadExpenses() {
      setReady(false);
      try {
        const state = await getExpensesState();
        if (!cancelled) {
          const safeExpenses: Expense[] = (state?.expenses ?? []).map((e: Expense & { categoryId?: unknown; vendor?: unknown }) => {
            const { categoryId: _c, vendor: _v, ...rest } = e;
            return rest as Expense;
          });
          setData({ expenses: safeExpenses, audit: state?.audit ?? [] });
        }
      } catch {
        if (!cancelled) toast.error("Could not load expenses");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    loadExpenses();
    const handleBranchChange = () => {
      loadExpenses();
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

  const addExpense = useCallback(async (input: Omit<Expense, "id" | "reference" | "createdAt">) => {
    assertCanUseBackend();
    const exp = await createExpense(input);
    setData((prev) => ({ ...prev, expenses: [exp, ...prev.expenses] }));
    return exp;
  }, [assertCanUseBackend]);

  const updateExpense = useCallback(async (id: string, patch: Partial<Expense>) => {
    assertCanUseBackend();
    const exp = await updateExpenseRecord(id, patch);
    setData((prev) => ({ ...prev, expenses: prev.expenses.map((e) => (e.id === id ? exp : e)) }));
    return exp;
  }, [assertCanUseBackend]);

  const removeExpense = useCallback(async (id: string) => {
    assertCanUseBackend();
    await deleteExpenseRecord(id);
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
      audit: prev.audit.filter((entry) => entry.expenseId !== id),
    }));
  }, [assertCanUseBackend]);

  const duplicateExpense = useCallback(async (id: string) => {
    assertCanUseBackend();
    const src = data.expenses.find((e) => e.id === id);
    if (!src) return undefined;

    const { id: _id, reference: _reference, createdAt: _createdAt, ...copyInput } = src;
    const copy = await createExpense({
      ...copyInput,
      status: "draft",
      approvedBy: null,
      rejectedReason: null,
    });
    setData((prev) => ({ ...prev, expenses: [copy, ...prev.expenses] }));
    return copy;
  }, [assertCanUseBackend, data.expenses]);

  const decideExpense = useCallback(async (id: string, decision: "approved" | "rejected", actor: string, note: string) => {
    assertCanUseBackend();
    const auditId = crypto.randomUUID();
    const exp = await decideExpenseRecord(id, decision, actor, note, auditId);
    const entry: AuditEntry = { id: auditId, expenseId: id, action: decision, actor, note, at: new Date().toISOString() };
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === id ? exp : e)),
      audit: [entry, ...prev.audit],
    }));
    return exp;
  }, [assertCanUseBackend]);

  const reimburse = useCallback(async (id: string, actor: string) => {
    assertCanUseBackend();
    const auditId = crypto.randomUUID();
    const exp = await reimburseExpenseRecord(id, actor, auditId);
    const entry: AuditEntry = {
      id: auditId,
      expenseId: id,
      action: "reimbursed",
      actor,
      note: "Reimbursement processed",
      at: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === id ? exp : e)),
      audit: [entry, ...prev.audit],
    }));
    return exp;
  }, [assertCanUseBackend]);

  return {
    ready,
    expenses: data.expenses,
    audit: data.audit,
    addExpense,
    updateExpense,
    removeExpense,
    duplicateExpense,
    decideExpense,
    reimburse,
  };
}

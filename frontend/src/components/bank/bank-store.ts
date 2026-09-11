import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  createBankAccount,
  createBankTransaction,
  deleteBankAccount,
  getBankState,
  importBankStatement,
  toggleBankTransactionReconciled,
  updateBankAccount,
} from "@/services/api";

export type AccountStatus = "active" | "inactive";
export type Currency = "UGX" | "USD" | "EUR" | "GBP";
export type DepositType = "cash" | "cheque" | "mobile_money";
export type WithdrawalType = "cash" | "cheque" | "transfer" | "mobile_money";
export type MobileProvider = "Airtel Mobile Money" | "MTN Mobile Money";
export type TxnType = "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "charge" | "interest";

export interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch: string;
  swiftCode: string;
  currency: Currency;
  openingBalance: number;
  currentBalance: number;
  status: AccountStatus;
  color: string;
  createdAt: string;
}

export interface ReceiptAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface BankTxn {
  id: string;
  accountId: string;
  date: string;
  type: TxnType;
  subtype?: DepositType | WithdrawalType;
  reference: string;
  description: string;
  amount: number;
  party: string;
  customerId?: string | null;
  mobileProvider?: MobileProvider;
  reconciled: boolean;
  attachment?: ReceiptAttachment | null;
  createdAt: string;
}

export interface StatementLine {
  id: string;
  accountId: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  matchedTxnId?: string | null;
  importedAt: string;
}

export function useBankStore() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [statements, setStatements] = useState<StatementLine[]>([]);
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
      setAccounts([]);
      setTxns([]);
      setStatements([]);
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    async function loadBankState() {
      setReady(false);
      try {
        const state = await getBankState();
        if (cancelled) return;
        setAccounts(state.accounts);
        setTxns(state.txns);
        setStatements(state.statements);
      } catch {
        if (!cancelled) {
          toast.error("Could not load bank data");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    loadBankState();
    const handleBranchChange = () => {
      loadBankState();
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

  const addAccount = useCallback(
    async (a: Omit<BankAccount, "id" | "createdAt" | "currentBalance" | "color"> & { currentBalance?: number }) => {
      assertCanUseBackend();
      const account = await createBankAccount(a);
      setAccounts((current) => [account, ...current]);
      return account;
    },
    [assertCanUseBackend],
  );

  const updateAccount = useCallback(
    async (id: string, patch: Partial<BankAccount>) => {
      assertCanUseBackend();
      const account = await updateBankAccount(id, patch);
      setAccounts((current) => current.map((a) => (a.id === id ? account : a)));
      return account;
    },
    [assertCanUseBackend],
  );

  const removeAccount = useCallback(async (id: string) => {
    assertCanUseBackend();
    await deleteBankAccount(id);
    setAccounts((current) => current.filter((a) => a.id !== id));
    setTxns((current) => current.filter((t) => t.accountId !== id));
    setStatements((current) => current.filter((s) => s.accountId !== id));
  }, [assertCanUseBackend]);

  const addTxn = useCallback(
    async (t: Omit<BankTxn, "id" | "createdAt" | "reconciled"> & { reconciled?: boolean }) => {
      assertCanUseBackend();
      const txn = await createBankTransaction(t);
      setTxns((current) => [txn, ...current]);
      setAccounts((current) =>
        current.map((a) => (a.id === txn.accountId ? { ...a, currentBalance: a.currentBalance + txn.amount } : a)),
      );
      return txn;
    },
    [assertCanUseBackend],
  );

  const toggleReconciled = useCallback(async (id: string) => {
    assertCanUseBackend();
    const txn = await toggleBankTransactionReconciled(id);
    setTxns((current) => current.map((t) => (t.id === id ? txn : t)));
    return txn;
  }, [assertCanUseBackend]);

  const importStatement = useCallback(
    async (accountId: string, lines: Omit<StatementLine, "id" | "accountId" | "importedAt">[]) => {
      assertCanUseBackend();
      const newLines = await importBankStatement(accountId, lines);
      setStatements((current) => [...newLines, ...current]);
      return newLines;
    },
    [assertCanUseBackend],
  );

  return {
    ready,
    accounts,
    txns,
    statements,
    addAccount,
    updateAccount,
    removeAccount,
    addTxn,
    toggleReconciled,
    importStatement,
  };
}

export function fmt(amount: number, currency: Currency = "UGX") {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

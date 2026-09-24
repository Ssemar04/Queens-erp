import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { AddSaleSheet } from "@/components/transactions/AddSaleSheet";
import { CSVExportButton, type CSVColumn } from "@/components/data/CSVExportButton";
import { PermissionGate } from "@/hooks/usePermissions";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { MovementType } from "@/types/inventory";
import type { Item, SaleDetails, StockMovement, TransactionStatus } from "@/types/inventory";
import {
  deleteMovementTransaction,
  fetchCatalogServiceItems,
  fetchMovementTransactions,
  saveMovementTransactions,
  updateMovementTransactionStatus,
} from "@/lib/movements-backend-api";

export const Route = createFileRoute("/app/movements")({
  component: TransactionsPage,
  head: () => ({ meta: [{ title: "Transactions — Queenstech ERP" }] }),
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(n || 0);

export interface GroupedTransaction {
  receiptNumber: string;
  movements: StockMovement[];
  saleDetails: SaleDetails | null;
  createdAt: string;
  customer: string;
  staff: string;
  status: TransactionStatus;
  paymentMethod: string;
  totalItems: number;
  totalAmount: number;
  deposit: number;
  balance: number;
}

function groupTransactions(movements: StockMovement[]): GroupedTransaction[] {
  const grouped = new Map<string, StockMovement[]>();

  for (const movement of movements) {
    if (!movement.sale && movement.type !== MovementType.Shipped) continue;

    const receiptNumber =
      movement.sale?.receiptNumber || movement.reference || `TXN-${movement.id.slice(0, 6)}`;
    const existing = grouped.get(receiptNumber);
    if (existing) {
      existing.push(movement);
    } else {
      grouped.set(receiptNumber, [movement]);
    }
  }

  return Array.from(grouped.entries()).map(([receiptNumber, receiptMovements]) => {
    const firstMovement = receiptMovements[0];
    const saleDetails = receiptMovements.find((movement) => movement.sale)?.sale ?? null;
    const lineItems = saleDetails?.lineItems ?? [];
    const totalItems =
      lineItems.length > 0
        ? lineItems.reduce((sum, item) => sum + item.quantity, 0)
        : receiptMovements.reduce((sum, movement) => sum + Math.abs(movement.quantity), 0);

    return {
      receiptNumber,
      movements: receiptMovements,
      saleDetails,
      createdAt: firstMovement?.createdAt ?? new Date(0).toISOString(),
      customer: saleDetails?.customer || "Walk-in",
      staff: saleDetails?.staff || firstMovement?.performedBy || "",
      status:
        saleDetails?.status === "void"
          ? "void"
          : (saleDetails?.balance ?? 0) <= 0
          ? "paid"
          : (saleDetails?.deposit ?? 0) > 0
          ? "partial"
          : "pending",
      paymentMethod: saleDetails?.paymentMethod ?? "",
      totalItems,
      totalAmount: saleDetails?.totalAmount ?? 0,
      deposit: saleDetails?.deposit ?? 0,
      balance: saleDetails?.balance ?? 0,
    };
  });
}

function TransactionsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { data: movements } = useQuery<StockMovement[]>({
    queryKey: ["backend", "movements"],
    queryFn: () => fetchMovementTransactions(),
    initialData: [],
  });
  const { data: items } = useQuery<Item[]>({
    queryKey: ["backend", "movement-items"],
    queryFn: () => fetchCatalogServiceItems(),
    initialData: [],
  });

  // Only show transactions that are actual sales (have sale details or are Shipped)
  const transactions = useMemo(
    () => groupTransactions(movements),
    [movements],
  );

  const itemNameMap = useMemo(
    () => new Map(items.map((i) => [i.id, i.name])),
    [items],
  );

  const stats = useMemo(() => {
    const total = transactions.reduce((s, transaction) => s + transaction.totalAmount, 0);
    const outstanding = transactions.reduce((s, transaction) => s + transaction.balance, 0);
    return { count: transactions.length, total, outstanding };
  }, [transactions]);

  const csvColumns = useMemo<CSVColumn<GroupedTransaction>[]>(() => [
    { header: "Receipt", accessor: (transaction) => transaction.receiptNumber },
    { header: "Date", accessor: (transaction) => new Date(transaction.createdAt).toLocaleString() },
    {
      header: "Item",
      accessor: (transaction) =>
        transaction.movements
          .map((movement) => itemNameMap.get(movement.itemId) ?? movement.sale?.itemName ?? "")
          .filter(Boolean)
          .join(", "),
    },
    { header: "Quantity", accessor: (transaction) => transaction.totalItems },
    { header: "Total", accessor: (transaction) => transaction.totalAmount },
    { header: "Balance", accessor: (transaction) => transaction.balance },
    { header: "Method", accessor: (transaction) => transaction.paymentMethod },
    { header: "Customer", accessor: (transaction) => transaction.customer },
    { header: "Staff", accessor: (transaction) => transaction.staff },
    { header: "Status", accessor: (transaction) => transaction.status },
  ], [itemNameMap]);

  const statPills = [
    { label: "Transactions", value: String(stats.count) },
    { label: "Gross sales", value: fmt(stats.total) },
    { label: "Outstanding", value: fmt(stats.outstanding), tone: "amber" },
  ];

  const handleCreateMovement = useCallback(
    (newMovements: StockMovement[]) => {
      setIsSaving(true);
      saveMovementTransactions(newMovements)
        .then(async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["backend", "movements"] }),
            queryClient.invalidateQueries({ queryKey: ["backend", "movement-items"] }),
            queryClient.invalidateQueries({ queryKey: ["backend", "customers"] }),
            queryClient.invalidateQueries({ queryKey: ["db", "customers"] }),
            queryClient.invalidateQueries({ queryKey: ["db", "stock_movements"] }),
            queryClient.invalidateQueries({ queryKey: ["db", "items"] }),
          ]);
          const firstMovement = newMovements[0];
          toast.success(`Sale recorded - ${firstMovement?.sale?.receiptNumber ?? firstMovement?.reference ?? "receipt"}`, { duration: 4000 });
          setFormOpen(false);
        })
        .catch((e) => {
          const error = e instanceof Error ? e : new Error(String(e));
          toast.error(error.message || "Failed to record sale");
        })
        .finally(() => {
          setIsSaving(false);
        });
    },
    [queryClient],
  );

  const handleUpdateStatus = useCallback(
    async (receiptNumber: string, newStatus: TransactionStatus) => {
      try {
        await updateMovementTransactionStatus(receiptNumber, newStatus);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["backend", "movements"] }),
          queryClient.invalidateQueries({ queryKey: ["backend", "movement-items"] }),
          queryClient.invalidateQueries({ queryKey: ["db", "stock_movements"] }),
          queryClient.invalidateQueries({ queryKey: ["db", "transactions"] }),
        ]);
        toast.success(`Transaction ${receiptNumber} updated to ${newStatus}`);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        toast.error(error.message || "Failed to update transaction status");
      }
    },
    [queryClient],
  );

  const handleDeleteTransaction = useCallback(
    async (receiptNumber: string) => {
      try {
        await deleteMovementTransaction(receiptNumber);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["backend", "movements"] }),
          queryClient.invalidateQueries({ queryKey: ["backend", "movement-items"] }),
          queryClient.invalidateQueries({ queryKey: ["backend", "customers"] }),
          queryClient.invalidateQueries({ queryKey: ["db", "stock_movements"] }),
          queryClient.invalidateQueries({ queryKey: ["db", "transactions"] }),
          queryClient.invalidateQueries({ queryKey: ["db", "items"] }),
        ]);
        toast.success(`Sale transaction ${receiptNumber} deleted and stock restored`);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        toast.error(error.message || "Failed to delete sale transaction");
      }
    },
    [queryClient],
  );

  const newThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const iso = weekAgo.toISOString().slice(0, 10);
    return transactions.filter((t) => (t.createdAt || "").slice(0, 10) >= iso).length;
  }, [transactions]);

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * sectionIndex("hero"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] -rotate-3">
              <Receipt className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-emerald-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Transactions hub
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {stats.count.toLocaleString()} sales · {fmt(stats.total)} gross
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {stats.count.toLocaleString()} receipts recorded
              {stats.outstanding > 0 && <> · <span className="font-semibold text-amber-200">{fmt(stats.outstanding)} outstanding</span></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <CSVExportButton data={transactions} columns={csvColumns} filename="Queenstech ERP-transactions" />
            <PermissionGate permission="log_movement">
              <Button
                onClick={() => setFormOpen(true)}
                size="sm"
                className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all gap-1.5"
              >
                <Plus className="h-4 w-4 text-[#003399]" />
                Add sale
              </Button>
            </PermissionGate>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {statPills.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p
              className={`mt-1 font-mono text-xl font-semibold ${
                s.tone === "emerald"
                  ? "text-emerald-600"
                  : s.tone === "amber"
                  ? "text-amber-600"
                  : "text-foreground"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <ErrorBoundary>
        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Record your first sale to start tracking receipts, payments, and customer history."
            actionLabel="Add sale"
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <TransactionsTable
            transactions={transactions}
            itemNameMap={itemNameMap}
            onUpdateStatus={handleUpdateStatus}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
      </ErrorBoundary>

      <AddSaleSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        items={items}
        movements={movements}
        onCreateMovement={handleCreateMovement}
        isSaving={isSaving}
      />
    </div>
  );
}

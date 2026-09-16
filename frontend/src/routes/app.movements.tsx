import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
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

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {stats.count} {stats.count === 1 ? "sale" : "sales"} recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CSVExportButton data={transactions} columns={csvColumns} filename="Queenstech ERP-transactions" />
          <PermissionGate permission="log_movement">
            <Button onClick={() => setFormOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add sale
            </Button>
          </PermissionGate>
        </div>
      </div>

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
          <TransactionsTable transactions={transactions} itemNameMap={itemNameMap} onUpdateStatus={handleUpdateStatus} />
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

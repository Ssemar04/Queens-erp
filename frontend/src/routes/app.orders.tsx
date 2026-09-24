import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  ShoppingBag,
  Search,
  Calendar,
  User,
  FileText,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Paperclip,
  Upload,
  Eye,
  X,
  ShoppingCart,
  Minus,
  Download,
  Sparkles,
  Package,
  TrendingUp,
  AlertTriangle,
  TrendingDown,
  Boxes,
  Building2,
  ClipboardList,
  ArrowRight,
  FolderKanban,
  History,
  GripVertical,
  XCircle,
  MessageSquareWarning,
  MessageSquare,
  Check,
  ThumbsDown,
  FilePlus,
  PlusCircle,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  CheckSquare,
  Square,
  DollarSign,
  ShieldCheck,
  FileCheck,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { createOrder, deleteOrder, deleteOrderDocument, getAllDocuments, getCustomers, getEmployees, getItems, getOrderDocuments, getOrders, updateOrder, uploadOrderDocument } from "@/services/api";
import type { Customer } from "@/services/api";
import type { Item } from "@/types/inventory";
import type { OrderComplaint, OrderItem, OrderStatus, QuotationAttachment, SalesDocumentType, SalesOrder, SalesOrderDocument } from "@/types/sales-order";
import type { Employee } from "@/components/employees/employees-store";
import { useRole } from "@/hooks/useRole";
import { useBranch } from "@/contexts/BranchContext";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders · Queenstech ERP" }] }),
});

const STATUS_META: Record<OrderStatus, { label: string; cls: string; icon: typeof Clock }> = {
  submitted: { label: "Submitted", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-500", icon: Clock },
  declined: { label: "Declined", cls: "bg-destructive/10 text-destructive dark:text-rose-400", icon: XCircle },
  successful: { label: "Successful", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500", icon: CheckCircle2 },
};

const OLD_STATUS_MAP: Record<string, OrderStatus> = {
  draft: "submitted",
  confirmed: "submitted",
  in_progress: "submitted",
  delivered: "successful",
  cancelled: "declined",
} as const;

function migrateOrder(o: SalesOrder): SalesOrder {
  const rawStatus = (o.status as unknown as string) || "submitted";
  const mappedStatus: OrderStatus =
    rawStatus === "submitted" || rawStatus === "declined" || rawStatus === "successful"
      ? rawStatus
      : (OLD_STATUS_MAP[rawStatus] ?? "submitted");
  let declineReason = o.declineReason;
  if (mappedStatus === "declined" && !declineReason && rawStatus === "cancelled") {
    declineReason = "Migrated from cancelled status";
  }
  return { ...o, status: mappedStatus, declineReason, complaints: o.complaints ?? [] };
}

function nextLpo(orders: SalesOrder[]): string {
  const nums = orders
    .map((o) => parseInt(o.lpoNumber.split("-").pop() || "0", 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `LPO-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function DeclineReasonDialog({
  order,
  open,
  onOpenChange,
  onConfirm,
}: {
  order: SalesOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (order) {
      setReason(order.declineReason || "");
    } else {
      setReason("");
    }
  }, [order]);

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600">
            <XCircle className="h-5 w-5" />
            Decline Order / LPO ({order.lpoNumber})
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for declining this order from <span className="font-semibold text-foreground">{order.customerName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Decline Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State why this LPO / sales order is declined (e.g. pricing disagreement, items out of stock, cancelled by client)..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
              onOpenChange(false);
            }}
          >
            Confirm Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrdersPage() {
  const { isAdmin, isManager } = useRole();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [documents, setDocuments] = useState<SalesOrderDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "lpo" | "orders">("documents");
  const [formOpen, setFormOpen] = useState(false);
  const [lpoAccountFormOpen, setLpoAccountFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const [lpoSideSheetOrder, setLpoSideSheetOrder] = useState<SalesOrder | null>(null);
  const [declineDialogTarget, setDeclineDialogTarget] = useState<SalesOrder | null>(null);

  const loadDatabaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedEmployees, fetchedCustomers, fetchedItems] = await Promise.all([
        getOrders(),
        getEmployees().catch(() => []),
        getCustomers().catch(() => []),
        getItems().catch(() => []),
      ]);
      setOrders(fetchedOrders.map(migrateOrder));
      setEmployees(fetchedEmployees);
      setCustomers(fetchedCustomers);
      setInventoryItems(fetchedItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load orders";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const allDocs = await getAllDocuments().catch(async () => {
        if (orders.length === 0) return [];
        const results = await Promise.all(
          orders.map((o) => getOrderDocuments(o.id).catch(() => [] as SalesOrderDocument[]))
        );
        return results.flat();
      });
      setDocuments(allDocs);
    } catch (e) {
      // silently ignore; UI will show "Missing" placeholders
    } finally {
      setDocumentsLoading(false);
    }
  }, [orders]);

  useEffect(() => {
    loadDatabaseOrders();
    const handleBranchChange = () => {
      loadDatabaseOrders();
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);

    return () => {
      window.removeEventListener("qterp:branch-changed", handleBranchChange);
    };
  }, [loadDatabaseOrders]);

  useEffect(() => {
    if (orders.length > 0 && (activeTab === "documents" || activeTab === "lpo")) {
      loadAllDocuments();
    }
  }, [activeTab, orders.length, loadAllDocuments]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (overdueOnly) {
        const isOpen = o.status !== "successful" && o.status !== "declined";
        const isOverdue = new Date(o.dateToBeDelivered) < new Date(todayISO());
        if (!(isOpen && isOverdue)) return false;
      }
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        o.lpoNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerQuotation ? o.customerQuotation.toLowerCase().includes(q) : false) ||
        o.handledBy.toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter, overdueOnly]);

  const sections = ["hero", "kpis", "tabs", "documents", "lpo", "orders"];
  const sectionIndex = (key: string) => Math.max(0, sections.indexOf(key));

  const dashboardStats = useMemo(() => {
    const totalOrders = orders.length;
    const totalValue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const submittedCount = orders.filter((o) => o.status === "submitted").length;
    const submittedValue = orders
      .filter((o) => o.status === "submitted")
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const successfulCount = orders.filter((o) => o.status === "successful").length;
    const successfulValue = orders
      .filter((o) => o.status === "successful")
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const declinedCount = orders.filter((o) => o.status === "declined").length;
    const declinedValue = orders
      .filter((o) => o.status === "declined")
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const today = todayISO();
    let overdueCount = 0;
    let overdueValue = 0;
    const thisMonth = new Date().toISOString().slice(0, 7);
    let successfulThisMonth = 0;
    let successfulThisMonthValue = 0;
    orders.forEach((o) => {
      const isOpen = o.status !== "successful" && o.status !== "declined";
      if (isOpen && new Date(o.dateToBeDelivered) < new Date(today)) {
        overdueCount++;
        overdueValue += Number(o.amount) || 0;
      }
      if (o.status === "successful") {
        const d = (o.updatedAt || o.createdAt || "").slice(0, 7);
        if (d === thisMonth) {
          successfulThisMonth++;
          successfulThisMonthValue += Number(o.amount) || 0;
        }
      }
    });
    return {
      totalOrders,
      totalValue,
      submittedCount,
      submittedValue,
      successfulCount,
      successfulValue,
      declinedCount,
      declinedValue,
      overdueCount,
      overdueValue,
      successfulThisMonth,
      successfulThisMonthValue,
    };
  }, [orders]);

  const newThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const iso = weekAgo.toISOString().slice(0, 10);
    return orders.filter((o) => (o.createdAt || "").slice(0, 10) >= iso).length;
  }, [orders]);

  const branchScopedEmployees = useMemo(() => {
    return employees.filter((e) => {
      const statusOk = !e.status || e.status.toLowerCase() === "active" || e.status.toLowerCase() === "probation";
      if (!statusOk) return false;
      if (!currentBranchId) return true;
      return e.branchId === currentBranchId || !e.branchId;
    });
  }, [employees, currentBranchId]);

  async function handleCreate(order: SalesOrder) {
    setSaving(true);
    try {
      const created = await createOrder(order);
      setOrders((current) => [created, ...current]);
      toast.success(`${created.lpoNumber} created`);
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create order";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: OrderStatus, declineReason?: string) {
    if (status === "declined" && !declineReason) {
      const target = orders.find((o) => o.id === id);
      if (target) {
        setDeclineDialogTarget(target);
        return;
      }
    }
    try {
      const payload: Partial<SalesOrder> = { status };
      if (status === "declined") {
        payload.declineReason = declineReason || "Declined without specified reason";
      }
      const updated = await updateOrder(id, payload);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      if (previewOrder?.id === id) {
        setPreviewOrder(updated);
      }
      toast.success(status === "declined" ? "Order marked as declined" : "Status updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    }
  }

  async function handleConfirmDecline(reason: string) {
    if (!declineDialogTarget) return;
    await handleStatusChange(declineDialogTarget.id, "declined", reason);
    setDeclineDialogTarget(null);
  }

  async function handleUpdateOrder(id: string, updates: Partial<SalesOrder>) {
    try {
      const updated = await updateOrder(id, updates);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      if (previewOrder?.id === id) {
        setPreviewOrder(updated);
      }
      toast.success("Order updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update order";
      toast.error(message);
    }
  }

  async function handleHandledByChange(id: string, handledBy: string) {
    try {
      const updated = await updateOrder(id, { handledBy });
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      toast.success(`Handled by updated to ${handledBy}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update handler";
      toast.error(message);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) {
      toast.error("Admin access required to delete orders");
      return;
    }
    try {
      await deleteOrder(id);
      setOrders((current) => current.filter((o) => o.id !== id));
      toast.success("Order removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove order";
      toast.error(message);
    }
  }

  const canManageDocs = isAdmin || isManager;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* HERO / DASHBOARD BANNER */}
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
              <ShoppingBag className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-amber-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Orders hub
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} new this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {dashboardStats.totalOrders.toLocaleString()} sales orders · UGX {dashboardStats.totalValue.toLocaleString()} lifetime
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {dashboardStats.submittedCount} submitted · UGX {dashboardStats.submittedValue.toLocaleString()} in play · {dashboardStats.successfulCount} successful · {dashboardStats.declinedCount} declined
              {dashboardStats.overdueCount > 0 && (
                <> · <span className="font-semibold text-amber-200">{dashboardStats.overdueCount} overdue</span></>
              )}
              {dashboardStats.successfulThisMonth > 0 && (
                <> · <span className="text-emerald-200/90">{dashboardStats.successfulThisMonth.toLocaleString()} closed this month (UGX {dashboardStats.successfulThisMonthValue.toLocaleString()})</span></>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              onClick={() => setFormOpen(true)}
              size="sm"
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
              New order
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPI / STAT CARDS */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIndex("kpis"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <KpiCard
          label="Total orders"
          value={dashboardStats.totalOrders.toLocaleString()}
          icon={Package}
          hint={`UGX ${dashboardStats.totalValue.toLocaleString()} lifetime`}
          tone="brand"
        />
        <KpiCard
          label="Submitted"
          value={dashboardStats.submittedCount.toLocaleString()}
          icon={Clock}
          hint={`UGX ${dashboardStats.submittedValue.toLocaleString()} in play`}
          tone="amber"
        />
        <KpiCard
          label="Overdue"
          value={dashboardStats.overdueCount.toLocaleString()}
          icon={AlertTriangle}
          hint={dashboardStats.overdueCount > 0 ? `UGX ${dashboardStats.overdueValue.toLocaleString()} at risk` : "All deliveries on track"}
          tone={dashboardStats.overdueCount > 0 ? "rose" : "emerald"}
          onClick={() => {
            setOverdueOnly((curr) => !curr);
            setActiveTab("orders");
          }}
        />
        <KpiCard
          label="Successful this month"
          value={dashboardStats.successfulThisMonth.toLocaleString()}
          icon={CheckCircle2}
          hint={`UGX ${dashboardStats.successfulThisMonthValue.toLocaleString()} value`}
          tone="emerald"
        />
      </motion.section>

      {/* TAB BAR */}
      <motion.section
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIndex("tabs"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-md items-center rounded-full bg-muted/40 p-1 ring-1 ring-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
      >
        {(["documents", "lpo", "orders"] as const).map((t) => {
          const active = activeTab === t;
          const label =
            t === "documents" ? `Documents ${documents.length ? `(${documents.length})` : ""}`
            : t === "lpo" ? `LPO ${orders.length ? `(${orders.length})` : ""}`
            : `Orders ${filtered.length ? `(${filtered.length})` : ""}`;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className="relative flex-1 px-3.5 py-1.5 text-sm font-medium capitalize transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              {active && (
                <motion.span
                  layoutId="orders-tab-slider"
                  className="absolute inset-0 rounded-full bg-[#003399] shadow-[0_4px_14px_-4px_rgba(0,51,153,0.5)]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className={cn("relative z-10 whitespace-nowrap", active ? "text-white" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </span>
            </button>
          );
        })}
      </motion.section>

      {activeTab === "documents" && (
        <DocumentsWorkspace
          orders={orders}
          employees={branchScopedEmployees}
          canManageDocs={canManageDocs}
          isAdmin={isAdmin}
          isManager={isManager}
          documents={documents}
          onRefreshDocuments={loadAllDocuments}
        />
      )}

      {activeTab === "lpo" && (
        <LpoWorkspace
          orders={orders}
          documents={documents}
          customers={customers}
          employees={branchScopedEmployees}
          onPreview={(o) => setLpoSideSheetOrder(o)}
          onSwitchToDocuments={() => setActiveTab("documents")}
          onCreateLpoAccount={() => setLpoAccountFormOpen(true)}
        />
      )}

      {activeTab === "orders" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search LPO, customer, quotation, handler…"
                className="bg-white pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {overdueOnly && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOverdueOnly(false)}
                className="gap-1.5 border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue only
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={loading ? "Loading orders" : orders.length === 0 ? "No orders yet" : "No matching orders"}
              description={
                loading
                  ? "Fetching the latest sales orders from the database."
                  : orders.length === 0
                  ? "Create your first sales order from a customer LPO to get started."
                  : "Try a different search or status filter."
              }
              actionLabel={!loading && orders.length === 0 ? "New order" : undefined}
              onAction={!loading && orders.length === 0 ? () => setFormOpen(true) : undefined}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    <TableHead>LPO #</TableHead>
                    <TableHead>Date received</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Delivery date</TableHead>
                    <TableHead>Handled by</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[96px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const meta = STATUS_META[o.status];
                    const StatusIcon = meta.icon;
                    const overdue =
                      o.status !== "successful" &&
                      o.status !== "declined" &&
                      new Date(o.dateToBeDelivered) < new Date(todayISO());
                    return (
                      <TableRow
                        key={o.id}
                        onClick={() => setPreviewOrder(o)}
                        className="group cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[inset_3px_0_0_rgba(0,51,153,0.5),0_4px_20px_-8px_rgba(0,0,0,0.1)] hover:border-[#003399]/30"
                      >
                        <TableCell className="font-mono text-sm font-medium">{o.lpoNumber}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {o.dateReceived}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{o.customerName}</TableCell>
                        <TableCell className="max-w-[260px]">
                          {o.items && o.items.length > 0 ? (
                            <div className="space-y-0.5">
                              <p className="line-clamp-2 text-xs font-medium text-foreground">
                                {o.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{o.items.length} line item{o.items.length > 1 ? "s" : ""}</p>
                            </div>
                          ) : o.customerQuotation ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{o.customerQuotation}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-sm",
                              overdue ? "text-destructive font-medium" : "text-muted-foreground",
                            )}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {o.dateToBeDelivered}
                            {overdue && <span className="text-[10px] uppercase tracking-wider">overdue</span>}
                          </span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canManageDocs ? (
                            <Select
                              value={o.handledBy}
                              onValueChange={(v) => handleHandledByChange(o.id, v)}
                            >
                              <SelectTrigger className="h-7 min-w-[150px] border-0 bg-transparent p-0 hover:bg-muted/40 font-normal shadow-none focus:ring-0">
                                <span className="inline-flex items-center gap-1.5 text-sm truncate">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-primary/15">
                                    {o.handledBy ? o.handledBy.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                                  </span>
                                  <span className="truncate font-medium">{o.handledBy || "Select employee"}</span>
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {branchScopedEmployees.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.name}>
                                    <div className="flex items-center gap-2">
                                      <span>{emp.name}</span>
                                      <span className="text-xs text-muted-foreground">({emp.role || emp.department || "Staff"})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                                {o.handledBy && !branchScopedEmployees.some((e) => e.name === o.handledBy) && (
                                  <SelectItem value={o.handledBy}>{o.handledBy}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-primary/15">
                                {o.handledBy ? o.handledBy.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                              </span>
                              <span className="truncate font-medium text-foreground">{o.handledBy || "—"}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          UGX {o.amount.toLocaleString()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={o.status}
                            onValueChange={(v) => handleStatusChange(o.id, v as OrderStatus)}
                          >
                            <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent p-0 hover:bg-muted/40">
                              <Badge variant="outline" className={cn("gap-1 border-0", meta.cls)}>
                                <StatusIcon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {STATUS_META[s].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 bg-[#003399]/5 ring-1 ring-[#003399]/15 hover:bg-[#003399]/10 hover:ring-[#003399]/30 hover:shadow-[0_2px_10px_-2px_rgba(0,51,153,0.35)]"
                              onClick={() => setPreviewOrder(o)}
                              title="Preview order"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#003399]" />
                            </Button>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 bg-destructive/5 ring-1 ring-destructive/15 hover:bg-destructive/10 hover:ring-destructive/30 hover:shadow-[0_2px_10px_-2px_rgba(244,63,94,0.35)]"
                                onClick={() => handleDelete(o.id)}
                                title="Delete sales order"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <OrderFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        nextLpo={nextLpo(orders)}
        orders={orders}
        onCreate={handleCreate}
        submitting={saving}
        employees={branchScopedEmployees}
        customers={customers}
        inventoryItems={inventoryItems}
      />

      <OrderPreviewDialog
        order={previewOrder}
        onOpenChange={(open) => !open && setPreviewOrder(null)}
        onStatusChange={handleStatusChange}
        onUpdateOrder={handleUpdateOrder}
        inventoryItems={inventoryItems}
      />

      <DeclineReasonDialog
        order={declineDialogTarget}
        open={Boolean(declineDialogTarget)}
        onOpenChange={(open) => !open && setDeclineDialogTarget(null)}
        onConfirm={handleConfirmDecline}
      />

      <LpoSidePreviewSheet
        order={lpoSideSheetOrder}
        open={Boolean(lpoSideSheetOrder)}
        onOpenChange={(open: boolean) => !open && setLpoSideSheetOrder(null)}
        documents={documents}
        customers={customers}
        employees={branchScopedEmployees}
        onStatusChange={handleStatusChange}
        onUpdateOrder={handleUpdateOrder}
      />

      <CreateLpoAccountSheet
        open={lpoAccountFormOpen}
        onOpenChange={setLpoAccountFormOpen}
        nextLpo={nextLpo(orders)}
        customers={customers}
        employees={branchScopedEmployees}
        onCreateLpoAccount={handleCreate}
      />
    </div>
  );
}

type KpiTone = "brand" | "emerald" | "blue" | "amber" | "rose";

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: typeof Package;
  hint?: string;
  tone?: KpiTone;
  onClick?: () => void;
}) {
  const tones: Record<KpiTone, { chip: string; ring: string; accent: string; border: string }> = {
    brand: {
      chip: "bg-[#003399]/10 text-[#003399]",
      ring: "ring-[#003399]/15",
      accent: "bg-gradient-to-br from-[#003399]/95 to-[#004CCC]",
      border: "group-hover:border-[#003399]/25 group-hover:shadow-[0_10px_34px_-20px_rgba(0,51,153,0.45),inset_3px_0_0_rgba(0,51,153,0.5)]",
    },
    emerald: {
      chip: "bg-emerald-500/10 text-emerald-600",
      ring: "ring-emerald-500/15",
      accent: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      border: "group-hover:border-emerald-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(16,185,129,0.45),inset_3px_0_0_rgba(16,185,129,0.5)]",
    },
    blue: {
      chip: "bg-blue-500/10 text-blue-600",
      ring: "ring-blue-500/15",
      accent: "bg-gradient-to-br from-blue-500 to-blue-600",
      border: "group-hover:border-blue-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(59,130,246,0.45),inset_3px_0_0_rgba(59,130,246,0.5)]",
    },
    amber: {
      chip: "bg-amber-500/10 text-amber-600",
      ring: "ring-amber-500/15",
      accent: "bg-gradient-to-br from-amber-500 to-amber-600",
      border: "group-hover:border-amber-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(245,158,11,0.45),inset_3px_0_0_rgba(245,158,11,0.5)]",
    },
    rose: {
      chip: "bg-rose-500/10 text-rose-600",
      ring: "ring-rose-500/15",
      accent: "bg-gradient-to-br from-rose-500 to-rose-600",
      border: "group-hover:border-rose-500/25 group-hover:shadow-[0_10px_34px_-20px_rgba(244,63,94,0.45),inset_3px_0_0_rgba(244,63,94,0.5)]",
    },
  };
  const t = tones[tone];
  return (
    <motion.button
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      type="button"
      disabled={!onClick}
      className={cn(
        "group relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        onClick ? "cursor-pointer" : "cursor-default",
        onClick && t.border,
      )}
    >
      <div className={cn("absolute -right-10 -top-10 h-20 w-20 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-70", t.accent)} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1.5 font-mono text-xl font-semibold text-foreground leading-tight">{value}</div>
        </div>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-[1.08]", t.chip, t.ring)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {hint && (
        <div className="relative text-[11px] text-muted-foreground leading-snug">{hint}</div>
      )}
    </motion.button>
  );
}

type DocumentsWorkspaceProps = {
  orders: SalesOrder[];
  employees: Employee[];
  canManageDocs: boolean;
  isAdmin: boolean;
  isManager: boolean;
  documents: SalesOrderDocument[];
  onRefreshDocuments: () => Promise<void> | void;
};

type DocCategory = "company" | "procurement";

const DOCUMENT_CATALOG: (
  | { type: SalesDocumentType; title: string; description: string; icon: typeof FileText; category: "company" }
  | { type: SalesDocumentType; title: string; description: string; icon: typeof FileText; category: "procurement" }
)[] = [
  { type: "tcc_ura", title: "Tax Compliance Certificate (TCC)", description: "Current URA Tax Clearance / Compliance Certificate of the supplier.", icon: CheckCircle2, category: "company" },
  { type: "business_registration", title: "Certificate of Incorporation / Business Registration", description: "URSB registration (Company / Business Name certificate).", icon: Package, category: "company" },
  { type: "insurance_transit", title: "Insurance Certificate (Goods in Transit)", description: "Goods-in-transit / cargo insurance cover note — annual blanket or per-delivery.", icon: AlertTriangle, category: "company" },
  { type: "lpo_signed", title: "Signed LPO / Purchase Order", description: "Customer-signed Local Purchase Order copy (procurement instrument).", icon: ShoppingCart, category: "procurement" },
  { type: "supplier_quotation", title: "Supplier Quotation", description: "Original supplier quotation accepted by the buyer against this LPO.", icon: FileText, category: "procurement" },
  { type: "tax_invoice_efris", title: "Tax Invoice (EFRIS compliant)", description: "URA e-invoice or validated EFRIS tax invoice against this LPO.", icon: FileText, category: "procurement" },
  { type: "delivery_grn", title: "Delivery Note / Goods Received Note (GRN)", description: "Evidence of physical receipt with signature/acknowledgment from buyer.", icon: Truck, category: "procurement" },
  { type: "waybill_transport", title: "Waybill / Transport Document", description: "KCCA/URA transit waybill or 3rd-party carrier consignment note.", icon: TrendingUp, category: "procurement" },
  { type: "inspection_quality", title: "Inspection / Quality Report", description: "Goods inspection checklist or QA report where inspection is required.", icon: AlertCircle, category: "procurement" },
  { type: "payment_receipt", title: "Payment Confirmation / Receipt", description: "Proof of payment (receipt, bank slip, or acknowledgment slip).", icon: Download, category: "procurement" },
];

const DOCUMENT_CATEGORY_META: Record<DocCategory, { label: string; chip: string; description: string; accent: string; icon: typeof FileText }> = {
  company: {
    label: "Company Documents",
    chip: "Supplier compliance (upload once, valid across LPOs)",
    description: "Legal and compliance documents you hold as a registered Ugandan supplier. Upload once, they apply to every LPO you submit.",
    accent: "from-sky-500/15 via-blue-600/10 to-indigo-600/10 ring-sky-500/20",
    icon: Building2,
  },
  procurement: {
    label: "Procurement Documents",
    chip: "Transactional (per-LPO)",
    description: "Documents that are specific to this individual LPO: the order itself, your quotation, tax invoice, delivery evidence, and payment proof.",
    accent: "from-emerald-500/15 via-teal-600/10 to-[#003399]/10 ring-emerald-500/20",
    icon: ClipboardList,
  },
};

type LpoWorkspaceProps = {
  orders: SalesOrder[];
  documents: SalesOrderDocument[];
  customers: Customer[];
  employees: Employee[];
  onPreview: (order: SalesOrder) => void;
  onSwitchToDocuments: () => void;
  onCreateLpoAccount: () => void;
};

function LpoWorkspace({
  orders,
  documents,
  onPreview,
  onSwitchToDocuments,
  onCreateLpoAccount,
}: LpoWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "value" | "overdue">("newest");

  const sortedFiltered = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((o) =>
        o.lpoNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.handledBy || "").toLowerCase().includes(q) ||
        (o.customerQuotation || "").toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "newest":
        list.sort((a, b) => b.dateReceived.localeCompare(a.dateReceived));
        break;
      case "oldest":
        list.sort((a, b) => a.dateReceived.localeCompare(b.dateReceived));
        break;
      case "value":
        list.sort((a, b) => b.amount - a.amount);
        break;
      case "overdue":
        list.sort((a, b) => {
          const today = todayISO();
          const aOver = a.dateToBeDelivered < today && a.status !== "successful" && a.status !== "declined";
          const bOver = b.dateToBeDelivered < today && b.status !== "successful" && b.status !== "declined";
          if (aOver && !bOver) return -1;
          if (!aOver && bOver) return 1;
          return b.dateReceived.localeCompare(a.dateReceived);
        });
        break;
    }
    return list;
  }, [orders, statusFilter, query, sort]);

  const docCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) m.set(d.salesOrderId, (m.get(d.salesOrderId) || 0) + 1);
    return m;
  }, [documents]);

  const lpoSectionsRef = useMemo(() => ["intro", "stats", "filters", "history"], []);
  const sectionIdx = (k: string) => Math.max(0, lpoSectionsRef.indexOf(k));

  const totalProcurementDocs = DOCUMENT_CATALOG.filter((d) => d.category === "procurement").length;

  function daysBetween(aISO: string, bISO: string) {
    const ms = new Date(aISO).getTime() - new Date(bISO).getTime();
    return Math.round(ms / 86_400_000);
  }

  const today = todayISO();

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.02, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIdx("intro"), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399]/[0.04] via-white to-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003399] text-white shadow-[0_8px_22px_-10px_rgba(0,51,153,0.6)]">
              <FolderKanban className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
                <History className="h-3.5 w-3.5" />
                LPO submission history
              </div>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">
                Every LPO you've submitted — status, ageing and compliance at a glance
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                Audit-style list of all Local Purchase Orders. See at a glance whether delivery is overdue, who handled it, and how many of the required procurement documents are filed against each one.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <Button
              onClick={onCreateLpoAccount}
              size="sm"
              className="gap-1.5 bg-[#003399] text-white hover:bg-[#00297a] shadow-sm font-semibold transition-all active:scale-[0.98]"
              title="Create LPO Account"
            >
              <FilePlus className="h-4 w-4" />
              <span>Create LPO Account</span>
            </Button>
            <Button
              onClick={onSwitchToDocuments}
              variant="outline"
              className="gap-1.5 border-[#003399]/25 bg-[#003399]/5 text-[#003399] hover:bg-[#003399]/10"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Jump to Documents
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={{
          initial: {},
          animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        {[
          { label: "Total LPOs", value: orders.length.toString(), icon: FolderKanban, tone: "brand" as const },
          { label: "Submitted", value: orders.filter((o) => o.status === "submitted").length.toString(), icon: Clock, tone: "amber" as const },
          { label: "Successful", value: orders.filter((o) => o.status === "successful").length.toString(), icon: CheckCircle2, tone: "emerald" as const },
          { label: "Declined", value: orders.filter((o) => o.status === "declined").length.toString(), icon: XCircle, tone: "rose" as const },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-3.5 shadow-sm transition-all duration-200 hover:shadow-[0_8px_26px_-12px_rgba(0,0,0,0.18)]",
              s.tone === "brand" && "border-[#003399]/15 bg-white hover:border-[#003399]/30",
              s.tone === "emerald" && "border-emerald-500/20 bg-white hover:border-emerald-500/40",
              s.tone === "amber" && "border-amber-500/20 bg-white hover:border-amber-500/40",
              s.tone === "rose" && "border-rose-500/20 bg-white hover:border-rose-500/40",
            )}
          >
            <div
              className={cn(
                "absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-75",
                s.tone === "brand" && "bg-gradient-to-br from-[#003399] to-[#004CCC]",
                s.tone === "emerald" && "bg-gradient-to-br from-emerald-500 to-teal-500",
                s.tone === "amber" && "bg-gradient-to-br from-amber-500 to-orange-500",
                s.tone === "rose" && "bg-gradient-to-br from-rose-500 to-pink-500",
              )}
            />
            <div className="relative flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
                <motion.div
                  key={s.value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
                >
                  {s.value}
                </motion.div>
              </div>
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-[1.08]",
                  s.tone === "brand" && "bg-[#003399]/10 text-[#003399] ring-[#003399]/15 group-hover:bg-[#003399] group-hover:text-white group-hover:ring-[#003399]/30",
                  s.tone === "emerald" && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-500/30",
                  s.tone === "amber" && "bg-amber-500/10 text-amber-600 ring-amber-500/20 group-hover:bg-amber-500 group-hover:text-white group-hover:ring-amber-500/30",
                  s.tone === "rose" && "bg-rose-500/10 text-rose-600 ring-rose-500/20 group-hover:bg-rose-500 group-hover:text-white group-hover:ring-rose-500/30",
                )}
              >
                <s.icon className="h-4 w-4" />
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 * sectionIdx("filters"), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search LPO number, customer, handler…"
            className="bg-white pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[170px] bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="value">Highest value</SelectItem>
            <SelectItem value="overdue">Overdue first</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={onCreateLpoAccount}
          size="sm"
          className="gap-1.5 bg-[#003399] text-white hover:bg-[#00297a] shadow-sm font-medium"
          title="Create LPO Account"
        >
          <FilePlus className="h-4 w-4" />
          <span className="hidden sm:inline">New LPO Account</span>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 * sectionIdx("history"), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden"
      >
        <div className="px-4 py-2.5 border-b border-border/70 bg-muted/20 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground grid grid-cols-[20px_1.4fr_0.9fr_0.9fr_0.7fr_0.8fr_0.9fr_40px] gap-3 items-center">
          <span></span>
          <span>LPO</span>
          <span>Customer</span>
          <span>Handled by</span>
          <span>Status</span>
          <span>Dates</span>
          <span>Compliance</span>
          <span></span>
        </div>
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No LPOs match this view"
            description="Clear your filters or create a new sales order to see the submission history populate here."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {sortedFiltered.map((o, idx) => {
              const uploadedProc = DOCUMENT_CATALOG.filter((d) => d.category === "procurement").filter((d) =>
                documents.some((doc) => doc.salesOrderId === o.id && doc.documentType === d.type)
              ).length;
              const uploadedComp = DOCUMENT_CATALOG.filter((d) => d.category === "company").filter((d) =>
                documents.some((doc) => doc.salesOrderId === o.id && doc.documentType === d.type)
              ).length;
              const totalComp = DOCUMENT_CATALOG.filter((d) => d.category === "company").length;
              const complianceScore = Math.round(
                ((uploadedProc + uploadedComp) / (totalProcurementDocs + totalComp)) * 100
              );
              const ageDays = daysBetween(today, o.dateReceived);
              const isOverdue = o.dateToBeDelivered < today && o.status !== "successful" && o.status !== "declined";
              const isDelivered = o.status === "successful";
              const deliveryIn = daysBetween(o.dateToBeDelivered, today);
              const leftStripe = isOverdue
                ? "shadow-[inset_3px_0_0_rgba(244,63,94,0.65)]"
                : isDelivered
                ? "shadow-[inset_3px_0_0_rgba(16,185,129,0.6)]"
                : "";
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.max(0, Math.min(idx, 80)) * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => onPreview(o)}
                  className={cn(
                    "group relative grid grid-cols-[20px_1.4fr_0.9fr_0.9fr_0.7fr_0.8fr_0.9fr_40px] gap-3 items-center px-4 py-3 cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "hover:bg-[#003399]/[0.025] hover:shadow-[inset_3px_0_0_rgba(0,51,153,0.5),0_4px_20px_-8px_rgba(0,0,0,0.12)] hover:border-[#003399]/30",
                    leftStripe,
                    isOverdue && "bg-rose-500/[0.025]",
                    isDelivered && "bg-emerald-500/[0.025]",
                  )}
                >
                  <span className="flex items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground tracking-tight transition-transform duration-200 group-hover:scale-[1.02] origin-left">{o.lpoNumber}</span>
                      {ageDays >= 0 && (
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-md ring-1",
                          ageDays === 0
                            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20"
                            : "text-muted-foreground/80 bg-muted/40 ring-border/50",
                        )}>
                          {ageDays === 0 ? "Today" : `${ageDays}d ago`}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                      {o.items && o.items.length > 0 ? (
                        <span>{o.items.length} item{o.items.length > 1 ? "s" : ""} · particulars synced</span>
                      ) : (
                        <span>Quote reference {o.customerQuotation || "—"}</span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{o.customerName}</div>
                    <div className="text-[11px] text-muted-foreground">UGX {o.amount.toLocaleString()}</div>
                  </div>

                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-1 ring-primary/15 transition-transform duration-200 group-hover:scale-[1.08]">
                        {o.handledBy ? o.handledBy.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                      </span>
                      <span className="truncate font-medium">{o.handledBy || "—"}</span>
                    </span>
                  </div>

                  <div className="min-w-0">
                    {(() => {
                      const StatusIcon = STATUS_META[o.status].icon;
                      return (
                        <Badge variant="outline" className={cn("gap-1 border-0 whitespace-nowrap transition-transform duration-200 group-hover:scale-[1.02]", STATUS_META[o.status].cls)}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {STATUS_META[o.status].label}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground">
                      <span>Issued</span>
                      <span className="text-foreground">{o.dateReceived.slice(5)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] font-mono">
                      <span className="text-muted-foreground">Due</span>
                      <span className={cn(
                        "font-semibold",
                        isOverdue ? "text-rose-600" : isDelivered ? "text-emerald-600" : "text-foreground",
                      )}>
                        {o.dateToBeDelivered.slice(5)}
                      </span>
                    </div>
                    <div className={cn(
                      "text-[10px] flex items-center gap-1",
                      isOverdue ? "text-rose-600 font-medium" : isDelivered ? "text-emerald-600 font-medium" : "text-muted-foreground",
                    )}>
                      <Calendar className="h-2.5 w-2.5" />
                      {isDelivered ? "Delivered" : isOverdue ? `${Math.abs(deliveryIn)}d overdue` : deliveryIn === 0 ? "Due today" : `${deliveryIn}d left`}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-1 text-[10.5px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Boxes className="h-2.5 w-2.5" />
                        Proc {uploadedProc}/{totalProcurementDocs}
                      </span>
                      <motion.span
                        key={`${o.id}-${complianceScore}`}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "font-semibold tabular-nums",
                          complianceScore >= 80 ? "text-emerald-600" : complianceScore >= 40 ? "text-amber-600" : "text-rose-600",
                        )}
                      >
                        {complianceScore}%
                      </motion.span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${complianceScore}%` }}
                        transition={{ duration: 0.6, delay: Math.max(0, Math.min(idx, 80)) * 0.04 + 0.06, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "h-full rounded-full",
                          complianceScore >= 80 ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : complianceScore >= 40 ? "bg-gradient-to-r from-amber-500 to-orange-500"
                          : "bg-gradient-to-r from-rose-500 to-pink-500",
                        )}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-2.5 w-2.5" />
                      Co. docs {uploadedComp}/{totalComp}
                    </div>
                  </div>

                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 bg-[#003399]/5 ring-1 ring-[#003399]/15 hover:bg-[#003399]/10 hover:ring-[#003399]/30 hover:shadow-[0_2px_10px_-2px_rgba(0,51,153,0.35)] active:scale-[0.96] transition-all"
                      onClick={() => onPreview(o)}
                      title="Preview LPO"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#003399]" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.section>
  );
}

function LpoSidePreviewSheet({
  order,
  open,
  onOpenChange,
  documents,
  customers,
  employees,
  onStatusChange,
  onUpdateOrder,
}: {
  order: SalesOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: SalesOrderDocument[];
  customers: Customer[];
  employees: Employee[];
  onStatusChange: (id: string, status: OrderStatus) => void;
  onUpdateOrder?: (id: string, updates: Partial<SalesOrder>) => Promise<void>;
}) {
  if (!order) return null;

  const matchedCustomer = customers.find(
    (c) =>
      (order.customerId && c.id === order.customerId) ||
      c.name.toLowerCase().trim() === order.customerName.toLowerCase().trim()
  );

  const matchedHandler = employees.find(
    (e) =>
      (order.employeeId && e.id === order.employeeId) ||
      e.name.toLowerCase().trim() === (order.handledBy || "").toLowerCase().trim()
  );

  const today = todayISO();
  const isOverdue =
    order.dateToBeDelivered < today &&
    order.status !== "successful" &&
    order.status !== "declined";

  function calcDaysBetween(aISO: string, bISO: string) {
    const ms = new Date(aISO).getTime() - new Date(bISO).getTime();
    return Math.round(ms / 86_400_000);
  }

  const daysDiff = calcDaysBetween(order.dateToBeDelivered, today);

  const statusMeta = STATUS_META[order.status];
  const StatusIcon = statusMeta.icon;

  // Selected document types list for Section 2 (display selected document names only)
  const reqDocTypes = order.requiredDocumentTypes && order.requiredDocumentTypes.length > 0
    ? order.requiredDocumentTypes
    : DOCUMENT_CATALOG.map((d) => d.type);

  const selectedCompanyDocs = DOCUMENT_CATALOG.filter(
    (d) => d.category === "company" && reqDocTypes.includes(d.type)
  );

  const selectedProcurementDocs = DOCUMENT_CATALOG.filter(
    (d) => d.category === "procurement" && reqDocTypes.includes(d.type)
  );

  const companyAddr = order.accountDetails?.companyAddress || matchedCustomer?.address || "Kampala Industrial Area, Plot 42, Jinja Road, Kampala, Uganda";
  const companyTinVal = order.accountDetails?.companyTin || matchedCustomer?.taxId || "URA-TIN-1004892841";
  const companyLocVal = order.accountDetails?.companyLocation || matchedCustomer?.city || matchedCustomer?.country || "Kampala, Uganda";

  const contactNameVal = order.accountDetails?.contactPersonName || matchedCustomer?.contactPerson || matchedCustomer?.name || "Procurement Officer";
  const contactPhoneVal = order.accountDetails?.contactPersonPhone || matchedCustomer?.phone || "0700 000 000";
  const contactEmailVal = order.accountDetails?.contactPersonEmail || matchedCustomer?.email || "procurement@company.com";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto p-0 border-l border-border bg-slate-50/50 dark:bg-slate-950/50">
        {/* RIGHT SIDE PREVIEW HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-md">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <FolderKanban className="h-5.5 w-5.5 text-white" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-lg font-bold tracking-tight">{order.lpoNumber}</h2>
                  <Badge variant="outline" className="border-0 text-white bg-white/15 ring-1 ring-white/25">
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusMeta.label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-white/80">LPO Account Preview &amp; Details</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* SECTION 1: Company Name, Fee (Amount), Deadline for Submission */}
          <div className="rounded-2xl border border-[#003399]/20 bg-white p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-[#003399]" />
                Section 1 · Account Financials &amp; Timeline
              </span>
              <Badge variant="outline" className="text-[10.5px] font-mono border-primary/20 bg-primary/5 text-primary">
                Financials
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Company Name */}
              <div className="rounded-xl border border-border bg-slate-50/60 p-3">
                <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-primary" />
                  Company Name
                </div>
                <div className="mt-1 font-semibold text-sm text-foreground truncate" title={order.customerName}>
                  {order.customerName}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {matchedCustomer ? matchedCustomer.type.toUpperCase() : "Customer Record"}
                </div>
              </div>

              {/* Fee / Amount */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="text-[10.5px] font-medium text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-600" />
                  Fee / Amount
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  UGX {order.amount.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-emerald-600/80 mt-0.5">
                  {order.items?.length || 0} line items
                </div>
              </div>

              {/* Deadline for Submission */}
              <div className={cn(
                "rounded-xl border p-3",
                isOverdue ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-slate-50/60"
              )}>
                <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  Deadline
                </div>
                <div className={cn(
                  "mt-1 font-semibold text-sm",
                  isOverdue ? "text-rose-600 font-bold" : "text-foreground"
                )}>
                  {order.dateToBeDelivered}
                </div>
                <div className={cn(
                  "text-[10.5px] font-medium mt-0.5 flex items-center gap-1",
                  isOverdue ? "text-rose-600" : order.status === "successful" ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  <Clock className="h-2.5 w-2.5" />
                  {order.status === "successful" ? "Fulfilled" : isOverdue ? `${Math.abs(daysDiff)}d overdue` : daysDiff === 0 ? "Due today" : `${daysDiff}d left`}
                </div>
              </div>
            </div>

            {order.status === "declined" && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs space-y-1">
                <span className="font-semibold text-rose-700 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Decline Reason:
                </span>
                <p className="text-rose-800/90 pl-4">{order.declineReason || "No specific reason given."}</p>
              </div>
            )}
          </div>

          {/* SECTION 2: Selected Documents Names Display */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-[#003399]" />
                  Section 2 · Required Document Names
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  List of documents selected for this LPO account
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-[#003399]/10 text-[#003399] border-[#003399]/25">
                {reqDocTypes.length} Selected
              </Badge>
            </div>

            {/* Company Documents Names List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-sky-800 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 p-2 rounded-lg border border-sky-200/50">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                  Company Legal &amp; Compliance Documents ({selectedCompanyDocs.length})
                </span>
              </div>
              {selectedCompanyDocs.length === 0 ? (
                <div className="text-xs text-muted-foreground italic p-2 text-center bg-slate-50 rounded-lg">
                  No company documents selected
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {selectedCompanyDocs.map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="font-medium text-foreground truncate">
                          {item.title}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-0 shrink-0 bg-emerald-500/10 text-emerald-700">
                        Selected
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Procurement Documents Names List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200/50">
                <span className="flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Procurement Transactional Documents ({selectedProcurementDocs.length})
                </span>
              </div>
              {selectedProcurementDocs.length === 0 ? (
                <div className="text-xs text-muted-foreground italic p-2 text-center bg-slate-50 rounded-lg">
                  No procurement documents selected
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {selectedProcurementDocs.map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="font-medium text-foreground truncate">
                          {item.title}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-0 shrink-0 bg-emerald-500/10 text-emerald-700">
                        Selected
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Company Address Details, Contact Person, Staff in Charge */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-[#003399]" />
                Section 3 · Company Details, Contact &amp; Staff
              </span>
              <Badge variant="outline" className="text-[10.5px] border-slate-300 bg-slate-100 text-slate-700">
                Directory
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Company Address Details */}
              <div className="rounded-xl border border-border bg-slate-50/60 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Company Address Details
                </div>
                <p className="text-muted-foreground leading-relaxed pl-5">
                  {companyAddr} ({companyLocVal})
                </p>
                <div className="pl-5 text-[11px] font-mono text-muted-foreground">
                  URA TIN: <span className="font-semibold text-foreground">{companyTinVal}</span>
                </div>
              </div>

              {/* Contact Person */}
              <div className="rounded-xl border border-border bg-slate-50/60 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Contact Person
                </div>
                <div className="pl-5 space-y-1 text-muted-foreground">
                  <div className="font-medium text-foreground text-xs">
                    {contactNameVal}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {contactPhoneVal}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {contactEmailVal}
                    </span>
                  </div>
                </div>
              </div>

              {/* Staff in Charge */}
              <div className="rounded-xl border border-border bg-slate-50/60 p-3 text-xs space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  Staff in Charge
                </div>
                <div className="pl-5 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003399]/10 text-xs font-bold text-[#003399] ring-1 ring-[#003399]/20">
                    {order.handledBy ? order.handledBy.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                  </span>
                  <div>
                    <div className="font-semibold text-foreground text-xs">
                      {order.handledBy || "Unassigned Staff"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {matchedHandler ? `${matchedHandler.role || matchedHandler.department || "Staff"} · ${matchedHandler.email}` : "Queenstech Sales / Procurement Handler"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-white p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <Select
              value={order.status}
              onValueChange={(v) => onStatusChange(order.id, v as OrderStatus)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <Badge variant="outline" className={cn("gap-1 border-0", statusMeta.cls)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusMeta.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close Preview
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateLpoAccountSheet({
  open,
  onOpenChange,
  nextLpo,
  customers,
  employees,
  onCreateLpoAccount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextLpo: string;
  customers: Customer[];
  employees: Employee[];
  onCreateLpoAccount: (lpoAccount: SalesOrder) => void;
}) {
  const [lpoNumber, setLpoNumber] = useState(nextLpo);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [submissionDeadline, setSubmissionDeadline] = useState<string>("");
  const [handledBy, setHandledBy] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  // Section 3 inputs
  const [companyAddress, setCompanyAddress] = useState<string>("");
  const [companyTin, setCompanyTin] = useState<string>("");
  const [companyLocation, setCompanyLocation] = useState<string>("");
  const [contactPersonName, setContactPersonName] = useState<string>("");
  const [contactPersonPhone, setContactPersonPhone] = useState<string>("");
  const [contactPersonEmail, setContactPersonEmail] = useState<string>("");

  // Section 2: Document checklist (selected document types)
  const [selectedDocs, setSelectedDocs] = useState<SalesDocumentType[]>(
    DOCUMENT_CATALOG.map((d) => d.type)
  );

  const [activeView, setActiveView] = useState<"form" | "preview">("form");

  useEffect(() => {
    if (open) {
      setLpoNumber(nextLpo);
      setSelectedCustomerId("");
      setCompanyName("");
      setFeeAmount("");
      setSubmissionDeadline(todayISO());
      setHandledBy(employees[0]?.name || "");
      setEmployeeId(employees[0]?.id || "");
      setCompanyAddress("");
      setCompanyTin("");
      setCompanyLocation("");
      setContactPersonName("");
      setContactPersonPhone("");
      setContactPersonEmail("");
      setSelectedDocs(DOCUMENT_CATALOG.map((d) => d.type));
      setActiveView("form");
    }
  }, [open, nextLpo, employees]);

  function handleSelectCustomer(custId: string) {
    setSelectedCustomerId(custId);
    if (custId === "custom") {
      setCompanyName("");
      setCompanyAddress("");
      setCompanyTin("");
      setCompanyLocation("");
      setContactPersonName("");
      setContactPersonPhone("");
      setContactPersonEmail("");
      return;
    }
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setCompanyName(cust.name);
      setCompanyAddress(cust.address || "");
      setCompanyTin(cust.taxId || "");
      setCompanyLocation(cust.city || cust.country || "");
      setContactPersonName(cust.contactPerson || cust.name);
      setContactPersonPhone(cust.phone || "");
      setContactPersonEmail(cust.email || "");
    }
  }

  function handleToggleDoc(type: SalesDocumentType) {
    setSelectedDocs((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleToggleCategory(cat: "company" | "procurement") {
    const catTypes = DOCUMENT_CATALOG.filter((d) => d.category === cat).map((d) => d.type);
    const allIn = catTypes.every((t) => selectedDocs.includes(t));
    if (allIn) {
      setSelectedDocs((prev) => prev.filter((t) => !catTypes.includes(t)));
    } else {
      setSelectedDocs((prev) => Array.from(new Set([...prev, ...catTypes])));
    }
  }

  const valid = lpoNumber.trim() && companyName.trim() && submissionDeadline && handledBy.trim();

  function handleSubmit() {
    if (!valid) {
      toast.error("Please provide LPO Number, Company Name, Submission Deadline, and Staff in Charge");
      return;
    }

    const numFee = parseFloat(feeAmount) || 0;
    const newAccount: SalesOrder = {
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived: todayISO(),
      customerName: companyName.trim(),
      customerId: selectedCustomerId && selectedCustomerId !== "custom" ? selectedCustomerId : undefined,
      dateToBeDelivered: submissionDeadline,
      handledBy: handledBy.trim(),
      employeeId: employeeId || undefined,
      status: "submitted",
      amount: numFee,
      isLpoAccount: true,
      requiredDocumentTypes: selectedDocs,
      accountDetails: {
        companyAddress: companyAddress.trim() || undefined,
        companyTin: companyTin.trim() || undefined,
        companyLocation: companyLocation.trim() || undefined,
        contactPersonName: contactPersonName.trim() || undefined,
        contactPersonPhone: contactPersonPhone.trim() || undefined,
        contactPersonEmail: contactPersonEmail.trim() || undefined,
        submissionDeadline,
        feeAmount: numFee,
      },
      createdAt: new Date().toISOString(),
    };

    onCreateLpoAccount(newAccount);
    onOpenChange(false);
  }

  const compDocsSpecs = DOCUMENT_CATALOG.filter((d) => d.category === "company");
  const procDocsSpecs = DOCUMENT_CATALOG.filter((d) => d.category === "procurement");

  const selectedCompCount = compDocsSpecs.filter((d) => selectedDocs.includes(d.type)).length;
  const selectedProcCount = procDocsSpecs.filter((d) => selectedDocs.includes(d.type)).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[620px] overflow-y-auto p-0 border-l border-border bg-slate-50/50 dark:bg-slate-950/50">
        {/* HEADER */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-md">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <FilePlus className="h-5.5 w-5.5 text-white" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Create New LPO Account</h2>
                <p className="text-xs text-white/80">Configure LPO account contract, required document checklist &amp; contact details</p>
              </div>
            </div>
          </div>

          {/* VIEW SWITCHER TABS */}
          <div className="mt-4 flex items-center gap-1 rounded-lg bg-black/20 p-1 ring-1 ring-white/20 max-w-[280px]">
            <button
              type="button"
              onClick={() => setActiveView("form")}
              className={cn(
                "flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all",
                activeView === "form" ? "bg-white text-[#003399] shadow-sm" : "text-white/80 hover:text-white"
              )}
            >
              Account Form &amp; Checklist
            </button>
            <button
              type="button"
              onClick={() => setActiveView("preview")}
              className={cn(
                "flex-1 text-center py-1 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1",
                activeView === "preview" ? "bg-white text-[#003399] shadow-sm" : "text-white/80 hover:text-white"
              )}
            >
              <Eye className="h-3 w-3" />
              Live Preview
            </button>
          </div>
        </div>

        {activeView === "form" ? (
          <div className="p-5 space-y-5">
            {/* SECTION 1 FORM: Account Financials & Timeline */}
            <div className="rounded-2xl border border-[#003399]/20 bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#003399]" />
                  Section 1 · Account Financials &amp; Timeline
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary">
                  Required
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* LPO Number */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">LPO Account # *</Label>
                  <Input
                    value={lpoNumber}
                    onChange={(e) => setLpoNumber(e.target.value)}
                    placeholder="e.g. LPO-2026-0001"
                    className="font-mono text-xs bg-slate-50"
                  />
                </div>

                {/* Company / Customer Selector */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Company / Client Name *</Label>
                  <Select value={selectedCustomerId} onValueChange={handleSelectCustomer}>
                    <SelectTrigger className="text-xs bg-slate-50">
                      <SelectValue placeholder="Select existing client or write custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">+ Write Custom Company Name</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Company Name Input if custom or edit */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Company Name Text *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter full registered company name..."
                    className="text-xs"
                  />
                </div>

                {/* Fee / LPO Amount */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Fee / LPO Amount (UGX)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="e.g. 15000000"
                      className="pl-8 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Submission Deadline */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Deadline for Submission *</Label>
                  <Input
                    type="date"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2 FORM: Documents Required Checklist (Interactive Checkboxes) */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-[#003399]" />
                    Section 2 · Documents Required Checklist
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Check all document specifications required for this LPO account
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-[#003399]/10 text-[#003399] border-[#003399]/25">
                  {selectedDocs.length} / {DOCUMENT_CATALOG.length} Selected
                </Badge>
              </div>

              {/* Company Documents Checklist Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-800 bg-sky-50 p-2 rounded-lg border border-sky-200/60">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                    Company Legal &amp; Compliance ({selectedCompCount}/{compDocsSpecs.length})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10.5px] text-sky-700 hover:bg-sky-100 px-2"
                    onClick={() => handleToggleCategory("company")}
                  >
                    {selectedCompCount === compDocsSpecs.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {compDocsSpecs.map((spec) => {
                    const isChecked = selectedDocs.includes(spec.type);
                    return (
                      <div
                        key={spec.type}
                        onClick={() => handleToggleDoc(spec.type)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all select-none",
                          isChecked ? "border-sky-500/30 bg-sky-50/50 text-foreground font-medium" : "border-border/60 bg-slate-50/40 text-muted-foreground hover:bg-slate-100/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-sky-600" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                          )}
                          <span className="truncate">{spec.title}</span>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border-0 shrink-0", isChecked ? "bg-sky-500/10 text-sky-700" : "bg-muted text-muted-foreground")}>
                          {isChecked ? "Required" : "Optional"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Procurement Documents Checklist Block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60">
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Procurement Transactional ({selectedProcCount}/{procDocsSpecs.length})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10.5px] text-emerald-700 hover:bg-emerald-100 px-2"
                    onClick={() => handleToggleCategory("procurement")}
                  >
                    {selectedProcCount === procDocsSpecs.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {procDocsSpecs.map((spec) => {
                    const isChecked = selectedDocs.includes(spec.type);
                    return (
                      <div
                        key={spec.type}
                        onClick={() => handleToggleDoc(spec.type)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all select-none",
                          isChecked ? "border-emerald-500/30 bg-emerald-50/50 text-foreground font-medium" : "border-border/60 bg-slate-50/40 text-muted-foreground hover:bg-slate-100/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                          )}
                          <span className="truncate">{spec.title}</span>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border-0 shrink-0", isChecked ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")}>
                          {isChecked ? "Required" : "Optional"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 3 FORM: Company Details, Contact Person & Staff */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#003399]" />
                  Section 3 · Company Details, Contact &amp; Staff
                </span>
                <Badge variant="outline" className="text-[10.5px] border-slate-300 bg-slate-100 text-slate-700">
                  Directory
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Physical Address */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Company Address Details</Label>
                  <Input
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="e.g. Plot 42, Industrial Area, Jinja Road, Kampala"
                    className="text-xs"
                  />
                </div>

                {/* URA TIN */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">URA TIN Number</Label>
                  <Input
                    value={companyTin}
                    onChange={(e) => setCompanyTin(e.target.value)}
                    placeholder="e.g. 1004892841"
                    className="text-xs font-mono"
                  />
                </div>

                {/* Location / City */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">City / Location</Label>
                  <Input
                    value={companyLocation}
                    onChange={(e) => setCompanyLocation(e.target.value)}
                    placeholder="e.g. Kampala, Uganda"
                    className="text-xs"
                  />
                </div>

                {/* Contact Person Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Contact Person Name</Label>
                  <Input
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                    placeholder="e.g. Jane Doe (Procurement Manager)"
                    className="text-xs"
                  />
                </div>

                {/* Contact Person Phone */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Contact Person Phone</Label>
                  <Input
                    value={contactPersonPhone}
                    onChange={(e) => setContactPersonPhone(e.target.value)}
                    placeholder="e.g. 0772 123 456"
                    className="text-xs"
                  />
                </div>

                {/* Contact Person Email */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Contact Person Email</Label>
                  <Input
                    type="email"
                    value={contactPersonEmail}
                    onChange={(e) => setContactPersonEmail(e.target.value)}
                    placeholder="e.g. jane.doe@company.com"
                    className="text-xs"
                  />
                </div>

                {/* Staff in Charge Selector */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Staff in Charge *</Label>
                  <Select
                    value={handledBy}
                    onValueChange={(val) => {
                      setHandledBy(val);
                      const emp = employees.find((e) => e.name === val);
                      if (emp) setEmployeeId(emp.id);
                    }}
                  >
                    <SelectTrigger className="text-xs bg-slate-50">
                      <SelectValue placeholder="Select staff in charge" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.name}>
                          {e.name} ({e.role || e.department || "Staff"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* LIVE PREVIEW WINDOW (Matches LpoSidePreviewSheet structure exactly) */
          <div className="p-5 space-y-5">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs flex items-center justify-between text-sky-900">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-4 w-4 text-sky-600" />
                Live Preview of LPO Account being created
              </span>
              <Badge variant="outline" className="border-sky-300 bg-white text-sky-800 text-[10px]">
                Preview Mode
              </Badge>
            </div>

            {/* SECTION 1 PREVIEW */}
            <div className="rounded-2xl border border-[#003399]/20 bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#003399]" />
                  Section 1 · Account Financials &amp; Timeline
                </span>
                <Badge variant="outline" className="text-[10.5px] font-mono border-primary/20 bg-primary/5 text-primary">
                  Financials
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-slate-50/60 p-3">
                  <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-primary" />
                    Company Name
                  </div>
                  <div className="mt-1 font-semibold text-sm text-foreground truncate">
                    {companyName || "Untitled Company"}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <div className="text-[10.5px] font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-emerald-600" />
                    Fee / Amount
                  </div>
                  <div className="mt-1 font-mono font-bold text-sm text-emerald-700">
                    UGX {feeAmount ? Number(feeAmount).toLocaleString() : "0"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-slate-50/60 p-3">
                  <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" />
                    Deadline
                  </div>
                  <div className="mt-1 font-semibold text-sm text-foreground">
                    {submissionDeadline || "No deadline set"}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2 PREVIEW: Selected Document Names */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-[#003399]" />
                    Section 2 · Required Document Names
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-[#003399]/10 text-[#003399]">
                  {selectedDocs.length} Selected
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-sky-800 bg-sky-50 p-2 rounded-lg border border-sky-200/50">
                  Company Legal &amp; Compliance Documents ({compDocsSpecs.filter(d => selectedDocs.includes(d.type)).length})
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {compDocsSpecs.filter(d => selectedDocs.includes(d.type)).map((item) => (
                    <div key={item.type} className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-0 bg-emerald-500/10 text-emerald-700">Selected</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200/50">
                  Procurement Transactional Documents ({procDocsSpecs.filter(d => selectedDocs.includes(d.type)).length})
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {procDocsSpecs.filter(d => selectedDocs.includes(d.type)).map((item) => (
                    <div key={item.type} className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-0 bg-emerald-500/10 text-emerald-700">Selected</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 3 PREVIEW */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#003399]" />
                  Section 3 · Company Details, Contact &amp; Staff
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs space-y-2">
                <div className="rounded-xl border bg-slate-50 p-3 space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    Address &amp; Location
                  </div>
                  <p className="text-muted-foreground pl-5">{companyAddress || "No address entered"} ({companyLocation || "No location entered"})</p>
                  <div className="pl-5 text-[11px] font-mono text-muted-foreground">URA TIN: {companyTin || "No TIN entered"}</div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-3 space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    Contact Person
                  </div>
                  <div className="pl-5 font-medium">{contactPersonName || "No contact person entered"}</div>
                  <div className="pl-5 text-muted-foreground text-[11px] flex gap-3">
                    <span>Phone: {contactPersonPhone || "—"}</span>
                    <span>Email: {contactPersonEmail || "—"}</span>
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-3 space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    Staff in Charge
                  </div>
                  <div className="pl-5 font-semibold text-[#003399]">{handledBy || "Unassigned"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <SheetFooter className="flex items-center justify-between gap-2 border-t border-border bg-white px-6 py-3 sticky bottom-0 z-10">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!valid}
            className="bg-[#003399] hover:bg-[#00297a] text-white font-semibold gap-1.5"
            onClick={handleSubmit}
          >
            <FilePlus className="h-4 w-4" />
            Create LPO Account
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function previewDataUrl(dataUrl: string, fileName: string) {
  const w = window.open("_blank", "_blank");
  if (!w) {
    toast.error("Unable to open preview — please allow pop-ups");
    return;
  }
  if (dataUrl.startsWith("data:image/") || dataUrl.startsWith("data:application/pdf")) {
    w.document.write(
      `<!doctype html><html><head><title>${encodeURIComponent(fileName)}</title></head><body style="margin:0;background:#111"><iframe src="${dataUrl}" style="width:100vw;height:100vh;border:0"></iframe></body></html>`
    );
    w.document.close();
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    a.click();
    w.close();
    toast.message("File format preview unavailable — downloaded instead");
  }
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function DocumentsWorkspace({ orders, employees, canManageDocs, documents, onRefreshDocuments }: DocumentsWorkspaceProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const selected = orders.find((o) => o.id === selectedOrderId) || null;
  const [uploadingType, setUploadingType] = useState<SalesDocumentType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const orderDocs = useMemo(() => {
    const m = new Map<SalesDocumentType, SalesOrderDocument>();
    // First aggregate all latest uploaded documents across the global repository
    for (const d of documents) {
      const type = d.documentType as SalesDocumentType;
      if (!m.has(type)) {
        m.set(type, d);
      }
    }
    // If a specific LPO is selected, prioritize order-specific documents
    if (selectedOrderId) {
      for (const d of documents) {
        if (d.salesOrderId === selectedOrderId) {
          m.set(d.documentType as SalesDocumentType, d);
        }
      }
    }
    return m;
  }, [documents, selectedOrderId]);

  const uploadedCount = orderDocs.size;
  const totalDocs = DOCUMENT_CATALOG.length;

  const docSectionsRef = useMemo(() => ["picker", "progress", "grid"], []);
  const sectionIdx = (k: string) => Math.max(0, docSectionsRef.indexOf(k));

  function employeeName(idOrName?: string) {
    if (!idOrName) return "Unknown";
    const byId = employees.find((e) => e.id === idOrName);
    if (byId) return byId.name;
    const byName = employees.find((e) => e.name === idOrName);
    if (byName) return byName.name;
    return idOrName;
  }

  async function handleUploadFile(spec: (typeof DOCUMENT_CATALOG)[number], file: File) {
    const targetOrderId = selectedOrderId || orders[0]?.id || "shared";
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }
    setUploadingType(spec.type);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      await uploadOrderDocument(targetOrderId, {
        documentType: spec.type,
        title: spec.title,
        description: spec.description,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrl,
        uploadedBy: "",
      });
      toast.success(`${spec.title} uploaded to shared repository`, { description: file.name });
      await onRefreshDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload";
      toast.error(message);
    } finally {
      setUploadingType(null);
      if (uploadRefs.current[spec.type]) {
        uploadRefs.current[spec.type]!.value = "";
      }
    }
  }

  async function handleDelete(doc: SalesOrderDocument, title: string) {
    setDeletingId(doc.id);
    try {
      await deleteOrderDocument(doc.id);
      toast.success(`${title} removed`);
      await onRefreshDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  const companyDocs = useMemo(
    () => DOCUMENT_CATALOG.filter((d) => d.category === "company"),
    []
  );
  const procurementDocs = useMemo(
    () => DOCUMENT_CATALOG.filter((d) => d.category === "procurement"),
    []
  );
  const uploadedComp = useMemo(
    () => companyDocs.filter((s) => orderDocs.has(s.type)).length,
    [companyDocs, orderDocs]
  );
  const uploadedProc = useMemo(
    () => procurementDocs.filter((s) => orderDocs.has(s.type)).length,
    [procurementDocs, orderDocs]
  );
  const totalComp = companyDocs.length;
  const totalProc = procurementDocs.length;

  const categoryStagger = (cat: DocCategory, baseDelay: number) => ({
    initial: {} as const,
    animate: { transition: { staggerChildren: 0.04, delayChildren: baseDelay } } as const,
  });
  const rowVariants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
  };

  function DocumentSectionHeader({ category, uploaded, total }: { category: DocCategory; uploaded: number; total: number }) {
    const meta = DOCUMENT_CATEGORY_META[category];
    const pct = Math.round((uploaded / total) * 100);
    const gradientBg = meta.accent;
    const CatIcon = meta.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 bg-gradient-to-br",
          gradientBg,
        )}
        role="region"
        aria-labelledby={`docs-section-${category}`}
      >
        <div
          className={cn(
            "absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl opacity-50 pointer-events-none",
            category === "company" ? "bg-sky-500/25" : "bg-emerald-500/25",
          )}
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
                category === "company"
                  ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
              )}
            >
              <CatIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4
                  id={`docs-section-${category}`}
                  className="text-[13px] font-bold text-foreground tracking-tight"
                >
                  {meta.label}
                </h4>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-white/70 dark:bg-black/20 px-2 py-0.5 rounded-full ring-1 ring-border/60">
                  {meta.chip}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground max-w-2xl">
                {meta.description}
              </p>
            </div>
          </div>
          <div className="sm:min-w-[220px] w-full sm:w-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono text-muted-foreground">
                {uploaded}/{total} uploaded
              </span>
              <motion.span
                key={`${category}-${uploaded}-${total}`}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "text-[11px] font-bold tabular-nums",
                  pct >= 80 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-rose-600",
                )}
              >
                {pct}%
              </motion.span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "h-full rounded-full",
                  category === "company"
                    ? "bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
                    : "bg-gradient-to-r from-emerald-500 via-teal-500 to-[#003399]",
                )}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  function DocumentRow({
    spec,
    index,
  }: {
    spec: (typeof DOCUMENT_CATALOG)[number];
    index: number;
  }) {
    const category = spec.category;
    const existing = orderDocs.get(spec.type);
    const isUploading = uploadingType === spec.type;
    const isDeleting = existing ? deletingId === existing.id : false;
    const isRequiredInChecklist = selected
      ? (selected.requiredDocumentTypes || []).length > 0
        ? (selected.requiredDocumentTypes || []).includes(spec.type)
        : true
      : true;
    const isSharedDoc = Boolean(existing && selectedOrderId && existing.salesOrderId !== selectedOrderId);
    const accent =
      category === "company"
        ? {
            border: "border-l-[3px] border-l-sky-500/70",
            hoverGlow: "group-hover:shadow-[inset_3px_0_0_rgba(14,165,233,0.95),0_0_0_1px_rgba(14,165,233,0.14),0_4px_20px_-8px_rgba(14,165,233,0.35)]",
            chip: "bg-sky-500/10 text-sky-700 ring-sky-500/20 group-hover:bg-sky-500 group-hover:text-white group-hover:ring-sky-500/30",
          }
        : {
            border: "border-l-[3px] border-l-emerald-500/70",
            hoverGlow: "group-hover:shadow-[inset_3px_0_0_rgba(16,185,129,0.95),0_0_0_1px_rgba(16,185,129,0.14),0_4px_20px_-8px_rgba(16,185,129,0.35)]",
            chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-500/30",
          };

    return (
      <motion.div
        variants={rowVariants}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        custom={index}
        className={cn(
          "group relative grid grid-cols-[64px_minmax(0,1fr)_120px_minmax(0,1.1fr)_auto]",
          "gap-3 items-center px-4 py-3 bg-white transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:bg-[#003399]/[0.025] hover:-translate-y-[1px]",
          accent.border,
          accent.hoverGlow,
          existing ? "" : "bg-white/70",
        )}
      >
        {/* Icon cell */}
        <div className="flex items-center justify-center">
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-all duration-200 group-hover:scale-[1.08]",
              existing
                ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-500/30"
                : accent.chip,
            )}
          >
            <spec.icon className="h-[18px] w-[18px]" />
          </span>
        </div>

        {/* Title + description cell */}
        <div className="min-w-0 pr-2">
          <div className="text-[13px] font-semibold text-foreground leading-snug truncate">
            {spec.title}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
            {spec.description}
          </p>
        </div>

        {/* Status chip cell */}
        <div className="flex flex-col gap-1 items-start">
          <div className="flex items-center gap-1.5">
            {existing ? (
              <Badge variant="outline" className="gap-1 border-0 bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Uploaded
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-0 bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20">
                <Clock className="h-3 w-3" />
                Missing
              </Badge>
            )}
          </div>
          {selected && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                isRequiredInChecklist ? "bg-sky-500/10 text-sky-700" : "bg-muted text-muted-foreground",
              )}
            >
              {isRequiredInChecklist ? "Required by LPO" : "Optional"}
            </span>
          )}
          {isSharedDoc && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700">
              Shared document
            </span>
          )}
        </div>

        {/* File meta cell */}
        <div className="min-w-0 pr-2">
          {existing ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Paperclip className="h-3 w-3 shrink-0 text-emerald-600" />
                <span
                  className="truncate text-[11.5px] font-medium text-foreground tabular-nums"
                  title={existing.fileName}
                >
                  {existing.fileName}
                </span>
                <span className="shrink-0 text-[10.5px] font-mono text-muted-foreground ml-auto">
                  {formatBytes(existing.fileSize)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px] text-muted-foreground gap-2">
                <span className="truncate">
                  by <span className="text-foreground font-medium">{employeeName(existing.uploadedBy)}</span>
                </span>
                <span className="shrink-0 font-mono">
                  {existing.uploadedAt ? existing.uploadedAt.slice(0, 10) : ""}
                </span>
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 italic">
              — No file attached —
            </span>
          )}
        </div>

        {/* Actions cell (always visible, no hover-only hiding) */}
        <div className="flex items-center justify-end gap-1.5 min-w-[260px]">
          {existing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs border-[#003399]/20 bg-[#003399]/[0.04] text-[#003399] hover:bg-[#003399]/[0.09] hover:border-[#003399]/40 active:scale-[0.97] transition-all shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
                onClick={() => previewDataUrl(existing.dataUrl, existing.fileName)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-700 hover:bg-emerald-500/[0.11] hover:border-emerald-500/40 active:scale-[0.97] transition-all shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
                onClick={() => downloadDataUrl(existing.dataUrl, existing.fileName)}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
              {canManageDocs && (
                <>
                  <label
                    className={cn(
                      "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed px-2.5 text-xs font-medium transition-all duration-200 h-8",
                      isUploading
                        ? "border-[#003399]/30 bg-[#003399]/5 text-[#003399]/50 cursor-not-allowed opacity-60"
                        : "border-[#003399]/30 bg-[#003399]/[0.04] text-[#003399] hover:bg-[#003399]/[0.09] hover:border-[#003399]/50 active:scale-[0.97]",
                    )}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {isUploading ? "Replacing…" : "Replace"}
                    <input
                      type="file"
                      ref={(el) => {
                        uploadRefs.current[spec.type] = el;
                      }}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                      disabled={isUploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFile(spec, f);
                      }}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs border-destructive/25 bg-destructive/[0.05] text-destructive hover:bg-destructive/10 hover:border-destructive/40 active:scale-[0.97] transition-all shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]"
                    disabled={isDeleting}
                    onClick={() => handleDelete(existing, spec.title)}
                  >
                    {isDeleting ? (
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-destructive/40 border-t-destructive animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {isDeleting ? "Removing…" : "Delete"}
                  </Button>
                </>
              )}
            </>
          ) : canManageDocs ? (
            <label
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 text-xs font-medium transition-all duration-200 h-8",
                isUploading
                  ? "border-[#003399]/30 bg-[#003399]/5 text-[#003399]/50 cursor-not-allowed opacity-60"
                  : "border-[#003399]/35 bg-[#003399]/[0.05] text-[#003399] hover:bg-[#003399]/[0.1] hover:border-[#003399]/60 active:scale-[0.97] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset]",
              )}
            >
              {isUploading ? (
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#003399]/30 border-t-[#003399] animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {isUploading ? "Uploading…" : "Upload document"}
              <input
                type="file"
                ref={(el) => {
                  uploadRefs.current[spec.type] = el;
                }}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                disabled={isUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(spec, f);
                }}
              />
            </label>
          ) : (
            <div className="rounded-md border border-muted/70 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground italic whitespace-nowrap">
              Awaiting upload · managers only
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * sectionIdx("documents"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 * sectionIdx("picker"), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-border bg-white p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
            <FileText className="h-3.5 w-3.5" />
            LPO compliance documents
          </div>
          <h3 className="mt-0.5 text-base font-semibold text-foreground">
            Shared Document Repository & Compliance Suite
          </h3>
          <p className="text-sm text-muted-foreground">
            Documents stored here are shared across LPOs matching their required checklist. Select an LPO to filter or inspect specific requirements.
          </p>
        </div>
        <div className="sm:min-w-[340px] w-full">
          <Select value={selectedOrderId || "all"} onValueChange={(v) => setSelectedOrderId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full bg-muted/30">
              <SelectValue placeholder="All LPOs (Shared Document Repository)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-semibold text-[#003399]">All LPOs (Shared Document Repository)</span>
              </SelectItem>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="font-mono mr-2">{o.lpoNumber}</span>
                  <span className="text-muted-foreground truncate">· {o.customerName}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#003399]/15 bg-[#003399]/[0.04] px-3 py-2 text-xs">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#003399]/10 text-[#003399]">
                <ShoppingBag className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono font-semibold text-foreground truncate">{selected.lpoNumber}</div>
                <div className="text-muted-foreground truncate">{selected.customerName} · {selected.dateReceived} · UGX {selected.amount.toLocaleString()}</div>
              </div>
              {(() => {
                const SelStatusIcon = STATUS_META[selected.status].icon;
                return (
                  <Badge variant="outline" className={cn("gap-1 border-0", STATUS_META[selected.status].cls)}>
                    {SelStatusIcon && <SelStatusIcon className="h-3 w-3" />}
                    {STATUS_META[selected.status].label}
                  </Badge>
                );
              })()}
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#003399]/15 bg-[#003399]/[0.04] px-3 py-2 text-xs">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#003399]/10 text-[#003399]">
                <FolderKanban className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">Global Shared Repository</div>
                <div className="text-muted-foreground truncate">Files uploaded here automatically satisfy requirements for all LPOs</div>
              </div>
              <Badge variant="outline" className="gap-1 border-0 bg-[#003399]/10 text-[#003399]">
                Shared Workspace
              </Badge>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 * sectionIdx("progress"), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399]/[0.04] via-white to-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
            <Boxes className="h-3.5 w-3.5" />
            {selected ? `Compliance checklist for ${selected.lpoNumber}` : "Global document repository readiness"}
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {uploadedCount}/{totalDocs} documents
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-[#003399]/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(uploadedCount / totalDocs) * 100}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-[#003399] to-[#004CCC]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <span className="text-muted-foreground">
            <span className="font-semibold text-emerald-600">{uploadedCount}</span> uploaded
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-rose-500">{totalDocs - uploadedCount}</span> remaining
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-[#003399]">{Math.round((uploadedCount / totalDocs) * 100)}%</span> complete
          </span>
          <span className="ml-auto text-muted-foreground">
            <Building2 className="inline h-3 w-3 mr-1 align-[-2px] text-sky-600" />
            Company <span className="font-semibold text-sky-700">{uploadedComp}/{totalComp}</span>
            <span className="mx-2 text-border/70">·</span>
            <ClipboardList className="inline h-3 w-3 mr-1 align-[-2px] text-emerald-600" />
            Procurement <span className="font-semibold text-emerald-700">{uploadedProc}/{totalProc}</span>
          </span>
        </div>
      </motion.div>

      <div className="space-y-5">
        {/* Company Documents section */}
        <div className="space-y-2">
          <DocumentSectionHeader category="company" uploaded={uploadedComp} total={totalComp} />
          <motion.div
            variants={categoryStagger("company", 0.05)}
            initial="initial"
            animate="animate"
            className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden divide-y divide-border/60"
          >
            {companyDocs.map((spec, i) => (
              <DocumentRow key={spec.type} spec={spec} index={i} />
            ))}
          </motion.div>
        </div>

        {/* Procurement Documents section */}
        <div className="space-y-2">
          <DocumentSectionHeader category="procurement" uploaded={uploadedProc} total={totalProc} />
          <motion.div
            variants={categoryStagger("procurement", 0.08)}
            initial="initial"
            animate="animate"
            className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden divide-y divide-border/60"
          >
            {procurementDocs.map((spec, i) => (
              <DocumentRow key={spec.type} spec={spec} index={i} />
            ))}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function OrderFormSheet({
  open,
  onOpenChange,
  nextLpo,
  orders = [],
  onCreate,
  submitting,
  employees,
  customers,
  inventoryItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextLpo: string;
  orders?: SalesOrder[];
  onCreate: (o: SalesOrder) => void;
  submitting: boolean;
  employees: Employee[];
  customers: Customer[];
  inventoryItems: Item[];
}) {
  const [selectedLpoSource, setSelectedLpoSource] = useState<string>("auto");
  const [lpoNumber, setLpo] = useState(nextLpo);
  const [dateReceived, setDateReceived] = useState(todayISO());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [quotationAttachment, setQuotationAttachment] = useState<QuotationAttachment | null>(null);

  // Item Adder controls state
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [addItemName, setAddItemName] = useState<string>("");
  const [addItemPrice, setAddItemPrice] = useState<string>("");
  const [addItemQty, setAddItemQty] = useState<string>("1");

  // Static Cart items state
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [dateToBeDelivered, setDelivery] = useState("");
  const [handledBy, setHandledBy] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedLpoSource("auto");
      setLpo(nextLpo);
      setDateReceived(todayISO());
      setSelectedCustomerId("");
      setCustomerName("");
      setQuotationAttachment(null);
      setCartItems([]);
      setSelectedInventoryId("");
      setAddItemName("");
      setAddItemPrice("");
      setAddItemQty("1");
      setDelivery("");
      setHandledBy(employees[0]?.name || "");
      setNotes("");
    }
  }, [open, nextLpo, employees]);

  const grandTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  }, [cartItems]);

  const valid =
    lpoNumber.trim() &&
    dateReceived &&
    customerName.trim() &&
    dateToBeDelivered &&
    handledBy.trim() &&
    cartItems.length > 0;

  function handleAttachment(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setQuotationAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result ?? ""),
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSelectInventory(itemId: string) {
    if (itemId === "custom") {
      setSelectedInventoryId("");
      setAddItemName("");
      setAddItemPrice("0");
      return;
    }
    const found = inventoryItems.find((i) => i.id === itemId);
    if (found) {
      setSelectedInventoryId(found.id);
      setAddItemName(found.name);
      setAddItemPrice(String(found.sellingPrice || 0));
    }
  }

  function handleAddItemToCart() {
    const name = addItemName.trim();
    const price = parseFloat(addItemPrice) || 0;
    const qty = Math.max(1, parseInt(addItemQty, 10) || 1);
    if (!name) {
      toast.error("Please select or enter an item name");
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => (selectedInventoryId && i.itemId === selectedInventoryId) || i.name.toLowerCase() === name.toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + qty;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          total: newQty * existing.unitPrice,
        };
        toast.success(`Updated ${name} quantity to ${newQty}`);
        return updated;
      }
      toast.success(`Added ${name} to cart`);
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          itemId: selectedInventoryId || undefined,
          name,
          quantity: qty,
          unitPrice: price,
          total: qty * price,
        },
      ];
    });

    // Reset adder form
    setSelectedInventoryId("");
    setAddItemName("");
    setAddItemPrice("");
    setAddItemQty("1");
  }

  function handleIncreaseQty(id: string) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const q = item.quantity + 1;
        return { ...item, quantity: q, total: q * item.unitPrice };
      })
    );
  }

  function handleDecreaseQty(id: string) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const q = Math.max(1, item.quantity - 1);
        return { ...item, quantity: q, total: q * item.unitPrice };
      })
    );
  }

  function handleRemoveItem(id: string) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }

  function submit() {
    if (!valid) return;
    const cleanItems = cartItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      total: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
    }));

    onCreate({
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived,
      customerName: customerName.trim(),
      customerId: selectedCustomerId || undefined,
      quotationAttachment,
      dateToBeDelivered,
      handledBy: handledBy.trim(),
      status: "submitted",
      amount: grandTotal,
      items: cleanItems,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[580px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New sales order</SheetTitle>
          <SheetDescription>Register a Local Purchase Order received from a customer.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <Field label="Fetch LPO from database" icon={FolderKanban}>
            <Select
              value={selectedLpoSource}
              onValueChange={(val) => {
                setSelectedLpoSource(val);
                if (val === "auto") {
                  setLpo(nextLpo);
                } else {
                  const matched = orders.find((o) => o.id === val);
                  if (matched) {
                    setLpo(matched.lpoNumber);
                    setCustomerName(matched.customerName);
                    setSelectedCustomerId(matched.customerId || "");
                    toast.success(`Fetched LPO ${matched.lpoNumber} — Synced Customer: ${matched.customerName}`);
                  }
                }
              }}
            >
              <SelectTrigger className="w-full bg-white font-mono">
                <SelectValue placeholder="Fetch LPO from database..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="font-semibold text-primary">
                  + Auto-generate New LPO ({nextLpo})
                </SelectItem>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span className="font-mono font-semibold">{o.lpoNumber}</span>
                    <span className="text-muted-foreground ml-2">· {o.customerName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="LPO number" icon={FileText}>
              <Input
                value={lpoNumber}
                onChange={(e) => {
                  setLpo(e.target.value);
                  setSelectedLpoSource("custom");
                }}
                className="font-mono"
              />
            </Field>
            <Field label="Date received" icon={Calendar}>
              <Input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
            </Field>
          </div>

          <Field label="Customer name" icon={User}>
            <div className="space-y-2">
              <Select
                value={selectedCustomerId || "custom"}
                onValueChange={(val) => {
                  if (val === "custom") {
                    setSelectedCustomerId("");
                  } else {
                    const found = customers.find((c) => c.id === val);
                    if (found) {
                      setSelectedCustomerId(found.id);
                      setCustomerName(found.name);
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select from customers database..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom" className="font-medium text-muted-foreground">
                    Custom customer name
                  </SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.reference})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (selectedCustomerId) {
                    const matched = customers.find((c) => c.id === selectedCustomerId);
                    if (matched && matched.name !== e.target.value) {
                      setSelectedCustomerId("");
                    }
                  }
                }}
                placeholder="Customer name (or type custom name)..."
                className="bg-white"
              />
            </div>
          </Field>

          {/* Cart Section - Interactive POS / E-Commerce Style */}
          <div className="rounded-xl border border-border bg-slate-50/50 p-3.5 space-y-3 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Order Line Items (Cart)
              </Label>
              <Badge variant="outline" className="text-[11px] font-mono bg-white">
                {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
              </Badge>
            </div>

            {/* Item Adder Controls */}
            <div className="rounded-lg border border-border bg-white p-3 space-y-2.5 shadow-sm dark:bg-slate-950">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Add Product / Item to Order
              </span>

              {inventoryItems.length > 0 && (
                <Select value={selectedInventoryId || "custom"} onValueChange={handleSelectInventory}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Select product from inventory..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom" className="font-medium text-muted-foreground">
                      + Custom / Other Item
                    </SelectItem>
                    {inventoryItems.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{inv.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            (UGX {inv.sellingPrice.toLocaleString()})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    value={addItemName}
                    onChange={(e) => {
                      setAddItemName(e.target.value);
                      if (selectedInventoryId) {
                        const matched = inventoryItems.find((i) => i.id === selectedInventoryId);
                        if (matched && matched.name !== e.target.value) {
                          setSelectedInventoryId("");
                        }
                      }
                    }}
                    placeholder="Item name / description"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input
                    type="number"
                    min="0"
                    value={addItemPrice}
                    onChange={(e) => setAddItemPrice(e.target.value)}
                    placeholder="Price (UGX)"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                    placeholder="Qty"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddItemToCart}
                    className="h-8 w-full text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Cart Items Static List */}
            {cartItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-white/60 p-4 text-center dark:bg-slate-950/60">
                <ShoppingCart className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="mt-1 text-xs text-muted-foreground font-medium">Cart is empty</p>
                <p className="text-[11px] text-muted-foreground/80">Select a product or enter item details above to add items to your cart.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm dark:bg-slate-950"
                  >
                    {/* Static Item Info */}
                    <div className="min-w-[130px] flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground">#{index + 1}</span>
                        <h4 className="text-xs font-semibold text-foreground truncate">{item.name}</h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        UGX {item.unitPrice.toLocaleString()} / unit
                      </p>
                    </div>

                    {/* Quantity Stepper with Decrease (-) & Increase (+) buttons */}
                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDecreaseQty(item.id)}
                        disabled={item.quantity <= 1}
                        className="h-6 w-6 rounded-md text-foreground hover:bg-white hover:shadow-xs disabled:opacity-30"
                        title="Decrease units"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-mono text-xs font-bold text-foreground">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleIncreaseQty(item.id)}
                        className="h-6 w-6 rounded-md text-foreground hover:bg-white hover:shadow-xs"
                        title="Increase units"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Static Line Total */}
                    <div className="text-right min-w-[90px]">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        UGX {item.total.toLocaleString()}
                      </span>
                    </div>

                    {/* Delete Action Button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Remove item from cart"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Grand Total Footer */}
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary">
              <span>Grand Amount</span>
              <span className="font-mono text-base font-bold">
                UGX {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery date" icon={Truck}>
              <Input type="date" value={dateToBeDelivered} onChange={(e) => setDelivery(e.target.value)} />
            </Field>
            <Field label="Handled by" icon={User}>
              <Select value={handledBy} onValueChange={setHandledBy}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{emp.name}</span>
                        <span className="text-xs text-muted-foreground">({emp.role || emp.department || "Staff"})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {handledBy && !employees.some((e) => e.name === handledBy) && (
                    <SelectItem value={handledBy}>{handledBy}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes, delivery instructions…"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? "Creating..." : "Create order"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

type TimelineEvent = {
  icon: typeof Clock;
  title: string;
  description?: string;
  date?: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose" | "muted";
};

function OrderPreviewDialog({
  order,
  onOpenChange,
  onStatusChange,
  onUpdateOrder,
  inventoryItems,
}: {
  order: SalesOrder | null;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onUpdateOrder?: (id: string, updates: Partial<SalesOrder>) => Promise<void>;
  inventoryItems: Item[];
}) {
  const open = Boolean(order);

  const [showAddComplaint, setShowAddComplaint] = useState(false);
  const [newComplaintSummary, setNewComplaintSummary] = useState("");
  const [newComplaintRaisedBy, setNewComplaintRaisedBy] = useState("");
  const [resolvingComplaintId, setResolvingComplaintId] = useState<string | null>(null);
  const [resolutionNotesInput, setResolutionNotesInput] = useState("");

  const invMap = useMemo(() => {
    const m = new Map<string, Item>();
    inventoryItems.forEach((it) => {
      if (it.id) m.set(it.id, it);
    });
    return m;
  }, [inventoryItems]);

  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!order) return [];
    const statusMeta = STATUS_META[order.status];
    const StatusIcon = statusMeta.icon;
    const events: TimelineEvent[] = [];
    events.push({
      icon: FileText,
      title: "Order created",
      date: order.createdAt ? order.createdAt.slice(0, 10) : order.dateReceived,
      tone: "primary",
    });
    if (order.dateReceived) {
      events.push({
        icon: Calendar,
        title: "Order received / entered",
        date: order.dateReceived,
        tone: "muted",
      });
    }
    if (order.handledBy) {
      events.push({
        icon: User,
        title: "Handled by " + order.handledBy,
        description: "Responsible staff at the time of sale",
        date: order.dateReceived,
        tone: "primary",
      });
    }
    events.push({
      icon: StatusIcon,
      title: "Status: " + statusMeta.label,
      description: order.status === "declined" ? `Decline reason: ${order.declineReason || "Unspecified"}` : "Current order state",
      date: order.updatedAt ? order.updatedAt.slice(0, 10) : undefined,
      tone:
        order.status === "successful" ? "emerald" :
        order.status === "declined" ? "rose" :
        order.status === "submitted" ? "amber" : "default",
    });
    if (order.dateToBeDelivered) {
      const isPast = new Date(order.dateToBeDelivered) < new Date(new Date().toISOString().slice(0, 10));
      const done = order.status === "successful" || order.status === "declined";
      const delivered = order.status === "successful";
      events.push({
        icon: Truck,
        title: delivered ? "Fulfilled on" : done ? "Delivery target was" : isPast ? "Overdue (was due)" : "Scheduled delivery",
        date: order.dateToBeDelivered,
        tone: delivered ? "emerald" : done ? "muted" : isPast ? "rose" : "primary",
      });
    }
    if (order.updatedAt && order.createdAt && order.updatedAt.slice(0, 10) !== order.createdAt.slice(0, 10)) {
      events.push({
        icon: Clock,
        title: "Order details last updated",
        date: order.updatedAt.slice(0, 10),
        tone: "muted",
      });
    }
    return events;
  }, [order]);

  if (!order) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }
  const statusMeta = STATUS_META[order.status];
  const StatusIcon = statusMeta.icon;
  const lineItems = order.items ?? [];
  const subtotal = lineItems.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const amount = Number(order.amount) || subtotal || 0;
  const attachment = order.quotationAttachment;
  const isImage = attachment?.type.startsWith("image/");
  const isPdf = attachment?.type === "application/pdf" || attachment?.name.toLowerCase().endsWith(".pdf");
  const complaintsList = order.complaints || [];

  async function handleAddComplaintSubmit() {
    if (!newComplaintSummary.trim() || !order) return;
    const updatedComplaints: OrderComplaint[] = [
      ...complaintsList,
      {
        id: crypto.randomUUID(),
        summary: newComplaintSummary.trim(),
        raisedBy: newComplaintRaisedBy.trim() || "Customer",
        raisedAt: todayISO(),
        resolved: false,
      },
    ];
    if (onUpdateOrder) {
      await onUpdateOrder(order.id, { complaints: updatedComplaints });
    }
    setNewComplaintSummary("");
    setNewComplaintRaisedBy("");
    setShowAddComplaint(false);
  }

  async function handleResolveComplaint(complaintId: string, notes?: string) {
    if (!order) return;
    const updatedComplaints = complaintsList.map((c) =>
      c.id === complaintId
        ? { ...c, resolved: true, resolutionNotes: notes || "Resolved by staff" }
        : c
    );
    if (onUpdateOrder) {
      await onUpdateOrder(order.id, { complaints: updatedComplaints });
    }
    setResolvingComplaintId(null);
    setResolutionNotesInput("");
  }

  const sections: string[] = [
    "meta",
    "particulars",
    ...(order.notes ? ["notes" as const] : []),
    ...(attachment ? ["attachment" as const] : []),
    "totals",
    "complaints",
    "timeline",
  ];
  const sectionIndex = (key: string) => Math.max(0, sections.indexOf(key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,720px)] overflow-hidden p-0">
        {/* Header band */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white px-6 py-5 pr-14"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -left-14 -bottom-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <ShoppingBag className="h-5.5 w-5.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-xl font-semibold tracking-wide">{order.lpoNumber}</h2>
                  <Badge variant="outline" className="border-0 bg-white/15 text-white ring-1 ring-white/25 backdrop-blur">
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusMeta.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-white/75">Queenstech ERP · LPO Preview & Summary</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scrollable content */}
        <div className="max-h-[calc(92vh-200px)] overflow-y-auto space-y-4 bg-muted/20 px-6 py-5">
          {/* TOTAL LPO INCOME BANNER */}
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  Total LPO Income
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Total revenue generated by this LPO</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
                UGX {amount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* DECLINE REASON BANNER */}
          {order.status === "declined" && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <XCircle className="h-4 w-4" />
                Reason for Decline
              </div>
              <p className="text-xs text-rose-800/90 dark:text-rose-300 pl-6 leading-relaxed font-medium">
                {order.declineReason || "No specific decline reason provided."}
              </p>
            </div>
          )}

          {/* Meta grid */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("meta"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3 text-[#003399]" />
                Date received
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">{order.dateReceived}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <User className="h-3 w-3 text-[#003399]" />
                Customer
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground truncate" title={order.customerName}>
                {order.customerName}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Truck className="h-3 w-3 text-[#003399]" />
                Delivery date
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">{order.dateToBeDelivered}</div>
            </div>
          </motion.div>

          {/* Particulars table (enriched with SKU + description from inventory) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("particulars"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-white overflow-hidden shadow-sm"
          >
            <div className="border-b border-[#003399]/15 bg-gradient-to-r from-[#003399]/8 via-[#003399]/5 to-transparent px-4 py-2.5 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Orders / Items under LPO
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {lineItems.length} line{lineItems.length === 1 ? "" : "s"}
              </div>
            </div>
            {lineItems.length > 0 ? (
              <>
                <div className="border-b border-border/80 bg-[#003399]/[0.03] px-4 py-2 grid grid-cols-[1fr_70px_120px_120px] gap-3 items-center text-[10px] font-semibold uppercase tracking-wider text-[#003399]/70">
                  <span>Item / SKU / Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-border/70">
                  {lineItems.map((it, idx) => {
                    const match = it.itemId ? invMap.get(it.itemId) : undefined;
                    return (
                      <motion.div
                        key={it.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 + idx * 0.03, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="grid grid-cols-[1fr_70px_120px_120px] gap-3 items-start px-4 py-3 text-sm hover:bg-[#003399]/[0.025] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-medium text-foreground truncate">{it.name}</div>
                            {match ? (
                              <span className="inline-flex items-center rounded border border-[#003399]/25 bg-[#003399]/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#003399] shadow-[0_0_0_1px_rgba(0,51,153,0.04)]">
                                SKU {match.sku}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Line item
                              </span>
                            )}
                          </div>
                          <div
                            className="mt-1 text-[11px] text-muted-foreground leading-snug"
                            title={match?.description || it.name}
                          >
                            {match?.description || it.name}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs mt-1 text-muted-foreground">× {it.quantity}</div>
                        <div className="text-right font-mono text-xs mt-1 text-foreground">UGX {(Number(it.unitPrice) || 0).toLocaleString()}</div>
                        <div className="text-right font-mono text-sm font-semibold text-[#003399]">
                          UGX {(Number(it.total) || 0).toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#003399]/8 ring-1 ring-[#003399]/15">
                  <FileText className="h-5 w-5 text-[#003399]/70" />
                </div>
                <div className="text-sm font-semibold text-foreground">No line items added yet</div>
                {order.customerQuotation ? (
                  <div className="mt-2 rounded-lg border border-dashed border-[#003399]/20 bg-[#003399]/[0.025] px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed text-left">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#003399]">
                      <FileText className="h-3 w-3" />
                      From customer quotation
                    </div>
                    {order.customerQuotation}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Particulars will appear here when line items are added to this order.
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Internal notes */}
          {sections.includes("notes") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sectionIndex("notes"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  <FileText className="h-3 w-3 text-[#003399]" />
                  Internal notes
                </div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {order.notes}
                </p>
              </div>
            </motion.div>
          )}

          {/* Attachment preview */}
          {sections.includes("attachment") && attachment && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sectionIndex("attachment"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Paperclip className="h-3 w-3 text-[#003399]" />
                  Quotation attachment
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[260px]">
                  {attachment.name}
                </div>
              </div>
              <div className="rounded-lg border border-[#003399]/15 bg-[#003399]/[0.02] flex items-center justify-center min-h-[160px] max-h-[300px] overflow-hidden">
                {isImage && (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="max-h-[290px] max-w-full object-contain p-2 rounded-md transition-transform hover:scale-[1.01] duration-300"
                  />
                )}
                {isPdf && (
                  <iframe
                    title={attachment.name}
                    src={attachment.dataUrl}
                    className="h-[280px] w-full rounded-md border border-border/60 bg-white"
                  />
                )}
                {!isImage && !isPdf && (
                  <div className="py-8 px-6 text-center">
                    <Paperclip className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">{attachment.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">This file type can only be downloaded.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" asChild>
                  <a href={attachment.dataUrl} target="_blank" rel="noreferrer">
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="bg-[#003399] hover:bg-[#00297a] text-white shadow-[0_0_0_1px_rgba(0,51,153,0.08),0_4px_14px_-4px_rgba(0,51,153,0.4)] hover:shadow-[0_0_0_1px_rgba(0,51,153,0.12),0_6px_20px_-4px_rgba(0,51,153,0.5)] transition-shadow"
                  asChild
                >
                  <a href={attachment.dataUrl} download={attachment.name}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Totals */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("totals"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-[#003399]/25 bg-gradient-to-br from-[#003399]/10 via-[#003399]/6 to-transparent p-4 space-y-2 shadow-[0_0_0_1px_rgba(0,51,153,0.04)]"
          >
            {lineItems.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({lineItems.length} item{lineItems.length === 1 ? "" : "s"})</span>
                <span className="font-mono text-foreground">UGX {subtotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[#003399]/20">
              <span className="text-sm font-semibold text-[#003399]">Order total</span>
              <span className="font-mono text-lg font-bold text-[#003399] drop-shadow-[0_0_1px_rgba(0,51,153,0.15)]">UGX {amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-[#003399]/15">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                Handled by
              </span>
              <span className="font-medium text-foreground">
                {order.handledBy || "—"}
              </span>
            </div>
          </motion.div>

          {/* COMPLAINTS PER ORDER MADE SECTION */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("complaints"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600" />
                Complaints per Order Made ({complaintsList.length})
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-[#003399]/25 text-[#003399] hover:bg-[#003399]/5"
                onClick={() => setShowAddComplaint((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" />
                Log Complaint
              </Button>
            </div>

            {/* Form to log new complaint */}
            {showAddComplaint && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
                <span className="text-xs font-semibold text-amber-800">Log New Order Complaint</span>
                <Textarea
                  value={newComplaintSummary}
                  onChange={(e) => setNewComplaintSummary(e.target.value)}
                  placeholder="Describe the complaint (e.g. damaged goods, missing items, late delivery)..."
                  rows={2}
                  className="text-xs bg-white"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={newComplaintRaisedBy}
                    onChange={(e) => setNewComplaintRaisedBy(e.target.value)}
                    placeholder="Raised by (Customer or Staff name)..."
                    className="text-xs h-8 bg-white flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={!newComplaintSummary.trim()}
                    onClick={handleAddComplaintSubmit}
                  >
                    Save Complaint
                  </Button>
                </div>
              </div>
            )}

            {/* List of complaints */}
            {complaintsList.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
                No complaints recorded for this order.
              </div>
            ) : (
              <div className="space-y-2 divide-y divide-border/60">
                {complaintsList.map((c) => (
                  <div key={c.id} className="pt-2 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        {c.summary}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] border-0", c.resolved ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700")}>
                        {c.resolved ? "Resolved" : "Pending"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-5">
                      <span>Raised by: <strong className="text-foreground font-normal">{c.raisedBy || "Customer"}</strong> on {c.raisedAt}</span>
                      {!c.resolved && (
                        <div className="flex items-center gap-1">
                          {resolvingComplaintId === c.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={resolutionNotesInput}
                                onChange={(e) => setResolutionNotesInput(e.target.value)}
                                placeholder="Resolution notes..."
                                className="h-6 text-[10.5px] px-1.5 w-36 bg-white"
                              />
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleResolveComplaint(c.id, resolutionNotesInput)}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium px-2"
                              onClick={() => setResolvingComplaintId(c.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {c.resolutionNotes && (
                      <div className="ml-5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 p-1.5 rounded border border-emerald-200/50">
                        <strong>Resolution:</strong> {c.resolutionNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Timeline / Transaction history */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("timeline"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Timeline &amp; activity
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{timelineEvents.length} events</div>
            </div>
            <ol className="relative border-l border-[#003399]/20 pl-5 space-y-3.5 ml-1">
              {timelineEvents.map((ev, idx) => {
                const tone =
                  ev.tone === "emerald" ? "bg-emerald-500 text-white ring-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
                  ev.tone === "rose" ? "bg-rose-500 text-white ring-rose-500/20 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]" :
                  ev.tone === "amber" ? "bg-amber-500 text-white ring-amber-500/20 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]" :
                  ev.tone === "muted" ? "bg-muted text-muted-foreground ring-muted-foreground/10" :
                  "bg-[#003399] text-white ring-[#003399]/20 shadow-[0_0_0_1px_rgba(0,51,153,0.08)]";
                const EventIcon = ev.icon;
                return (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -3 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + idx * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    <span
                      className={`absolute -left-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ${tone}`}
                    >
                      <EventIcon className="h-3 w-3" />
                    </span>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{ev.description}</div>
                        )}
                      </div>
                      {ev.date && (
                        <div className="text-[11px] font-mono text-muted-foreground shrink-0">{ev.date}</div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <Select
              value={order.status}
              onValueChange={(v) => {
                onStatusChange(order.id, v as OrderStatus);
              }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <Badge variant="outline" className={cn("gap-1 border-0", statusMeta.cls)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusMeta.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => {
                  const m = STATUS_META[s];
                  const I = m.icon;
                  return (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <I className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              className="bg-[#003399] hover:bg-[#00297a] text-white"
              onClick={() => onOpenChange(false)}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

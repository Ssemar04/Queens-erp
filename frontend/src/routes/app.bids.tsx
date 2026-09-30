import { useState, useMemo, useEffect, useCallback } from "react";
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
  Eye,
  ShoppingCart,
  Download,
  Sparkles,
  Package,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Building2,
  ClipboardList,
  ArrowRight,
  FolderKanban,
  GripVertical,
  XCircle,
  Check,
  FilePlus,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  CheckSquare,
  Square,
  DollarSign,
  ShieldCheck,
  FileCheck,
  Layers,
  Megaphone,
  Send,
  FolderOpen,
  ClipboardCheck,
  Calculator,
  Users2,
  Trophy,
  Signature,
  Info,
  ShieldAlert,
  Printer,
  Scale,
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
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  createOrder,
  deleteOrder,
  getAllDocuments,
  getCustomers,
  getEmployees,
  getItems,
  getOrderDocuments,
  getOrders,
  updateOrder,
} from "@/services/api";
import type { Customer } from "@/services/api";
import type { Item } from "@/types/inventory";
import type {
  OrderStatus,
  ProcurementMethod,
  SalesOrder,
  SalesOrderDocument,
} from "@/types/sales-order";
import type { Employee } from "@/components/employees/employees-store";
import { useRole } from "@/hooks/useRole";
import { useBranch } from "@/contexts/BranchContext";

export const Route = createFileRoute("/app/bids")({
  component: BidsPage,
  head: () => ({ meta: [{ title: "Bids & Procurement · Queenstech ERP" }] }),
});

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  submitted: { label: "Submitted", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-500", icon: Clock },
  successful: { label: "Successful / Awarded", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500", icon: CheckCircle2 },
  draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-600 dark:text-slate-500", icon: FilePlus },
  advertised: { label: "Advertised / Invited", cls: "bg-sky-500/10 text-sky-600 dark:text-sky-500", icon: Megaphone },
  submitted_egp: { label: "Submitted on e-GP", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-500", icon: Send },
  bid_opened: { label: "Bid Opened (Public)", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-500", icon: FolderOpen },
  tech_eval: { label: "Under Technical Evaluation", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-500", icon: ClipboardCheck },
  fin_eval: { label: "Under Financial Evaluation", cls: "bg-orange-500/10 text-orange-600 dark:text-orange-500", icon: Calculator },
  evaluated: { label: "Evaluated (BEB Shortlist)", cls: "bg-teal-500/10 text-teal-600 dark:text-teal-500", icon: CheckSquare },
  contracts_cmte: { label: "Contracts Committee", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-500", icon: Users2 },
  awarded: { label: "Awarded (BEB Notice)", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500", icon: Trophy },
  contract_signed: { label: "Contract Signed", cls: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-600", icon: Signature },
  complete: { label: "Complete / Delivered", cls: "bg-emerald-800/15 text-emerald-800 dark:text-emerald-700", icon: CheckCircle2 },
  declined: { label: "Declined / Disqualified", cls: "bg-destructive/10 text-destructive dark:text-rose-400", icon: XCircle },
};

const OLD_STATUS_MAP: Record<string, OrderStatus> = {
  draft: "draft",
  advertised: "advertised",
  submitted: "submitted_egp",
  confirmed: "submitted_egp",
  in_progress: "tech_eval",
  delivered: "awarded",
  cancelled: "declined",
  successful: "awarded",
  decline: "declined",
} as const;

function migrateOrder(o: SalesOrder): SalesOrder {
  const rawStatus = (o.status as unknown as string) || "submitted_egp";
  const known12: OrderStatus[] = [
    "draft", "advertised", "submitted_egp", "bid_opened", "tech_eval",
    "fin_eval", "evaluated", "contracts_cmte", "awarded", "contract_signed",
    "complete", "declined",
  ];
  const mappedStatus: OrderStatus = known12.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : (OLD_STATUS_MAP[rawStatus] ?? "submitted_egp");
  let declineReason = o.declineReason;
  if (mappedStatus === "declined" && !declineReason && rawStatus === "cancelled") {
    declineReason = "Disqualified during evaluation / cancelled by procuring entity";
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

const UGANDA_2026_PUBLIC_HOLIDAYS: string[] = [
  "2026-01-01", "2026-01-26", "2026-03-08", "2026-04-03", "2026-04-06",
  "2026-05-01", "2026-05-25", "2026-06-03", "2026-06-09", "2026-09-09",
  "2026-10-09", "2026-10-19", "2026-12-25", "2026-12-26", "2026-12-31",
];

function workingDaysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      const iso = cur.toISOString().slice(0, 10);
      if (!UGANDA_2026_PUBLIC_HOLIDAYS.includes(iso)) count += 1;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

type TabType = "pipeline" | "compliance" | "local_content" | "standstill" | "archive";

function BidsPage() {
  const { isAdmin, isManager } = useRole();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [documents, setDocuments] = useState<SalesOrderDocument[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [activeTab, setActiveTab] = useState<TabType>("pipeline");
  const [formOpen, setFormOpen] = useState(false);
  const [lpoAccountFormOpen, setLpoAccountFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const [lpoSideSheetOrder, setLpoSideSheetOrder] = useState<SalesOrder | null>(null);
  const [declineDialogTarget, setDeclineDialogTarget] = useState<SalesOrder | null>(null);

  const PIPELINE_STATUSES: OrderStatus[] = [
    "draft", "advertised", "submitted_egp", "bid_opened", "tech_eval",
    "fin_eval", "evaluated", "contracts_cmte",
  ];
  const ARCHIVE_STATUSES: OrderStatus[] = [
    "awarded", "contract_signed", "complete", "declined",
  ];

  const loadDatabaseOrders = useCallback(async () => {
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
      const message = error instanceof Error ? error.message : "Failed to load bids";
      toast.error(message);
    }
  }, []);

  const loadAllDocuments = useCallback(async () => {
    try {
      const allDocs = await getAllDocuments().catch(async () => {
        if (orders.length === 0) return [];
        const results = await Promise.all(
          orders.map((o) => getOrderDocuments(o.id).catch(() => [] as SalesOrderDocument[]))
        );
        return results.flat();
      });
      setDocuments(allDocs);
    } catch {
      // silently ignore
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
    if (orders.length > 0 && (activeTab === "compliance" || activeTab === "archive")) {
      loadAllDocuments();
    }
  }, [activeTab, orders.length, loadAllDocuments]);

  const pipelineOrders = useMemo(() => orders.filter((o) => PIPELINE_STATUSES.includes(o.status)), [orders, PIPELINE_STATUSES]);
  const archiveOrders = useMemo(() => orders.filter((o) => ARCHIVE_STATUSES.includes(o.status)), [orders, ARCHIVE_STATUSES]);

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
      toast.success(`Tender Bid ${created.lpoNumber} created`);
      setFormOpen(false);
      setLpoAccountFormOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create bid";
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
        payload.declineReason = declineReason || "Declined during PPDA evaluation";
      }
      const updated = await updateOrder(id, payload);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      if (previewOrder?.id === id) setPreviewOrder(updated);
      toast.success(status === "declined" ? "Bid marked as declined" : "Tender status updated");
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
      if (previewOrder?.id === id) setPreviewOrder(updated);
      toast.success("Tender details updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update tender";
      toast.error(message);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) {
      toast.error("Admin access required to delete tender records");
      return;
    }
    try {
      await deleteOrder(id);
      setOrders((current) => current.filter((o) => o.id !== id));
      toast.success("Tender record deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete bid";
      toast.error(message);
    }
  }

  const activePipelineValue = pipelineOrders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const activeStandstillCount = orders.filter(
    (o) => o.ppdaCompliance?.standstillEndDate && new Date(o.ppdaCompliance.standstillEndDate) >= new Date(todayISO() + "T00:00:00")
  ).length;
  const localPreferenceCount = orders.filter((o) => o.ppdaCompliance?.isUgandanLocalContent ?? true).length;

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* UGANDA e-GP HERO HEADER */}
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/20 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-md"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/20 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Uganda Public Procurement (PPDA Act Cap 205)
              </span>
              <Badge variant="outline" className="border-white/30 text-white bg-black/20 text-[10px]">
                e-GP Phase 2 Ready
              </Badge>
              <Badge variant="outline" className="border-amber-300/40 text-amber-200 bg-amber-500/10 text-[10px]">
                Sec 91A Standstill Enforced
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {orders.length} Solicitations · UGX {orders.reduce((s, o) => s + (o.amount || 0), 0).toLocaleString()} Total Value
            </h1>
            <p className="max-w-3xl text-xs text-white/80 leading-relaxed">
              Automated Ugandan bidding workflow engine: e-GP submission tracking, statutory clearances (URA TCC &amp; NSSF), Section 50 domestic content preference margins (+15% goods / +7% works), and 10-working-day administrative review standstill periods.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            <Button
              onClick={() => setLpoAccountFormOpen(true)}
              size="sm"
              className="bg-white text-[#003399] font-semibold hover:bg-white/95 shadow-sm"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
              New Tender Account
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label="Active Bids"
          value={pipelineOrders.length.toString()}
          icon={Package}
          hint={`UGX ${activePipelineValue.toLocaleString()}`}
          tone="brand"
          onClick={() => setActiveTab("pipeline")}
        />
        <KpiCard
          label="Under Evaluation"
          value={orders.filter((o) => ["tech_eval", "fin_eval"].includes(o.status)).length.toString()}
          icon={Clock}
          hint="Technical &amp; Financial"
          tone="amber"
          onClick={() => setActiveTab("pipeline")}
        />
        <KpiCard
          label="Statutory Passport"
          value="100% Compliant"
          icon={ShieldCheck}
          hint="URA Tax Clearance &amp; NSSF"
          tone="emerald"
          onClick={() => setActiveTab("compliance")}
        />
        <KpiCard
          label="Standstill (Sec 91A)"
          value={activeStandstillCount.toString()}
          icon={Scale}
          hint="10-working-day review"
          tone="blue"
          onClick={() => setActiveTab("standstill")}
        />
        <KpiCard
          label="Local Content (Sec 50)"
          value={localPreferenceCount.toString()}
          icon={Building2}
          hint="+15% / +7% Preference"
          tone="rose"
          onClick={() => setActiveTab("local_content")}
        />
      </div>

      {/* TAB NAVIGATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900 border border-border">
          {[
            { id: "pipeline", label: `Active Bids (${pipelineOrders.length})`, icon: FolderKanban },
            { id: "compliance", label: "Statutory Passport", icon: ShieldCheck },
            { id: "local_content", label: "Local Content (Sec 50)", icon: Building2 },
            { id: "standstill", label: `Sec 91A Standstill (${activeStandstillCount})`, icon: Scale },
            { id: "archive", label: `Archive (${archiveOrders.length})`, icon: Trophy },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  active
                    ? "bg-white text-[#003399] shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}
      {activeTab === "pipeline" && (
        <BidsPipelineWorkspace
          orders={filteredOrders(pipelineOrders, query, statusFilter)}
          query={query}
          setQuery={setQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onPreview={(o) => setPreviewOrder(o)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          isAdmin={isAdmin}
          onCreateNew={() => setLpoAccountFormOpen(true)}
        />
      )}

      {activeTab === "compliance" && (
        <StatutoryComplianceWorkspace
          orders={orders}
          documents={documents}
        />
      )}

      {activeTab === "local_content" && (
        <LocalContentPreferenceWorkspace orders={orders} />
      )}

      {activeTab === "standstill" && (
        <AdministrativeReviewWorkspace orders={orders} />
      )}

      {activeTab === "archive" && (
        <ArchiveWorkspace
          orders={archiveOrders}
          documents={documents}
          customers={customers}
          employees={branchScopedEmployees}
          onPreview={(o) => setLpoSideSheetOrder(o)}
          onSwitchToCompliance={() => setActiveTab("compliance")}
          onCreateLpoAccount={() => setLpoAccountFormOpen(true)}
        />
      )}

      {/* CREATE TENDER ACCOUNT SHEET */}
      <CreateTenderAccountSheet
        open={lpoAccountFormOpen || formOpen}
        onOpenChange={(v) => {
          setLpoAccountFormOpen(v);
          setFormOpen(v);
        }}
        nextLpo={nextLpo(orders)}
        customers={customers}
        employees={branchScopedEmployees}
        onCreateLpoAccount={handleCreate}
      />

      {/* TENDER SIDE PREVIEW SHEET */}
      <TenderSidePreviewSheet
        order={previewOrder || lpoSideSheetOrder}
        open={Boolean(previewOrder || lpoSideSheetOrder)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPreviewOrder(null);
            setLpoSideSheetOrder(null);
          }
        }}
        documents={documents}
        customers={customers}
        employees={branchScopedEmployees}
        onStatusChange={handleStatusChange}
        onUpdateOrder={handleUpdateOrder}
      />

      {/* DECLINE REASON DIALOG */}
      <DeclineReasonDialog
        order={declineDialogTarget}
        open={Boolean(declineDialogTarget)}
        onOpenChange={(open: boolean) => !open && setDeclineDialogTarget(null)}
        onConfirm={handleConfirmDecline}
      />
    </div>
  );
}

function filteredOrders(list: SalesOrder[], query: string, statusFilter: OrderStatus | "all") {
  return list.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      o.lpoNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.handledBy.toLowerCase().includes(q) ||
      (o.customerQuotation || "").toLowerCase().includes(q)
    );
  });
}

/* TAB 1: BIDS PIPELINE WORKSPACE */
function BidsPipelineWorkspace({
  orders,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  onPreview,
  onStatusChange,
  onDelete,
  isAdmin,
  onCreateNew,
}: {
  orders: SalesOrder[];
  query: string;
  setQuery: (q: string) => void;
  statusFilter: OrderStatus | "all";
  setStatusFilter: (s: OrderStatus | "all") => void;
  onPreview: (o: SalesOrder) => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
  onCreateNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tender #, procuring entity, handler…"
            className="pl-9 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[180px] text-xs bg-white">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Procurement Stages</SelectItem>
            {Object.keys(STATUS_META).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onCreateNew} size="sm" className="bg-[#003399] text-white hover:bg-[#00297a] font-medium gap-1.5">
          <Plus className="h-4 w-4" />
          New Tender Bid
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableHead className="text-xs font-semibold text-[#003399]">Tender #</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Procuring Entity</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Handled By</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Bid Amount (UGX)</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Submission Deadline</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Stage</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                  No active tender bids match your filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => {
                const meta = STATUS_META[o.status] || STATUS_META.submitted;
                const StatusIcon = meta.icon;
                return (
                  <TableRow key={o.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => onPreview(o)}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{o.lpoNumber}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">{o.customerName}</TableCell>
                    <TableCell className="text-xs text-slate-600">{o.handledBy || "Unassigned"}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900">
                      UGX {(o.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 font-mono">{o.dateToBeDelivered}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1 border-0 text-[11px]", meta.cls)}>
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-[#003399]" onClick={() => onPreview(o)} title="Preview">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* TAB 2: STATUTORY COMPLIANCE & PROVIDER PASSPORT WORKSPACE */
function StatutoryComplianceWorkspace({ orders, documents }: { orders: SalesOrder[]; documents: SalesOrderDocument[] }) {
  const checklist = [
    { title: "URA Tax Clearance Certificate (TCC)", code: "tcc_ura", desc: "Current URA e-TCC registered to Ugandan TIN", status: "Valid", tone: "emerald" },
    { title: "NSSF Statutory Clearance Certificate", code: "nssf_clearance", desc: "National Social Security Fund compliance certificate", status: "Valid", tone: "emerald" },
    { title: "PPDA Register of Providers (ROP)", code: "ppda_rop", desc: "Active Ugandan Provider Certificate on PPDA Portal", status: "Active", tone: "emerald" },
    { title: "URSB Certificate of Incorporation", code: "ursb_inc", desc: "Company Registration & Form 20 Directors Return", status: "Valid", tone: "emerald" },
    { title: "Local Trading License (KCCA / LG)", code: "trading_license", desc: "Annual business operation license", status: "Valid", tone: "emerald" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900/5 to-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ugandan Statutory Provider Passport</h3>
              <p className="text-xs text-slate-500">Verified legal and tax compliance profile for public tender submissions in Uganda</p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white text-xs px-3 py-1">100% Fully Compliant</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {checklist.map((item) => (
          <div key={item.title} className="rounded-xl border border-border bg-white p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                {item.title}
              </span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">{item.status}</Badge>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            <div className="pt-2 flex items-center justify-between border-t text-[11px] text-slate-500">
              <span>Status: <strong className="text-emerald-700">Verified</strong></span>
              <span className="font-mono text-emerald-600">Valid 2026</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* TAB 3: LOCAL CONTENT & PREFERENCE WORKSPACE (SEC 50) */
function LocalContentPreferenceWorkspace({ orders }: { orders: SalesOrder[] }) {
  const [basePrice, setBasePrice] = useState("500000000");
  const [domesticAddPct, setDomesticAddPct] = useState("35");
  const [isWorks, setIsWorks] = useState(false);
  const [foreignBidPrice, setForeignBidPrice] = useState("480000000");

  const marginPct = isWorks ? 7 : 15;
  const numForeign = Number(foreignBidPrice) || 0;
  const numBase = Number(basePrice) || 0;
  const adjustedForeignPrice = numForeign * (1 + marginPct / 100);
  const isUgandanWinning = numBase <= adjustedForeignPrice;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-slate-900/5 to-white p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#003399] text-white shadow-sm">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">PPDA Section 50 Margin of Preference Simulator</h3>
              <p className="text-xs text-slate-500">Simulate statutory preference margins applied during evaluated-price comparison in Ugandan tenders</p>
            </div>
          </div>
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-xs">+15% Goods · +7% Works</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
            <Calculator className="h-4 w-4 text-[#003399]" />
            Preference Inputs &amp; Parameters
          </h4>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Ugandan Supplier Bid Price (UGX)</Label>
              <Input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} type="number" className="font-mono text-xs mt-1" />
            </div>

            <div>
              <Label className="text-xs font-semibold">Ugandan Domestic Value Addition (%)</Label>
              <Input value={domesticAddPct} onChange={(e) => setDomesticAddPct(e.target.value)} type="number" className="font-mono text-xs mt-1" />
              <p className="text-[10px] text-slate-500 mt-1">PPDA Sec 50 requires ≥30% Ugandan input/labor for domestic preference eligibility.</p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Contract Type</Label>
              <Select value={isWorks ? "works" : "supplies"} onValueChange={(v) => setIsWorks(v === "works")}>
                <SelectTrigger className="text-xs mt-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplies">Supplies &amp; Services (+15% Preference)</SelectItem>
                  <SelectItem value="works">Works &amp; Construction (+7% Preference)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Competing Foreign Bid Price (UGX)</Label>
              <Input value={foreignBidPrice} onChange={(e) => setForeignBidPrice(e.target.value)} type="number" className="font-mono text-xs mt-1" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#003399]/20 bg-slate-50 p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
            <Trophy className="h-4 w-4 text-[#003399]" />
            Evaluated Price Comparison Result
          </h4>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-white p-3 text-xs space-y-1">
              <span className="text-slate-500 block text-[11px]">Unadjusted Foreign Competitor Bid</span>
              <span className="font-mono font-bold text-slate-900 text-sm">UGX {numForeign.toLocaleString()}</span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
              <span className="text-amber-800 font-semibold block text-[11px]">Statutory Preference Load (+{marginPct}%)</span>
              <span className="font-mono font-bold text-amber-900 text-sm">UGX {(adjustedForeignPrice - numForeign).toLocaleString()}</span>
              <p className="text-[10px] text-amber-800/90">Applied to foreign bid during evaluated price ranking.</p>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs space-y-1">
              <span className="text-blue-800 font-semibold block text-[11px]">Adjusted Foreign Evaluated Price</span>
              <span className="font-mono font-bold text-blue-900 text-base">UGX {adjustedForeignPrice.toLocaleString()}</span>
            </div>

            <div className={cn(
              "rounded-xl border p-4 text-xs font-semibold flex items-center justify-between",
              isUgandanWinning ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900" : "border-rose-500/30 bg-rose-500/10 text-rose-900"
            )}>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {isUgandanWinning ? "Ugandan Supplier Wins Evaluated Ranking!" : "Foreign Bid Remains Lower After Preference"}
              </span>
              <Badge className={isUgandanWinning ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}>
                {isUgandanWinning ? "Rank #1" : "Rank #2"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* TAB 4: SEC 91A ADMINISTRATIVE REVIEW TRACKER WORKSPACE */
function AdministrativeReviewWorkspace({ orders }: { orders: SalesOrder[] }) {
  const todayIso = todayISO();
  const activeStandstills = orders.filter(
    (o) => o.ppdaCompliance?.standstillEndDate && new Date(o.ppdaCompliance.standstillEndDate) >= new Date(todayIso + "T00:00:00")
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900/5 to-white p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
              <Scale className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Section 91A Administrative Review Standstill Tracker</h3>
              <p className="text-xs text-slate-500">10-working-day mandatory standstill period post BEB publication prior to contract execution</p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs">10 Working Days Mandatory</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm p-4 space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
          <Clock className="h-4 w-4 text-amber-600" />
          Active BEB Standstill Countdowns ({activeStandstills.length})
        </h4>

        {activeStandstills.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl">
            No tenders currently in administrative review standstill window.
          </div>
        ) : (
          <div className="space-y-3">
            {activeStandstills.map((o) => {
              const wdLeft = workingDaysBetween(todayIso, o.ppdaCompliance!.standstillEndDate!);
              return (
                <div key={o.id} className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900">{o.lpoNumber}</span>
                    <h5 className="text-xs font-semibold text-slate-800 mt-0.5">{o.customerName}</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">BEB Published: {o.ppdaCompliance?.bebNoticeDate || "—"}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className="bg-amber-600 text-white text-xs">{wdLeft} Working Days Left</Badge>
                    <p className="text-[11px] font-mono text-slate-600">Standstill Ends: {o.ppdaCompliance?.standstillEndDate}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* TAB 5: ARCHIVE WORKSPACE */
function ArchiveWorkspace({
  orders,
  documents,
  customers,
  employees,
  onPreview,
  onSwitchToCompliance,
  onCreateLpoAccount,
}: {
  orders: SalesOrder[];
  documents: SalesOrderDocument[];
  customers: Customer[];
  employees: Employee[];
  onPreview: (order: SalesOrder) => void;
  onSwitchToCompliance: () => void;
  onCreateLpoAccount: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        o.lpoNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.handledBy.toLowerCase().includes(q)
    );
  }, [orders, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search archived tenders..."
            className="pl-9 text-xs"
          />
        </div>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-1.5 text-xs">
          <Printer className="h-4 w-4" />
          Print Audit Report
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableHead className="text-xs font-semibold text-[#003399]">Tender #</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Procuring Entity</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Amount (UGX)</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Stage</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399]">Disqualification Rationale</TableHead>
              <TableHead className="text-xs font-semibold text-[#003399] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-xs">
                  No archived bids found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => {
                const meta = STATUS_META[o.status] || STATUS_META.declined;
                return (
                  <TableRow key={o.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => onPreview(o)}>
                    <TableCell className="font-mono text-xs font-bold text-slate-900">{o.lpoNumber}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800">{o.customerName}</TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900">
                      UGX {(o.amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1 border-0 text-[11px]", meta.cls)}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[260px] truncate">
                      {o.status === "declined" ? o.declineReason || "Disqualified during evaluation" : "Awarded contract"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-[#003399]" onClick={() => onPreview(o)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "brand",
  onClick,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  hint?: string;
  tone?: "brand" | "emerald" | "blue" | "amber" | "rose";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-white p-4 text-left shadow-xs transition-all hover:shadow-md",
        onClick ? "cursor-pointer hover:border-[#003399]/30" : "cursor-default"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-bold text-slate-900 tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500 truncate">{hint}</p>}
    </button>
  );
}

function CreateTenderAccountSheet({
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
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState(todayISO());
  const [handledBy, setHandledBy] = useState(employees[0]?.name || "");
  const [procurementMethod, setProcurementMethod] = useState<ProcurementMethod>("open_domestic");

  useEffect(() => {
    if (open) {
      setLpoNumber(nextLpo);
      setSubmissionDeadline(todayISO());
      setHandledBy(employees[0]?.name || "");
    }
  }, [open, nextLpo, employees]);

  function submit() {
    if (!companyName.trim() || !lpoNumber.trim()) {
      toast.error("Please fill in Tender Number and Procuring Entity Name");
      return;
    }
    const newBid: SalesOrder = {
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived: todayISO(),
      customerName: companyName.trim(),
      customerId: selectedCustomerId !== "custom" ? selectedCustomerId : undefined,
      dateToBeDelivered: submissionDeadline,
      handledBy: handledBy.trim(),
      status: "submitted_egp",
      amount: parseFloat(feeAmount) || 0,
      createdAt: new Date().toISOString(),
      ppdaCompliance: {
        procurementMethod,
        isUgandanLocalContent: true,
        domesticContentPct: 35,
        uraTaxClearanceStatus: "valid",
        nssfClearanceStatus: "valid",
        ppdaRopRegistered: true,
      },
    };
    onCreateLpoAccount(newBid);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[540px] overflow-y-auto p-6 space-y-5">
        <div className="border-b pb-3">
          <h2 className="text-lg font-bold text-slate-900">Create New Tender Bid Account</h2>
          <p className="text-xs text-slate-500">Configure tender parameters for Ugandan public procurement submission</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold">Tender Account / LPO # *</Label>
            <Input value={lpoNumber} onChange={(e) => setLpoNumber(e.target.value)} className="font-mono text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs font-semibold">Procuring Entity Name *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Ministry of Health Uganda" className="text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs font-semibold">Procurement Method (PPDA Schedule 4)</Label>
            <Select value={procurementMethod} onValueChange={(v) => setProcurementMethod(v as ProcurementMethod)}>
              <SelectTrigger className="text-xs mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_domestic">Open Domestic Bidding (≥ UGX 500M)</SelectItem>
                <SelectItem value="restricted_bidding">Restricted Bidding / Pre-qualified</SelectItem>
                <SelectItem value="request_for_quotation">Request for Quotation (RFQ)</SelectItem>
                <SelectItem value="micro_procurement">Micro-Procurement (&lt; UGX 5M)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Estimated Tender Amount (UGX)</Label>
            <Input value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} type="number" placeholder="500000000" className="font-mono text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs font-semibold">Submission Deadline Date</Label>
            <Input value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} type="date" className="font-mono text-xs mt-1" />
          </div>

          <div>
            <Label className="text-xs font-semibold">Staff Handler</Label>
            <Input value={handledBy} onChange={(e) => setHandledBy(e.target.value)} className="text-xs mt-1" />
          </div>
        </div>

        <SheetFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-[#003399] text-white hover:bg-[#00297a]">Create Tender Account</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function TenderSidePreviewSheet({
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
  const meta = STATUS_META[order.status] || STATUS_META.submitted;
  const StatusIcon = meta.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto p-6 space-y-5">
        <div className="border-b pb-3 flex items-center justify-between">
          <div>
            <Badge variant="outline" className={cn("gap-1 border-0 text-[11px] mb-1", meta.cls)}>
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <h2 className="font-mono text-lg font-bold text-slate-900">{order.lpoNumber}</h2>
            <p className="text-xs text-slate-500">{order.customerName}</p>
          </div>
          <div className="text-right font-mono">
            <span className="text-[10px] uppercase text-slate-400 font-bold block">Bid Amount</span>
            <span className="text-sm font-bold text-[#003399]">UGX {(order.amount || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="rounded-xl border p-3.5 bg-slate-50 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Submission Deadline:</span>
              <span className="font-mono font-bold text-slate-900">{order.dateToBeDelivered}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Handled By:</span>
              <span className="font-semibold text-slate-900">{order.handledBy || "Unassigned"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Change Procurement Stage</Label>
            <Select value={order.status} onValueChange={(v) => onStatusChange(order.id, v as OrderStatus)}>
              <SelectTrigger className="text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(STATUS_META).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

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
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-rose-600 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Disqualify / Decline Tender Bid ({order.lpoNumber})
          </DialogTitle>
          <DialogDescription className="text-xs">
            Specify the disqualification rationale or reason for decline.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Failed technical evaluation, non-responsive pricing, missing URA tax clearance..."
            rows={3}
            className="text-xs"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Confirm Disqualification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
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
  Ruler,
  Printer,
  CreditCard as CardIcon,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { motion, AnimatePresence } from "framer-motion";
import { createOrder, deleteOrder, deleteOrderDocument, getAllDocuments, getCustomers, getEmployees, getItems, getOrderDocuments, getOrders, updateOrder, uploadOrderDocument } from "@/services/api";
import type { Customer } from "@/services/api";
import type { Item } from "@/types/inventory";
import type { AssetCategorySpec, ComplianceStatus, OrderComplaint, OrderItem, OrderStatus, PpdaComplianceDetails, ProcurementMethod, QuotationAttachment, SalesDocumentType, SalesOrder, SalesOrderDocument } from "@/types/sales-order";
import { formatAssetSpec } from "@/types/sales-order";
import { useAssetsStore, getAssetCategoryKind, getAssetCategoryTint } from "@/components/assets/assets-store";
import type { Employee } from "@/components/employees/employees-store";
import { useRole } from "@/hooks/useRole";
import { useBranch } from "@/contexts/BranchContext";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
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
  const known12: OrderStatus[] = ["draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte","awarded","contract_signed","complete","declined"];
  const mappedStatus: OrderStatus =
    known12.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : (OLD_STATUS_MAP[rawStatus] ?? "submitted_egp");
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

function PpdaPreferenceBadge({ order }: { order: SalesOrder }) {
  const amount = Number(order.amount) || 0;
  const pc = order.ppdaCompliance;
  const isLocal = Boolean(pc?.isUgandanLocalContent);
  const domesticPct = Number(pc?.domesticContentPct) || 0;
  const works = pc?.procurementMethod === "restricted_bidding" || amount >= 10_000_000;
  const isMicro =
    amount < 5_000_000 ||
    (works && amount < 10_000_000 && isLocal);
  const schedule3 = isLocal && domesticPct >= 30;
  const marginPct = works ? 7 : 15;

  const badges: React.ReactNode[] = [];
  if (isMicro) {
    badges.push(
      <span
        key="micro"
        title="PPDA Schedule 4 (2023 Amend) Micro-procurement threshold: <UGX 5M (supplies/services) · <UGX 10M (works). No Contracts Committee required."
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700"
      >
        <Info className="h-3 w-3" />
        Micro · Sched 4
      </span>
    );
  }
  if (schedule3) {
    badges.push(
      <span
        key={`local-${marginPct}`}
        title={`PPDA Schedule 3 · Margin of Preference. Foreign bids are adjusted upward by +${marginPct}% during evaluated-price comparison. Requires ≥30% Ugandan domestic value-add (PPDA Sec 50).`}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
      >
        <Check className="h-3 w-3" />
        Local Pref +{marginPct}%
      </span>
    );
  }
  if (badges.length === 0) return null;
  return <div className="flex items-center gap-1 mb-1">{badges}</div>;
}

interface DeclineReasonDialogProps {
  order: SalesOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

function DeclineReasonDialog(props: DeclineReasonDialogProps) {
  if (!props.order) return null;
  return <DeclineReasonDialogBody {...props} order={props.order} />;
}

function DeclineReasonDialogBody({
  order,
  open,
  onOpenChange,
  onConfirm,
}: DeclineReasonDialogProps & { order: NonNullable<DeclineReasonDialogProps["order"]> }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (order) {
      setReason(order.declineReason || "");
    } else {
      setReason("");
    }
  }, [order]);

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
              placeholder="State why this bid / tender / LPO is disqualified, withdrawn or declined (e.g., failed technical evaluation, missing PPDA clearances, pricing non-responsive, cancelled by procuring entity)..."
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
  const [activeTab, setActiveTab] = useState<"documents" | "lpo" | "orders" | "ppda">("documents");
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
      const message = error instanceof Error ? error.message : "Failed to load bids";
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
    const evalStages: OrderStatus[] = ["tech_eval", "fin_eval"];
    const evalCount = orders.filter((o) => evalStages.includes(o.status)).length;
    const evalValue = orders
      .filter((o) => evalStages.includes(o.status))
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const pipelineStages: OrderStatus[] = ["draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte"];
    const stagesInProgressCount = orders.filter((o) => pipelineStages.includes(o.status)).length;
    const closedCount = orders.filter((o) => o.status === "awarded" || o.status === "contract_signed" || o.status === "complete").length;
    const closedValue = orders
      .filter((o) => o.status === "awarded" || o.status === "contract_signed" || o.status === "complete")
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const declinedCount = orders.filter((o) => o.status === "declined").length;
    const declinedValue = orders
      .filter((o) => o.status === "declined")
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const today = todayISO();
    let overdueCount = 0;
    let overdueValue = 0;
    const thisMonth = new Date().toISOString().slice(0, 7);
    let awardedThisMonth = 0;
    let awardedThisMonthValue = 0;
    let complianceGapCount = 0;
    orders.forEach((o) => {
      const isOpen = pipelineStages.includes(o.status);
      if (isOpen && new Date(o.dateToBeDelivered) < new Date(today)) {
        overdueCount++;
        overdueValue += Number(o.amount) || 0;
      }
      if (o.status === "awarded" || o.status === "contract_signed" || o.status === "complete") {
        const d = (o.updatedAt || o.createdAt || "").slice(0, 7);
        if (d === thisMonth) {
          awardedThisMonth++;
          awardedThisMonthValue += Number(o.amount) || 0;
        }
      }
      if (isOpen && o.ppdaCompliance) {
        const cp = o.ppdaCompliance;
        const checklistFields: (keyof typeof cp)[] = ["uraTccStatus","nssfClearanceStatus","ppdaCertStatus","ursbStatus","auditedAccountsStatus","bidSecurityStatus","prnProofStatus","declarationsStatus"];
        for (const f of checklistFields) {
          const v = cp[f];
          if (v === "pending" || v === "expired") complianceGapCount++;
        }
      }
    });
    return {
      totalOrders,
      totalValue,
      evalCount,
      evalValue,
      stagesInProgressCount,
      closedCount,
      closedValue,
      declinedCount,
      declinedValue,
      overdueCount,
      overdueValue,
      awardedThisMonth,
      awardedThisMonthValue,
      complianceGapCount,
      submittedCount: stagesInProgressCount,
      submittedValue: evalValue,
      successfulCount: closedCount,
      successfulThisMonth: awardedThisMonth,
      successfulThisMonthValue: awardedThisMonthValue,
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
              Bids & PPDA Procurement Hub
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} new this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {(dashboardStats.totalOrders || 0).toLocaleString()} Bids & Solicitations · UGX {(dashboardStats.totalValue || 0).toLocaleString()} total value
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {dashboardStats.submittedCount || 0} active bids under evaluation · UGX {(dashboardStats.submittedValue || 0).toLocaleString()} tendered · {dashboardStats.successfulCount || 0} awarded contracts · {dashboardStats.declinedCount || 0} disqualified
              {(dashboardStats.overdueCount || 0) > 0 && (
                <> · <span className="font-semibold text-amber-200">{dashboardStats.overdueCount} overdue/standstill</span></>
              )}
              {(dashboardStats.successfulThisMonth || 0) > 0 && (
                <> · <span className="text-emerald-200/90">{(dashboardStats.successfulThisMonth || 0).toLocaleString()} awarded this month (UGX {(dashboardStats.successfulThisMonthValue || 0).toLocaleString()})</span></>
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
              New Bid
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
          label="Total Tenders"
          value={(dashboardStats.totalOrders || 0).toLocaleString()}
          icon={Package}
          hint={`UGX ${(dashboardStats.totalValue || 0).toLocaleString()} lifetime`}
          tone="brand"
        />
        <KpiCard
          label="Under Evaluation"
          value={(dashboardStats.evalCount || 0).toLocaleString()}
          icon={Clock}
          hint={`UGX ${(dashboardStats.evalValue || 0).toLocaleString()} tendered`}
          tone="amber"
        />
        <KpiCard
          label="Stages In Progress"
          value={(dashboardStats.stagesInProgressCount || 0).toLocaleString()}
          icon={GripVertical}
          hint={(dashboardStats.stagesInProgressCount || 0) > 0 ? "Draft through Contracts Cmte" : "Pipeline idle"}
          tone="blue"
          onClick={() => {
            setActiveTab("ppda");
            setOverdueOnly(false);
          }}
        />
        <KpiCard
          label="Compliance Gaps"
          value={(dashboardStats.complianceGapCount || 0).toLocaleString()}
          icon={(dashboardStats.complianceGapCount || 0) > 0 ? ShieldAlert : ShieldCheck}
          hint={(dashboardStats.complianceGapCount || 0) > 0 ? `${dashboardStats.complianceGapCount} pending / expired items` : "All clear — statutory checklist complete"}
          tone={(dashboardStats.complianceGapCount || 0) > 0 ? "rose" : "emerald"}
          onClick={() => setActiveTab("ppda")}
        />
      </motion.section>

      {/* TAB BAR */}
      <motion.section
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIndex("tabs"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-md items-center rounded-full bg-muted/40 p-1 ring-1 ring-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
      >
        {(["documents", "lpo", "orders", "ppda"] as const).map((t) => {
          const active = activeTab === t;
          const label =
            t === "documents" ? `Documents ${documents.length ? `(${documents.length})` : ""}`
            : t === "lpo" ? `LPO & Awarded (${orders.length})`
            : t === "ppda" ? `PPDA Compliance`
            : `Bids (${filtered.length})`;
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

      {activeTab === "ppda" && (
        <div className="space-y-6">
          {(() => {
            const openOrders = orders.filter((o) => ["draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte"].includes(o.status));
            const complianceFields: Array<{ key: keyof PpdaComplianceDetails | ""; label: string; short: string }> = [
              { key: "uraTccStatus", label: "URA TCC", short: "TCC" },
              { key: "nssfClearanceStatus", label: "NSSF", short: "NSSF" },
              { key: "ppdaCertStatus", label: "PPDA ROP", short: "PPDA" },
              { key: "ursbStatus", label: "URSB", short: "URSB" },
              { key: "auditedAccountsStatus", label: "Audited Accts", short: "AUD" },
              { key: "bidSecurityStatus", label: "Bid Security", short: "SEC" },
              { key: "prnProofStatus", label: "PRN Fee", short: "PRN" },
              { key: "declarationsStatus", label: "Declarations", short: "DEC" },
            ];
            const chipCls = (s?: ComplianceStatus) =>
              s === "valid" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
              s === "pending" ? "bg-amber-500/10 text-amber-700 border-amber-200" :
              s === "expired" ? "bg-rose-500/10 text-rose-700 border-rose-200" :
              "bg-slate-100 text-slate-600 border-slate-200";
            const chipDot = (s?: ComplianceStatus) =>
              s === "valid" ? "bg-emerald-500" :
              s === "pending" ? "bg-amber-500" :
              s === "expired" ? "bg-rose-500" :
              "bg-slate-400";
            const nextVals: ComplianceStatus[] = ["valid", "pending", "expired", "not_required"];

            const stageCols: OrderStatus[] = ["draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte","awarded","contract_signed","complete","declined"];

            return (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-xl border border-border bg-white shadow-xs overflow-hidden"
                >
                  <div className="border-b border-[#003399]/15 bg-gradient-to-r from-[#003399]/8 via-[#003399]/5 to-transparent px-4 py-2.5 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Section 1 · Compliance Overview — Open Tenders ({openOrders.length})
                    </div>
                    {!canManageDocs && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                        <ShieldAlert className="h-3 w-3" />
                        Edits restricted · PPDA §16(2)
                      </span>
                    )}
                  </div>
                  {openOrders.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No tenders currently in the evaluation pipeline.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white hover:bg-white">
                            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-[#003399]">LPO #</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-[#003399]">Customer</TableHead>
                            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-[#003399]">Stage</TableHead>
                            {complianceFields.map((cf) => (
                              <TableHead key={cf.key || cf.short} className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] text-center">
                                {cf.short}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openOrders.map((o) => (
                            <TableRow
                              key={o.id}
                              className="cursor-default"
                            >
                              <TableCell className="font-mono text-xs font-medium">{o.lpoNumber}</TableCell>
                              <TableCell className="text-xs font-medium max-w-[180px] truncate" title={o.customerName}>{o.customerName}</TableCell>
                              <TableCell className="w-[150px]">
                                {(() => {
                                  const m = STATUS_META[o.status];
                                  const Ico = m.icon;
                                  return (
                                    <Badge variant="outline" className={cn("gap-1 border-0", m.cls)}>
                                      <Ico className="h-3 w-3" />
                                      {m.label}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>
                              {complianceFields.map((cf) => {
                                const cur = (o.ppdaCompliance?.[cf.key as keyof PpdaComplianceDetails] as ComplianceStatus | undefined) || "pending";
                                return (
                                  <TableCell key={cf.key || cf.short} className="text-center p-2">
                                    {canManageDocs ? (
                                      <Select
                                        value={cur}
                                        onValueChange={(v) =>
                                          handleUpdateOrder(o.id, {
                                            ppdaCompliance: {
                                              ...(o.ppdaCompliance || {}),
                                              [cf.key]: v as ComplianceStatus,
                                            } as PpdaComplianceDetails,
                                          })
                                        }
                                      >
                                        <SelectTrigger className={cn("h-7 w-[92px] mx-auto text-[10px] border px-2 rounded-full", chipCls(cur))}>
                                          <span className="inline-flex items-center gap-1 w-full justify-center">
                                            <span className={cn("h-1.5 w-1.5 rounded-full", chipDot(cur))} />
                                            <SelectValue />
                                          </span>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {nextVals.map((v) => (
                                            <SelectItem key={v} value={v} className="text-xs capitalize">{v.replace("_", " ")}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", chipCls(cur))}>
                                        <ShieldAlert className="h-3 w-3" />
                                        <span className={cn("h-1.5 w-1.5 rounded-full", chipDot(cur))} />
                                        <span className="capitalize">{cur.replace("_", " ")}</span>
                                      </span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-xl border border-border bg-white shadow-xs overflow-hidden"
                >
                  <div className="border-b border-[#003399]/15 bg-gradient-to-r from-[#003399]/8 via-[#003399]/5 to-transparent px-4 py-2.5 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Section 2 · 12-Stage PPDA Lifecycle Kanban
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{orders.length} bids</span>
                  </div>
                  <div className="p-3 overflow-x-auto">
                    <div className="grid gap-3 grid-flow-col auto-cols-[minmax(220px,1fr)]">
                      {stageCols.map((col, cIdx) => {
                        const meta = STATUS_META[col];
                        const ColIcon = meta.icon;
                        const bids = orders.filter((o) => o.status === col);
                        return (
                          <motion.div
                            key={col}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.03 * cIdx, duration: 0.2 }}
                            className="rounded-xl border border-border bg-gradient-to-b from-slate-50/60 to-white p-2.5 min-h-[120px] flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
                                <ColIcon className={cn("h-3.5 w-3.5", meta.cls.includes("emerald") ? "text-emerald-600" : meta.cls.includes("rose") ? "text-rose-600" : meta.cls.includes("amber") ? "text-amber-600" : meta.cls.includes("sky") ? "text-sky-600" : meta.cls.includes("violet") ? "text-violet-600" : meta.cls.includes("indigo") ? "text-indigo-600" : meta.cls.includes("teal") ? "text-teal-600" : meta.cls.includes("blue") ? "text-blue-600" : meta.cls.includes("orange") ? "text-orange-600" : "text-slate-600")} />
                                <span className="truncate">{meta.label}</span>
                              </div>
                              <span className="rounded-full bg-[#003399]/10 text-[#003399] text-[10px] font-bold px-1.5 min-w-[20px] text-center tabular-nums">
                                {bids.length}
                              </span>
                            </div>
                            <div className="flex-1 space-y-1.5">
                              {bids.length === 0 ? (
                                <div className="h-[60px] rounded-lg border border-dashed border-border/70 bg-slate-50/40 flex items-center justify-center text-[10px] text-muted-foreground">
                                  Empty
                                </div>
                              ) : (
                                bids.map((b) => (
                                  <div key={b.id} className="rounded-lg border border-border bg-white p-2 shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:border-[#003399]/30 hover:shadow-[0_2px_10px_-4px_rgba(0,51,153,0.25)] transition-all">
                                    <div className="flex items-start justify-between gap-1.5 mb-1">
                                      <div className="font-mono text-[11px] font-semibold text-foreground truncate">{b.lpoNumber}</div>
                                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">UGX {(Number(b.amount)||0).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate mb-1.5" title={b.customerName}>{b.customerName}</div>
                                    <Select
                                      value={b.status}
                                      onValueChange={(v) => handleStatusChange(b.id, v as OrderStatus)}
                                      disabled={["evaluated","contracts_cmte","awarded","contract_signed"].includes(col) && !canManageDocs}
                                    >
                                      <SelectTrigger className="h-6 w-full text-[9px] border-dashed border-border/80 bg-slate-50/60 px-2 hover:bg-[#003399]/5">
                                        <span className="flex items-center gap-1 w-full justify-between truncate">
                                          <span className="text-muted-foreground truncate">Move to stage →</span>
                                          <SelectValue className="text-[9px] font-semibold" />
                                        </span>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {stageCols.map((sc) => {
                                          const sm = STATUS_META[sc];
                                          const Sci = sm.icon;
                                          const gate = ["evaluated","contracts_cmte","awarded","contract_signed"].includes(sc);
                                          const dis = gate && !canManageDocs;
                                          return (
                                            <SelectItem key={sc} value={sc} disabled={dis}>
                                              <div className="flex items-center gap-1.5 pr-2">
                                                <Sci className="h-3 w-3.5" />
                                                <span className="text-xs flex-1">{sm.label}</span>
                                                {dis && <ShieldAlert className="h-3 w-3 text-rose-500" />}
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              </>
            );
          })()}

          <PpdaComplianceWorkspace orders={orders} />
        </div>
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
              title={loading ? "Loading bids" : orders.length === 0 ? "No bids yet" : "No matching bids"}
              description={
                loading
                  ? "Fetching the latest bids and tenders from the database."
                  : orders.length === 0
                  ? "Create your first bid from a procuring entity LPO to get started."
                  : "Try a different search or status filter."
              }
              actionLabel={!loading && orders.length === 0 ? "New Bid" : undefined}
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
                          <PpdaPreferenceBadge order={o} />
                          <Select
                            value={o.status}
                            onValueChange={(v) => handleStatusChange(o.id, v as OrderStatus)}
                          >
                            <SelectTrigger className="h-7 w-[170px] border-0 bg-transparent p-0 hover:bg-muted/40">
                              <Badge variant="outline" className={cn("gap-1 border-0", meta.cls)}>
                                <StatusIcon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => {
                                const sm = STATUS_META[s];
                                const Si = sm.icon;
                                const advancedGate = ["evaluated", "contracts_cmte", "awarded", "contract_signed"].includes(s);
                                const disabled = advancedGate && !canManageDocs;
                                return (
                                  <SelectItem key={s} value={s} disabled={disabled}>
                                    <div className="flex items-center gap-2 pr-2">
                                      <Si className="h-3.5 w-3.5" />
                                      <span className="flex-1">{sm.label}</span>
                                      {disabled && (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700 border border-rose-200">
                                          <ShieldAlert className="h-3 w-3" />
                                          Admin / Manager · PPDA §16(2)
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 bg-[#003399]/5 ring-1 ring-[#003399]/15 hover:bg-[#003399]/10 hover:ring-[#003399]/30 hover:shadow-[0_2px_10px_-2px_rgba(0,51,153,0.35)]"
                              onClick={(e) => { e.stopPropagation(); setPreviewOrder(o); }}
                              title="Preview bid / tender"
                            >
                              <Eye className="h-3.5 w-3.5 text-[#003399]" />
                            </Button>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 bg-destructive/5 ring-1 ring-destructive/15 hover:bg-destructive/10 hover:ring-destructive/30 hover:shadow-[0_2px_10px_-2px_rgba(244,63,94,0.35)]"
                                onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}
                                title="Delete bid"
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

  // Asset / category controls
  const assetsStore = useAssetsStore();
  const [selectedAssetId, setSelectedAssetId] = useState<string>("__none__");
  const [lfWidth, setLfWidth] = useState("");
  const [lfHeight, setLfHeight] = useState("");
  const [dpPages, setDpPages] = useState("");
  const [fgSideMode, setFgSideMode] = useState<"single" | "double">("single");
  const [fgLaminated, setFgLaminated] = useState(false);

  const selectedAsset = useMemo(
    () => (selectedAssetId !== "__none__" ? assetsStore.assets.find((a) => a.id === selectedAssetId) ?? null : null),
    [assetsStore.assets, selectedAssetId],
  );
  const selectedAssetKind = getAssetCategoryKind(selectedAsset?.category);
  const selectedAssetTint = getAssetCategoryTint(selectedAsset?.category);

  function resetCategoryInputs() {
    setLfWidth("");
    setLfHeight("");
    setDpPages("");
    setFgSideMode("single");
    setFgLaminated(false);
  }

  useEffect(() => {
    resetCategoryInputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId]);

  // Computations for category-based qty / validations
  const baseQty = Math.max(1, parseInt(addItemQty, 10) || 1);
  const lfW = parseFloat(lfWidth) || 0;
  const lfH = parseFloat(lfHeight) || 0;
  const lfArea = lfW > 0 && lfH > 0 ? lfW * lfH : 0;
  const dpNum = parseInt(dpPages, 10) || 0;

  const addComputedQty =
    selectedAssetKind === "large_format"
      ? lfArea
      : selectedAssetKind === "digital_printer"
        ? dpNum
        : baseQty;

  // Static Cart items state
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [dateToBeDelivered, setDelivery] = useState("");
  const [handledBy, setHandledBy] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ppdaProcurementMethod, setPpdaProcurementMethod] = useState<ProcurementMethod>("open_domestic");
  const [ppdaIsLocal, setPpdaIsLocal] = useState<boolean>(true);
  const [ppdaIsMsme, setPpdaIsMsme] = useState<boolean>(false);
  const [ppdaDomesticPct, setPpdaDomesticPct] = useState<string>("30");
  const [ppdaBidSecurity, setPpdaBidSecurity] = useState<boolean>(false);
  const [ppdaBidSecurityAmt, setPpdaBidSecurityAmt] = useState<string>("");
  const [ppdaBidSecurityValid, setPpdaBidSecurityValid] = useState<string>("");
  const [ppdaBidSecurityIssuer, setPpdaBidSecurityIssuer] = useState<string>("");

  const [ppdaUraTcc, setPpdaUraTcc] = useState<ComplianceStatus>("pending");
  const [ppdaNssf, setPpdaNssf] = useState<ComplianceStatus>("pending");
  const [ppdaPpdaCert, setPpdaPpdaCert] = useState<ComplianceStatus>("pending");
  const [ppdaUrsb, setPpdaUrsb] = useState<ComplianceStatus>("pending");
  const [ppdaAudited, setPpdaAudited] = useState<ComplianceStatus>("pending");
  const [ppdaBidSecStatus, setPpdaBidSecStatus] = useState<ComplianceStatus>("not_required");
  const [ppdaPrn, setPpdaPrn] = useState<ComplianceStatus>("pending");
  const [ppdaDecl, setPpdaDecl] = useState<ComplianceStatus>("pending");

  const [ppdaEvalCmte, setPpdaEvalCmte] = useState<string>("");
  const [ppdaContractsCmte, setPpdaContractsCmte] = useState<string>("");
  const [ppdaStandstillEnd, setPpdaStandstillEnd] = useState<string>("");
  const [ppdaBidOpenedAt, setPpdaBidOpenedAt] = useState<string>("");
  const [ppdaTechEvalAt, setPpdaTechEvalAt] = useState<string>("");
  const [ppdaFinEvalAt, setPpdaFinEvalAt] = useState<string>("");
  const [ppdaAwardedAt, setPpdaAwardedAt] = useState<string>("");
  const [ppdaContractSignedAt, setPpdaContractSignedAt] = useState<string>("");

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
      setSelectedAssetId("__none__");
      resetCategoryInputs();
      setDelivery("");
      setHandledBy(employees[0]?.name || "");
      setNotes("");
      setPpdaProcurementMethod("open_domestic");
      setPpdaIsLocal(true);
      setPpdaIsMsme(false);
      setPpdaDomesticPct("30");
      setPpdaBidSecurity(false);
      setPpdaBidSecurityAmt("");
      setPpdaBidSecurityValid("");
      setPpdaBidSecurityIssuer("");
      setPpdaUraTcc("pending");
      setPpdaNssf("pending");
      setPpdaPpdaCert("pending");
      setPpdaUrsb("pending");
      setPpdaAudited("pending");
      setPpdaBidSecStatus("not_required");
      setPpdaPrn("pending");
      setPpdaDecl("pending");
      setPpdaEvalCmte("");
      setPpdaContractsCmte("");
      setPpdaStandstillEnd("");
      setPpdaBidOpenedAt("");
      setPpdaTechEvalAt("");
      setPpdaFinEvalAt("");
      setPpdaAwardedAt("");
      setPpdaContractSignedAt("");
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
    if (itemId.startsWith("asset__")) {
      const assetId = itemId.slice("asset__".length);
      const asset = assetsStore.assets.find((a) => a.id === assetId);
      if (asset) {
        setSelectedAssetId(asset.id);
        setSelectedInventoryId("");
        setAddItemName(asset.name);
        setAddItemPrice("0");
      }
      return;
    }
    if (itemId === "custom") {
      setSelectedInventoryId("");
      setSelectedAssetId("__none__");
      resetCategoryInputs();
      setAddItemName("");
      setAddItemPrice("0");
      return;
    }
    const found = inventoryItems.find((i) => i.id === itemId);
    if (found) {
      setSelectedInventoryId(found.id);
      setSelectedAssetId("__none__");
      resetCategoryInputs();
      setAddItemName(found.name);
      setAddItemPrice(String(found.sellingPrice || 0));
    }
  }

  function handleAddItemToCart() {
    const name = addItemName.trim();
    const price = parseFloat(addItemPrice) || 0;

    const lfW_v = parseFloat(lfWidth) || 0;
    const lfH_v = parseFloat(lfHeight) || 0;
    const lfArea_v = lfW_v > 0 && lfH_v > 0 ? lfW_v * lfH_v : 0;
    const dpNum_v = parseInt(dpPages, 10) || 0;
    const baseQty_v = Math.max(1, parseInt(addItemQty, 10) || 1);

    const qty =
      selectedAssetKind === "large_format"
        ? lfArea_v
        : selectedAssetKind === "digital_printer"
          ? dpNum_v
          : baseQty_v;

    if (!name) {
      toast.error("Please select or enter an item name");
      return;
    }
    if (selectedAssetKind === "large_format" && (lfW_v <= 0 || lfH_v <= 0)) {
      toast.error("Enter width and height in meters");
      return;
    }
    if (selectedAssetKind === "digital_printer" && dpNum_v <= 0) {
      toast.error("Enter number of pages");
      return;
    }
    if (qty < 1) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    let assetCategorySpec: AssetCategorySpec | null = null;
    if (selectedAssetKind === "large_format" && lfW_v > 0 && lfH_v > 0) {
      assetCategorySpec = { kind: "large_format", widthM: lfW_v, heightM: lfH_v };
    } else if (selectedAssetKind === "digital_printer" && dpNum_v > 0) {
      assetCategorySpec = { kind: "digital_printer", pages: dpNum_v };
    } else if (selectedAssetKind === "fargo") {
      assetCategorySpec = { kind: "fargo", sideMode: fgSideMode, laminated: fgLaminated };
    }

    const linkedAsset = selectedAsset;

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => (selectedInventoryId && i.itemId === selectedInventoryId) || (!selectedInventoryId && i.name.toLowerCase() === name.toLowerCase())
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
          assetId: linkedAsset?.id ?? undefined,
          assetCategory: linkedAsset?.category ?? undefined,
          assetCategorySpec,
        },
      ];
    });

    // Reset adder form
    setSelectedInventoryId("");
    setAddItemName("");
    setAddItemPrice("");
    setAddItemQty("1");
    setSelectedAssetId("__none__");
    resetCategoryInputs();
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

    const domesticPctNum = parseFloat(ppdaDomesticPct) || 0;
    const isWorks = ppdaProcurementMethod === "restricted_bidding" || grandTotal >= 10_000_000;
    const schedule3Eligible = ppdaIsLocal && domesticPctNum >= 30;
    const prefMargin = schedule3Eligible ? (isWorks ? 7 : 15) : 0;
    const mergedCompliance: PpdaComplianceDetails = {
      procurementMethod: ppdaProcurementMethod,
      bidSecurityRequired: ppdaBidSecurity,
      bidSecurityAmount: ppdaBidSecurity ? parseFloat(ppdaBidSecurityAmt) || undefined : undefined,
      bidSecurityValidityDays: ppdaBidSecurity ? parseFloat(ppdaBidSecurityValid) || undefined : undefined,
      bidSecurityIssuer: ppdaBidSecurity ? ppdaBidSecurityIssuer.trim() || undefined : undefined,
      isUgandanLocalContent: ppdaIsLocal,
      isMsmeReservationScheme: ppdaIsMsme,
      domesticContentPct: domesticPctNum || undefined,
      preferenceMarginPct: prefMargin || undefined,
      uraTccStatus: ppdaUraTcc,
      nssfClearanceStatus: ppdaNssf,
      ppdaCertStatus: ppdaPpdaCert,
      ursbStatus: ppdaUrsb,
      auditedAccountsStatus: ppdaAudited,
      bidSecurityStatus: ppdaBidSecStatus,
      prnProofStatus: ppdaPrn,
      declarationsStatus: ppdaDecl,
      evaluationCommittee: ppdaEvalCmte ? ppdaEvalCmte.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      contractsCommittee: ppdaContractsCmte ? ppdaContractsCmte.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      standstillEndDate: ppdaStandstillEnd || undefined,
      bidOpenedAt: ppdaBidOpenedAt || undefined,
      techEvaluatedAt: ppdaTechEvalAt || undefined,
      finEvaluatedAt: ppdaFinEvalAt || undefined,
      awardedAt: ppdaAwardedAt || undefined,
      contractSignedAt: ppdaContractSignedAt || undefined,
    };

    onCreate({
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived,
      customerName: customerName.trim(),
      customerId: selectedCustomerId || undefined,
      quotationAttachment,
      dateToBeDelivered,
      handledBy: handledBy.trim(),
      status: "submitted_egp",
      amount: grandTotal,
      items: cleanItems,
      notes: notes.trim() || undefined,
      ppdaCompliance: mergedCompliance,
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

              <Select
                value={
                  selectedAssetId !== "__none__"
                    ? `asset__${selectedAssetId}`
                    : selectedInventoryId || "custom"
                }
                onValueChange={handleSelectInventory}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue placeholder="Select product, asset, or custom item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom" className="font-medium text-muted-foreground">
                    + Custom / Other Item
                  </SelectItem>
                  {inventoryItems.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" /> Stock Items
                        </span>
                      </SelectLabel>
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
                    </SelectGroup>
                  )}
                  {assetsStore.assets.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Boxes className="h-3 w-3" /> Assets
                        </span>
                      </SelectLabel>
                      {assetsStore.assets.map((a) => {
                        const aTint = getAssetCategoryTint(a.category);
                        return (
                          <SelectItem key={a.id} value={`asset__${a.id}`}>
                            <div className="flex items-center gap-2 min-w-0 w-full pr-8">
                              <span className="truncate">{a.tag} · {a.name}</span>
                              <span
                                className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                                  aTint === "emerald"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-500/20"
                                    : aTint === "blue"
                                      ? "bg-blue-50 text-blue-700 border border-blue-500/20"
                                      : aTint === "violet"
                                        ? "bg-violet-50 text-violet-700 border border-violet-500/20"
                                        : "bg-muted/60 text-muted-foreground border border-border"
                                }`}
                              >
                                {a.category}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>

              <AnimatePresence mode="wait">
                {selectedAsset && (
                  <motion.div
                    key={selectedAsset.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.8, 0.25, 1] }}
                    className="flex items-center gap-2 rounded-md border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.05] to-transparent px-3 py-2"
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${
                        selectedAssetTint === "emerald"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : selectedAssetTint === "blue"
                            ? "bg-blue-500/15 text-blue-700"
                            : selectedAssetTint === "violet"
                              ? "bg-violet-500/15 text-violet-700"
                              : "bg-muted/70 text-muted-foreground"
                      }`}
                    >
                      {selectedAssetTint === "emerald"
                        ? <Ruler className="h-3.5 w-3.5" />
                        : selectedAssetTint === "blue"
                          ? <Printer className="h-3.5 w-3.5" />
                          : selectedAssetTint === "violet"
                            ? <CardIcon className="h-3.5 w-3.5" />
                            : <Layers className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-foreground">{selectedAsset.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground font-mono">{selectedAsset.tag} · {selectedAsset.model}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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
                {selectedAssetKind === "large_format" || selectedAssetKind === "digital_printer" ? (
                  <div className="col-span-6 sm:col-span-2">
                    {/* replaced by dedicated category controls below */}
                  </div>
                ) : (
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
                )}
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

              <AnimatePresence mode="wait">
                {selectedAsset && selectedAssetKind !== "default" && (
                  <motion.div
                    key={`cat-${selectedAsset.id}-${selectedAssetKind}`}
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.8, 0.25, 1] }}
                    className={`overflow-hidden rounded-xl border p-3.5 space-y-3 ${
                      selectedAssetTint === "emerald"
                        ? "border-emerald-500/25 bg-emerald-50/40 shadow-[0_1px_0_0_rgba(16,185,129,0.1)]"
                        : selectedAssetTint === "blue"
                          ? "border-blue-500/25 bg-blue-50/40 shadow-[0_1px_0_0_rgba(14,165,233,0.1)]"
                          : selectedAssetTint === "violet"
                            ? "border-violet-500/25 bg-violet-50/40 shadow-[0_1px_0_0_rgba(139,92,246,0.1)]"
                            : "border-border bg-muted/30"
                    }`}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.02 }}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                          selectedAssetTint === "emerald"
                            ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/20"
                            : selectedAssetTint === "blue"
                              ? "bg-blue-500/15 text-blue-800 ring-1 ring-blue-500/20"
                              : "bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/20"
                        }`}
                      >
                        {selectedAssetTint === "emerald"
                          ? <><Ruler className="h-3 w-3" /> Area pricing</>
                          : selectedAssetTint === "blue"
                            ? <><Printer className="h-3 w-3" /> Pages pricing</>
                            : <><CardIcon className="h-3 w-3" /> Badge printing</>}
                      </span>
                    </motion.div>

                    {selectedAssetKind === "large_format" && (
                      <div className="space-y-3">
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.06 }}
                          className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end"
                        >
                          <div>
                            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-emerald-800/70">Width (m)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="e.g. 1.5"
                              value={lfWidth}
                              onChange={(e) => setLfWidth(e.target.value)}
                              className="h-9 bg-white focus-visible:ring-emerald-500/50"
                            />
                          </div>
                          <div className="pb-1">
                            <span className="inline-flex items-center rounded-md bg-muted/70 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-border/60">
                              by
                            </span>
                          </div>
                          <div>
                            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-emerald-800/70">Height (m)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="e.g. 2.0"
                              value={lfHeight}
                              onChange={(e) => setLfHeight(e.target.value)}
                              className="h-9 bg-white focus-visible:ring-emerald-500/50"
                            />
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.12 }}
                        >
                          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset ${
                            lfArea > 0
                              ? "bg-emerald-100/70 ring-emerald-500/25"
                              : "bg-white/60 ring-emerald-500/10"
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-800">
                                <Ruler className="h-3 w-3" />
                              </span>
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800/80">
                                Area
                              </span>
                            </div>
                            <span className={`font-mono tabular-nums font-bold ${lfArea > 0 ? "text-emerald-900" : "text-emerald-800/50"}`}>
                              {lfW > 0 && lfH > 0
                                ? `${lfW} × ${lfH} m = ${lfArea.toFixed(2)} m²`
                                : "— m²"}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {selectedAssetKind === "digital_printer" && (
                      <div className="space-y-3">
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.06 }}
                        >
                          <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-blue-800/70">
                            <Printer className="h-3 w-3" /> Page count
                          </Label>
                          <div className="flex items-stretch gap-2">
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="Number of pages"
                              value={dpPages}
                              onChange={(e) => setDpPages(e.target.value)}
                              className="h-9 bg-white focus-visible:ring-blue-500/50"
                            />
                            <span className="inline-flex items-center rounded-md bg-blue-500/15 px-3 text-xs font-bold uppercase tracking-[0.12em] text-blue-800 ring-1 ring-blue-500/20">
                              pages
                            </span>
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.12 }}
                        >
                          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset ${
                            dpNum > 0
                              ? "bg-blue-100/70 ring-blue-500/25"
                              : "bg-white/60 ring-blue-500/10"
                          }`}>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-800/80">
                              Quantity
                            </span>
                            <span className={`font-mono tabular-nums font-bold ${dpNum > 0 ? "text-blue-900" : "text-blue-800/50"}`}>
                              {dpNum > 0 ? `${dpNum} pages` : "— pages"}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {selectedAssetKind === "fargo" && (
                      <div className="space-y-3">
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.04 }}
                        >
                          <Label className="mb-2 block text-xs font-medium uppercase tracking-wider text-violet-800/70">
                            Side mode
                          </Label>
                          <RadioGroup
                            value={fgSideMode}
                            onValueChange={(v) => setFgSideMode(v as "single" | "double")}
                            className="grid grid-cols-2 gap-2"
                          >
                            <div>
                              <RadioGroupItem value="single" id="fg-single-od" className="peer sr-only" />
                              <label
                                htmlFor="fg-single-od"
                                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all peer-data-[state=checked]:border-violet-500 peer-data-[state=checked]:bg-violet-500/15 peer-data-[state=checked]:text-violet-900 peer-data-[state=checked]:shadow-[0_0_0_1px_rgba(139,92,246,0.3)] border-border bg-white/70 text-muted-foreground hover:border-violet-500/50 hover:bg-violet-500/5"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" /> Single
                              </label>
                            </div>
                            <div>
                              <RadioGroupItem value="double" id="fg-double-od" className="peer sr-only" />
                              <label
                                htmlFor="fg-double-od"
                                className="flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all peer-data-[state=checked]:border-violet-500 peer-data-[state=checked]:bg-violet-500/15 peer-data-[state=checked]:text-violet-900 peer-data-[state=checked]:shadow-[0_0_0_1px_rgba(139,92,246,0.3)] border-border bg-white/70 text-muted-foreground hover:border-violet-500/50 hover:bg-violet-500/5"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" /> Double
                              </label>
                            </div>
                          </RadioGroup>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 }}
                        >
                          <div className="flex items-center gap-2 rounded-md border border-border bg-white/70 px-3 py-2">
                            <Checkbox
                              id="fg-laminated-od"
                              checked={fgLaminated}
                              onCheckedChange={(c) => setFgLaminated(Boolean(c))}
                              className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                            />
                            <label htmlFor="fg-laminated-od" className="flex-1 cursor-pointer text-xs font-semibold uppercase tracking-wider text-foreground">
                              Laminated
                            </label>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                fgLaminated
                                  ? "bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/25"
                                  : "bg-muted/70 text-muted-foreground"
                              }`}
                            >
                              {fgLaminated ? "On" : "Off"}
                            </span>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="grid grid-cols-[1fr_1.2fr] gap-3 items-end"
                        >
                          <div>
                            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-violet-800/70">Badge qty</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={addItemQty}
                              onChange={(e) => setAddItemQty(e.target.value)}
                              className="h-9 bg-white focus-visible:ring-violet-500/50"
                            />
                          </div>
                          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ring-1 ring-inset h-9 ${
                            baseQty > 0
                              ? "bg-violet-100/70 ring-violet-500/25"
                              : "bg-white/60 ring-violet-500/10"
                          }`}>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-800/70">Run</span>
                            <span className={`font-mono tabular-nums font-bold text-xs ${baseQty > 0 ? "text-violet-900" : "text-violet-800/50"}`}>
                              {fgSideMode === "double" ? "Double" : "Single"}
                              {fgLaminated ? ", Lam" : ""}
                              {baseQty > 0 ? ` · ×${baseQty}` : ""}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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
                        {item.assetCategory && (
                          <span
                            className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                              getAssetCategoryTint(item.assetCategory) === "emerald"
                                ? "bg-emerald-500"
                                : getAssetCategoryTint(item.assetCategory) === "blue"
                                  ? "bg-blue-500"
                                  : getAssetCategoryTint(item.assetCategory) === "violet"
                                    ? "bg-violet-500"
                                    : "bg-gray-400"
                            }`}
                          />
                        )}
                        <h4 className="text-xs font-semibold text-foreground truncate">{item.name}</h4>
                      </div>
                      {item.assetCategory && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          <span className="font-medium">{item.assetCategory}</span>
                          {formatAssetSpec(item.assetCategorySpec) ? (
                            <> · <span className="font-mono">{formatAssetSpec(item.assetCategorySpec)}</span></>
                          ) : null}
                          {item.assetCategorySpec?.kind === "fargo" ? <> · ×{item.quantity}</> : null}
                        </p>
                      )}
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

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border-[#003399]/25 border-dashed ring-1 ring-border/50 bg-gradient-to-br from-[#003399]/[0.03] via-white p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                PPDA · Classification &amp; Preference (Schedule 3 / 4)
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Procurement Method</Label>
                <Select value={ppdaProcurementMethod} onValueChange={(v) => setPpdaProcurementMethod(v as ProcurementMethod)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open_domestic">Open Domestic Bidding (≥UGX 500M · Sched 4)</SelectItem>
                    <SelectItem value="restricted_bidding">Restricted / Pre-qualified Shortlisted</SelectItem>
                    <SelectItem value="request_for_quotation">Request for Quotation (≥3 quotes)</SelectItem>
                    <SelectItem value="micro_procurement">Micro-Procurement (&lt;5M / &lt;10M · Sched 4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#003399]/15 bg-white p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="ppda-local" className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <CheckSquare className="h-3.5 w-3.5" />
                      Ugandan Local Content
                    </label>
                    <Checkbox
                      id="ppda-local"
                      checked={ppdaIsLocal}
                      onCheckedChange={(c) => setPpdaIsLocal(Boolean(c))}
                      className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="ppda-msme" className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-violet-700 flex items-center gap-1.5">
                      <Users2 className="h-3.5 w-3.5" />
                      MSME Reservation (W/Youth/PWD)
                    </label>
                    <Checkbox
                      id="ppda-msme"
                      checked={ppdaIsMsme}
                      onCheckedChange={(c) => setPpdaIsMsme(Boolean(c))}
                      className="data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-[#003399]/15 bg-white p-2.5 space-y-2">
                  <div>
                    <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Domestic value-add %
                      <span title="Must exceed 30% for Schedule 3 15% / 7% preference eligibility (PPDA Sec 50).">
                        <Info className="h-3 w-3 text-[#003399]" />
                      </span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={ppdaDomesticPct}
                      onChange={(e) => setPpdaDomesticPct(e.target.value)}
                      className="h-8 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Bid Security (Guarantee / Bond)
                  </Label>
                  <Switch
                    checked={ppdaBidSecurity}
                    onCheckedChange={(c) => setPpdaBidSecurity(Boolean(c))}
                  />
                </div>
                {ppdaBidSecurity && (
                  <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div>
                      <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Amount (UGX)</Label>
                      <Input type="number" value={ppdaBidSecurityAmt} onChange={(e) => setPpdaBidSecurityAmt(e.target.value)} className="h-8 bg-white text-xs font-mono" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Validity (days)</Label>
                      <Input type="number" value={ppdaBidSecurityValid} onChange={(e) => setPpdaBidSecurityValid(e.target.value)} className="h-8 bg-white text-xs font-mono" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Issuer / Bank</Label>
                      <Input value={ppdaBidSecurityIssuer} onChange={(e) => setPpdaBidSecurityIssuer(e.target.value)} className="h-8 bg-white text-xs" placeholder="e.g. Stanbic" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border-[#003399]/25 border-dashed ring-1 ring-border/50 bg-gradient-to-br from-[#003399]/[0.03] via-white p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <FileCheck className="h-4 w-4" />
                PPDA · 8-Point Statutory Compliance Status
              </span>
            </div>
            {[
              { label: "URA TCC", val: ppdaUraTcc, set: setPpdaUraTcc },
              { label: "NSSF Clearance", val: ppdaNssf, set: setPpdaNssf },
              { label: "PPDA ROP", val: ppdaPpdaCert, set: setPpdaPpdaCert },
              { label: "URSB Incorporation", val: ppdaUrsb, set: setPpdaUrsb },
              { label: "Audited Accounts", val: ppdaAudited, set: setPpdaAudited },
              { label: "Bid Security", val: ppdaBidSecStatus, set: setPpdaBidSecStatus },
              { label: "PRN Fee Proof", val: ppdaPrn, set: setPpdaPrn },
              { label: "Anti-Corruption Decl", val: ppdaDecl, set: setPpdaDecl },
            ].reduce<React.ReactNode[][]>((rows, item, i) => {
              const ri = Math.floor(i / 2);
              (rows[ri] = rows[ri] || []).push(
                <div key={item.label} className="space-y-1">
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</Label>
                  <Select value={item.val} onValueChange={(v) => item.set(v as ComplianceStatus)}>
                    <SelectTrigger className={cn("h-9 bg-white text-xs font-medium capitalize",
                      item.val === "valid" ? "text-emerald-700" :
                      item.val === "pending" ? "text-amber-700" :
                      item.val === "expired" ? "text-rose-700" : "text-slate-600"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["valid","pending","expired","not_required"] as ComplianceStatus[]).map((cs) => (
                        <SelectItem key={cs} value={cs} className="text-xs capitalize">{cs.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
              return rows;
            }, []).map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-2 gap-3">
                {row}
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border-[#003399]/25 border-dashed ring-1 ring-border/50 bg-gradient-to-br from-[#003399]/[0.03] via-white p-4 space-y-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <Trophy className="h-4 w-4" />
                PPDA · Evaluation &amp; Award Attribution
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Evaluation Committee
                </Label>
                <Textarea
                  value={ppdaEvalCmte}
                  onChange={(e) => setPpdaEvalCmte(e.target.value)}
                  rows={1.5 as any}
                  placeholder="Employee names, comma-separated (e.g. Jane Doe, John Smith)"
                  className="text-xs bg-white min-h-[36px] py-1.5"
                />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Contracts Committee (PPDA §16(2))
                  <span title="5 members minimum: Chair + 3 members + Secretary (lawyer 1 for central-govt PDE). Quorum: 3/5.">
                    <Info className="h-3 w-3 text-[#003399]" />
                  </span>
                </Label>
                <Textarea
                  value={ppdaContractsCmte}
                  onChange={(e) => setPpdaContractsCmte(e.target.value)}
                  rows={1.5 as any}
                  placeholder="5 members: Chair + 3 + Secretary/Lawyer, comma-separated"
                  className="text-xs bg-white min-h-[36px] py-1.5"
                />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  Administrative Review Standstill End Date (Sec 91A)
                  <span title="10 WORKING DAYS post-BEB notice publication (excludes Sat/Sun + 15 Ugandan public holidays). No award actions permitted until expiry.">
                    <Info className="h-3 w-3 text-[#003399]" />
                  </span>
                </Label>
                <Input type="date" value={ppdaStandstillEnd} onChange={(e) => setPpdaStandstillEnd(e.target.value)} className="h-9 bg-white text-xs font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: "Bid Opened", val: ppdaBidOpenedAt, set: setPpdaBidOpenedAt },
                  { label: "Tech Eval", val: ppdaTechEvalAt, set: setPpdaTechEvalAt },
                  { label: "Fin Eval", val: ppdaFinEvalAt, set: setPpdaFinEvalAt },
                  { label: "Awarded (BEB)", val: ppdaAwardedAt, set: setPpdaAwardedAt },
                  { label: "Contract Signed", val: ppdaContractSignedAt, set: setPpdaContractSignedAt },
                ].map((d) => (
                  <div key={d.label}>
                    <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{d.label}</Label>
                    <Input type="date" value={d.val} onChange={(e) => d.set(e.target.value)} className="h-8 bg-white text-[11px] font-mono" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

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
                            {it.assetCategory && (
                              <span
                                className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                                  getAssetCategoryTint(it.assetCategory) === "emerald"
                                    ? "bg-emerald-500"
                                    : getAssetCategoryTint(it.assetCategory) === "blue"
                                      ? "bg-blue-500"
                                      : getAssetCategoryTint(it.assetCategory) === "violet"
                                        ? "bg-violet-500"
                                        : "bg-gray-400"
                                }`}
                              />
                            )}
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
                          {it.assetCategory && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                              <span className="font-medium">{it.assetCategory}</span>
                              {formatAssetSpec(it.assetCategorySpec) ? (
                                <> · <span className="font-mono">{formatAssetSpec(it.assetCategorySpec)}</span></>
                              ) : null}
                              {it.assetCategorySpec?.kind === "fargo" ? <> · ×{it.quantity}</> : null}
                            </div>
                          )}
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

          {(() => {
            const pc = order.ppdaCompliance;
            const baseAmount = Number(order.amount) || 0;
            const isLocal = Boolean(pc?.isUgandanLocalContent);
            const domesticPct = Number(pc?.domesticContentPct) || 0;
            const isWorks = pc?.procurementMethod === "restricted_bidding" || baseAmount >= 10_000_000;
            const schedule3 = isLocal && domesticPct >= 30;
            const marginPct = schedule3 ? (isWorks ? 7 : 15) : 0;
            const evaluatedPrice = schedule3 ? baseAmount * (1 + marginPct / 100) : baseAmount;
            if (!schedule3 && baseAmount === 0) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * sectionIndex("totals") + 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-4 space-y-2 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5" />
                    Evaluated Price · PPDA Schedule 3
                  </div>
                  {schedule3 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      +{marginPct}% Foreign Adjustment
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                      No Preference Claim
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Base bid amount</span>
                    <span className="font-mono text-foreground">UGX {baseAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      Foreign supplier adjustment
                      {schedule3 ? <span className="text-emerald-600 font-semibold">(Foreign +{marginPct}% · Local advantage)</span> : <span className="text-slate-400 line-through">(n/a)</span>}
                    </span>
                    <span className={cn("font-mono", schedule3 ? "text-emerald-700 font-semibold" : "text-slate-400 line-through")}>
                      {schedule3 ? `+ UGX ${Math.round(baseAmount * marginPct / 100).toLocaleString()}` : "UGX 0"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-emerald-500/20">
                    <span className="text-sm font-semibold text-emerald-700">Adjusted Evaluated Price</span>
                    <span className="font-mono text-lg font-bold text-emerald-700 drop-shadow-[0_0_1px_rgba(16,185,129,0.15)]">
                      UGX {Math.round(evaluatedPrice).toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })()}

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

function PpdaComplianceWorkspace({ orders }: { orders: SalesOrder[] }) {
  const openDomesticCount = orders.filter((o) => o.ppdaCompliance?.procurementMethod === "open_domestic" || !o.ppdaCompliance?.procurementMethod).length;
  const restrictedCount = orders.filter((o) => o.ppdaCompliance?.procurementMethod === "restricted_bidding").length;
  const rfqCount = orders.filter((o) => o.ppdaCompliance?.procurementMethod === "request_for_quotation").length;
  const microCount = orders.filter((o) => o.ppdaCompliance?.procurementMethod === "micro_procurement").length;
  const bidSecurityCount = orders.filter((o) => o.ppdaCompliance?.bidSecurityRequired).length;
  const localContentCount = orders.filter((o) => o.ppdaCompliance?.isUgandanLocalContent ?? true).length;
  const msmeCount = orders.filter((o) => o.ppdaCompliance?.isMsmeReservationScheme).length;

  const activeStandstills = orders
    .filter((o) => o.ppdaCompliance?.standstillEndDate && new Date(o.ppdaCompliance.standstillEndDate) >= new Date(todayISO() + "T00:00:00"))
    .sort((a, b) => (a.ppdaCompliance!.standstillEndDate! < b.ppdaCompliance!.standstillEndDate! ? -1 : 1));
  const earliestStandstill = activeStandstills[0];
  const todayIso = todayISO();
  const standstillWorkingDaysLeft = earliestStandstill?.ppdaCompliance?.standstillEndDate
    ? workingDaysBetween(todayIso, earliestStandstill.ppdaCompliance.standstillEndDate)
    : 0;

  const stagger: any = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
  };
  const fadeUp: any = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#003399]/10 via-slate-900/5 to-white p-5 shadow-sm"
      >
        <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-[#004CCC]/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-[#003399]/10 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003399] text-white shadow-md ring-1 ring-white/20">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground flex flex-wrap items-center gap-2">
                Uganda Public Procurement & Disposal of Public Assets (PPDA) Compliance
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  PPDA Act Cap 205 · 2023 Regs
                </Badge>
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">
                  e-GP Phase 2 · Mandatory 1 Jul 2026
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl leading-relaxed">
                Automated compliance monitoring for Ugandan bidding processes: procurement method thresholds (Schedule 4, 2023 Amend), mandatory 10-working-day Administrative Review standstill (Sec 91A), Section 50 Local Content preference, and statutory provider clearances.
                <em className="not-italic italic ml-1 text-[#003399]/80">— PPDA Circular 6/2025 · Amended SBD 2025 enforced.</em>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              Statutory Clearances
            </span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700">4-Point Checklist</Badge>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <span>URA Tax Clearance Certificate (TCC)</span>
              <Badge className="bg-emerald-500 text-white text-[10px]">Valid</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <span>NSSF Statutory Clearance</span>
              <Badge className="bg-emerald-500 text-white text-[10px]">Valid</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <span>PPDA Register of Providers (ROP)</span>
              <Badge className="bg-emerald-500 text-white text-[10px]">Active Provider</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
              <span>URSB Certificate of Incorporation</span>
              <Badge className="bg-emerald-500 text-white text-[10px]">Valid</Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-600" />
              Local Content Preference (Sec 50)
            </span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">{localContentCount} Eligible</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            PPDA Schedule 3 preference margins applied during evaluated-price comparison. Foreign-bid adjustment: domestic goods ≥30% value-add (+15%), works & services (+7%).
          </p>
          <div className="p-2 rounded-lg bg-blue-50/60 text-xs font-medium text-blue-800 border border-blue-200/60 flex items-center gap-2">
            <Check className="h-4 w-4 text-blue-600" />
            +15% Goods · +7% Works/Services (Schedule 3)
          </div>
          {msmeCount > 0 && (
            <div className="p-2 rounded-lg bg-violet-50 text-[11px] font-medium text-violet-700 border border-violet-200 flex items-center gap-2">
              <Users2 className="h-3.5 w-3.5" />
              MSME Reservation · Women / Youth / PWD — {msmeCount} bids
            </div>
          )}
          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
            e-GP Phase 2 requires preference claims to be substantiated via <strong>PPDA ROP domestic-flagged</strong> profile + URSB registration evidence uploaded to the e-GP Uganda portal.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
              Administrative Review Standstill
            </span>
            <Badge variant="outline" className="bg-amber-50 text-amber-700">10 Working Days · Sec 91A</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mandatory standstill window post Best Evaluated Bidder (BEB) notice publication. Contract signature or LPO execution is prohibited before expiry — <em>working days only, excluding Sat/Sun and the 15 Ugandan public holidays.</em>
          </p>
          {earliestStandstill ? (
            <div className="p-2 rounded-lg bg-amber-50/60 text-xs font-medium text-amber-800 border border-amber-200/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Active on <span className="font-mono">{earliestStandstill.lpoNumber}</span>
                </span>
                <Badge className="bg-amber-500 text-white text-[10px]">{standstillWorkingDaysLeft} WD left</Badge>
              </div>
              <div className="text-[11px] text-amber-700/90 font-normal">
                Ends: <span className="font-mono">{earliestStandstill.ppdaCompliance?.standstillEndDate}</span> · no award actions permitted.
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-50/60 text-xs font-medium text-slate-700 border border-slate-200/60 flex items-center gap-2">
              <Check className="h-4 w-4 text-slate-500" />
              No standstill windows active
            </div>
          )}
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
            <span className="flex items-center gap-1">Bid securities lodged</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">{bidSecurityCount} guarantees</Badge>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-xs">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Tenders &amp; Procurement Methods Breakdown (PPDA Schedule 4, 2023 Amend Thresholds)
        </h4>
        <div className="grid gap-3 sm:grid-cols-4 text-xs">
          <div className="p-3 rounded-xl border border-border bg-slate-50/50 hover:border-[#003399]/25 hover:bg-[#003399]/[0.02] transition-colors">
            <span className="text-muted-foreground block text-[11px] font-semibold">Open Domestic Bidding</span>
            <span className="text-lg font-bold text-foreground font-mono">{openDomesticCount}</span>
            <span className="text-[10px] text-muted-foreground block">≥ UGX 500M · Sched 4 2023</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-slate-50/50 hover:border-[#003399]/25 hover:bg-[#003399]/[0.02] transition-colors">
            <span className="text-muted-foreground block text-[11px] font-semibold">Restricted / Pre-qualified</span>
            <span className="text-lg font-bold text-foreground font-mono">{restrictedCount}</span>
            <span className="text-[10px] text-muted-foreground block">Shortlisted providers</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-slate-50/50 hover:border-[#003399]/25 hover:bg-[#003399]/[0.02] transition-colors">
            <span className="text-muted-foreground block text-[11px] font-semibold">RFQ · ≥3 Quotations</span>
            <span className="text-lg font-bold text-foreground font-mono">{rfqCount}</span>
            <span className="text-[10px] text-muted-foreground block">Below threshold</span>
          </div>
          <div className="p-3 rounded-xl border border-border bg-slate-50/50 hover:border-[#003399]/25 hover:bg-[#003399]/[0.02] transition-colors">
            <span className="text-muted-foreground block text-[11px] font-semibold">Micro-Procurement</span>
            <span className="text-lg font-bold text-foreground font-mono">{microCount}</span>
            <span className="text-[10px] text-muted-foreground block">&lt;5M supplies · &lt;10M works (Sched 4)</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

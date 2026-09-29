import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/app/bids")({
  component: BidsPage,
  head: () => ({ meta: [{ title: "Bids & Tenders · Queenstech ERP" }] }),
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
            Decline Bid / Tender ({order.lpoNumber})
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for declining this bid from <span className="font-semibold text-foreground">{order.customerName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Decline Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State why this bid / tender is disqualified, withdrawn or declined (e.g., failed technical evaluation, missing PPDA clearances, pricing non-responsive, cancelled by procuring entity)..."
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

function BidsPage() {
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
  const [activeTab, setActiveTab] = useState<"pipeline" | "compliance" | "archive">("pipeline");
  const [formOpen, setFormOpen] = useState(false);
  const [lpoAccountFormOpen, setLpoAccountFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);
  const [lpoSideSheetOrder, setLpoSideSheetOrder] = useState<SalesOrder | null>(null);
  const [declineDialogTarget, setDeclineDialogTarget] = useState<SalesOrder | null>(null);

  const PIPELINE_STATUSES: OrderStatus[] = ["draft","advertised","submitted_egp","bid_opened","tech_eval","fin_eval","evaluated","contracts_cmte"];
  const ARCHIVE_STATUSES: OrderStatus[] = ["awarded","contract_signed","complete","declined"];

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
    if (orders.length > 0 && (activeTab === "compliance" || activeTab === "archive")) {
      loadAllDocuments();
    }
  }, [activeTab, orders.length, loadAllDocuments]);

  const pipelineOrders = useMemo(() => orders.filter((o) => PIPELINE_STATUSES.includes(o.status)), [orders, PIPELINE_STATUSES]);
  const archiveOrders = useMemo(() => orders.filter((o) => ARCHIVE_STATUSES.includes(o.status)), [orders, ARCHIVE_STATUSES]);

  const filtered = useMemo(() => {
    return pipelineOrders.filter((o) => {
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
  }, [pipelineOrders, query, statusFilter, overdueOnly]);

  const sections = ["hero", "kpis", "tabs", "pipeline", "compliance", "archive"];
  const sectionIndex = (key: string) => Math.max(0, sections.indexOf(key));

  const dashboardStats = useMemo(() => {
    const totalOrders = orders.length;
    const totalValue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const evalStages: OrderStatus[] = ["tech_eval", "fin_eval"];
    const evalCount = orders.filter((o) => evalStages.includes(o.status)).length;
    const evalValue = orders
      .filter((o) => evalStages.includes(o.status))
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const stagesInProgressCount = orders.filter((o) => PIPELINE_STATUSES.includes(o.status)).length;
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
      const isOpen = PIPELINE_STATUSES.includes(o.status);
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
  }, [orders, PIPELINE_STATUSES]);

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
        payload.declineReason = declineReason || "Declined without specified reason";
      }
      const updated = await updateOrder(id, payload);
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      if (previewOrder?.id === id) {
        setPreviewOrder(updated);
      }
      toast.success(status === "declined" ? "Bid marked as declined" : "Status updated");
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
      toast.success("Bid updated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update bid";
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
      toast.error("Admin access required to delete bids");
      return;
    }
    try {
      await deleteOrder(id);
      setOrders((current) => current.filter((o) => o.id !== id));
      toast.success("Bid removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove bid";
      toast.error(message);
    }
  }

  const canManageDocs = isAdmin || isManager;

  const pipelineCount = pipelineOrders.length;
  const awardedCount = orders.filter((o) => o.status === "awarded" || o.status === "contract_signed" || o.status === "complete").length;
  const declinedCount = orders.filter((o) => o.status === "declined").length;

  const tableRowVariants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
  };
  const tableStagger = {
    initial: {} as const,
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } } as const,
  };

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
              Bids &amp; PPDA Procurement Hub
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} new this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {(dashboardStats.totalOrders || 0).toLocaleString()} Bids &amp; Solicitations · UGX {(dashboardStats.totalValue || 0).toLocaleString()} total value
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {dashboardStats.submittedCount || 0} active bids under evaluation · UGX {(dashboardStats.submittedValue || 0).toLocaleString()} tendered · {dashboardStats.successfulCount || 0} awarded contracts · {dashboardStats.declinedCount || 0} disqualified
              {(dashboardStats.overdueCount || 0) > 0 && (
                <> · <span className="font-semibold text-amber-200">{dashboardStats.overdueCount} overdue</span></>
              )}
              {(dashboardStats.successfulThisMonth || 0) > 0 && (
                <> · <span className="text-emerald-200/90">{(dashboardStats.successfulThisMonth || 0).toLocaleString()} awarded this month</span></>
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
          label="Pipeline Stages"
          value={(dashboardStats.stagesInProgressCount || 0).toLocaleString()}
          icon={GripVertical}
          hint={(dashboardStats.stagesInProgressCount || 0) > 0 ? "Draft through Contracts Cmte" : "Pipeline idle"}
          tone="blue"
          onClick={() => {
            setActiveTab("compliance");
            setOverdueOnly(false);
          }}
        />
        <KpiCard
          label="Compliance Gaps"
          value={(dashboardStats.complianceGapCount || 0).toLocaleString()}
          icon={(dashboardStats.complianceGapCount || 0) > 0 ? ShieldAlert : ShieldCheck}
          hint={(dashboardStats.complianceGapCount || 0) > 0 ? `${dashboardStats.complianceGapCount} pending / expired items` : "All clear — statutory checklist complete"}
          tone={(dashboardStats.complianceGapCount || 0) > 0 ? "rose" : "emerald"}
          onClick={() => setActiveTab("compliance")}
        />
      </motion.section>

      {/* TAB BAR */}
      <motion.section
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * sectionIndex("tabs"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-md items-center rounded-full bg-muted/40 p-1 ring-1 ring-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
      >
        {(["pipeline", "compliance", "archive"] as const).map((t) => {
          const active = activeTab === t;
          const label =
            t === "pipeline" ? `Pipeline (${pipelineCount})`
            : t === "compliance" ? `PPDA Compliance`
            : `Awarded ${awardedCount} · Declined ${declinedCount}`;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className="relative flex-1 px-3.5 py-1.5 text-sm font-medium capitalize transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              {active && (
                <motion.span
                  layoutId="bids-tab-slider"
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

      {activeTab === "pipeline" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search LPO, procuring entity, quotation, handler…"
                className="bg-white pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STATUSES.map((s) => (
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
                  ? "Create your first bid from a procuring entity tender to get started."
                  : "Try a different search or stage filter."
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
                    <TableHead>Date Received</TableHead>
                    <TableHead>Procuring Entity</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Submission Deadline</TableHead>
                    <TableHead>Handled by</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="w-[96px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o, idx) => {
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

      {activeTab === "compliance" && (
        <div className="space-y-6">
          {(() => {
            const openOrders = pipelineOrders;
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
                            <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-[#003399]">Procuring Entity</TableHead>
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

      {activeTab === "archive" && (
        <ArchiveWorkspace
          orders={archiveOrders}
          documents={documents}
          customers={customers}
          employees={branchScopedEmployees}
          onPreview={(o) => setLpoSideSheetOrder(o)}
          onSwitchToDocuments={() => setActiveTab("compliance")}
          onCreateLpoAccount={() => setLpoAccountFormOpen(true)}
        />
      )}

      <DeclineReasonDialog
        order={declineDialogTarget}
        open={Boolean(declineDialogTarget)}
        onOpenChange={(open: boolean) => !open && setDeclineDialogTarget(null)}
        onConfirm={handleConfirmDecline}
      />

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

      <CreateTenderAccountSheet
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

type ArchiveWorkspaceProps = {
  orders: SalesOrder[];
  documents: SalesOrderDocument[];
  customers: Customer[];
  employees: Employee[];
  onPreview: (order: SalesOrder) => void;
  onSwitchToDocuments: () => void;
  onCreateLpoAccount: () => void;
};

function ArchiveWorkspace({
  orders,
  documents,
  onPreview,
  onSwitchToDocuments,
  onCreateLpoAccount,
}: ArchiveWorkspaceProps) {
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
  const archiveRowVariants = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
  };
  const archiveStagger = {
    initial: {} as const,
    animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } } as const,
  };

  const awardedCount = orders.filter((o) => o.status === "awarded" || o.status === "contract_signed" || o.status === "complete").length;
  const declinedCount = orders.filter((o) => o.status === "declined").length;
  const totalValue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);

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
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#003399]">
                <History className="h-3.5 w-3.5" />
                Bid &amp; Tender Archive
              </div>
              <h3 className="mt-0.5 text-base font-semibold text-foreground">
                Archive · Awarded &amp; Closed Bids
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                Finalised bids: awarded contracts, signed agreements, completed deliveries, and declined or disqualified submissions. Full compliance traceability at a glance.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <Button
              onClick={onCreateLpoAccount}
              size="sm"
              className="gap-1.5 bg-[#003399] text-white hover:bg-[#00297a] shadow-sm font-semibold transition-all active:scale-[0.98]"
              title="Create Tender Account"
            >
              <FilePlus className="h-4 w-4" />
              <span>Create Tender Account</span>
            </Button>
            <Button
              onClick={onSwitchToDocuments}
              variant="outline"
              className="gap-1.5 border-[#003399]/25 bg-[#003399]/5 text-[#003399] hover:bg-[#003399]/10"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Jump to Compliance
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
          { label: "Total Archived", value: orders.length.toString(), icon: FolderKanban, tone: "brand" as const },
          { label: "Total Value", value: `UGX ${(totalValue || 0).toLocaleString()}`, icon: DollarSign, tone: "blue" as const },
          { label: "Awarded", value: awardedCount.toString(), icon: Trophy, tone: "emerald" as const },
          { label: "Declined", value: declinedCount.toString(), icon: XCircle, tone: "rose" as const },
        ].map((s) => (
          <motion.div
            key={s.label}
            variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-3.5 shadow-sm transition-all duration-200 hover:shadow-[0_8px_26px_-12px_rgba(0,0,0,0.18)]",
              s.tone === "brand" && "border-[#003399]/15 bg-white hover:border-[#003399]/30",
              s.tone === "emerald" && "border-emerald-500/20 bg-white hover:border-emerald-500/40",
              s.tone === "blue" && "border-blue-500/20 bg-white hover:border-blue-500/40",
              s.tone === "rose" && "border-rose-500/20 bg-white hover:border-rose-500/40",
            )}
          >
            <div
              className={cn(
                "absolute -right-8 -top-8 h-20 w-20 rounded-full blur-2xl opacity-40 transition-opacity duration-300 group-hover:opacity-75",
                s.tone === "brand" && "bg-gradient-to-br from-[#003399] to-[#004CCC]",
                s.tone === "emerald" && "bg-gradient-to-br from-emerald-500 to-teal-500",
                s.tone === "blue" && "bg-gradient-to-br from-blue-500 to-indigo-500",
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
                  className="mt-1 text-xl font-semibold tracking-tight text-foreground"
                >
                  {s.value}
                </motion.div>
              </div>
              <span
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-[1.08]",
                  s.tone === "brand" && "bg-[#003399]/10 text-[#003399] ring-[#003399]/15 group-hover:bg-[#003399] group-hover:text-white group-hover:ring-[#003399]/30",
                  s.tone === "emerald" && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-500/30",
                  s.tone === "blue" && "bg-blue-500/10 text-blue-600 ring-blue-500/20 group-hover:bg-blue-500 group-hover:text-white group-hover:ring-blue-500/30",
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
            placeholder="Search LPO number, procuring entity, handler…"
            className="bg-white pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[170px] bg-white">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {(["awarded","contract_signed","complete","declined"] as OrderStatus[]).map((s) => (
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
          title="Create Tender Account"
        >
          <FilePlus className="h-4 w-4" />
          <span className="hidden sm:inline">New Tender Account</span>
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
          <span>LPO / Bid</span>
          <span>Procuring Entity</span>
          <span>Handled by</span>
          <span>Stage</span>
          <span>Dates</span>
          <span>Compliance</span>
          <span></span>
        </div>
        {sortedFiltered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No archived bids match this view"
            description="Clear your filters or create a new bid to populate the archive with awarded and closed tenders."
          />
        ) : (
          <motion.div
            variants={archiveStagger}
            initial="initial"
            animate="animate"
            className="divide-y divide-border/60"
          >
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
              const isDelivered = o.status === "awarded" || o.status === "contract_signed" || o.status === "complete";
              const deliveryIn = daysBetween(o.dateToBeDelivered, today);
              const leftStripe = isOverdue
                ? "shadow-[inset_3px_0_0_rgba(244,63,94,0.65)]"
                : isDelivered
                ? "shadow-[inset_3px_0_0_rgba(16,185,129,0.6)]"
                : "";
              return (
                <motion.div
                  key={o.id}
                  variants={archiveRowVariants}
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
                      <span>Received</span>
                      <span className="text-foreground">{o.dateReceived.slice(5)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] font-mono">
                      <span className="text-muted-foreground">Deadline</span>
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
                      {isDelivered ? "Closed" : isOverdue ? `${Math.abs(deliveryIn)}d overdue` : deliveryIn === 0 ? "Due today" : `${deliveryIn}d left`}
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
                      title="Preview tender bid"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#003399]" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  );
}

const DOCUMENT_CATALOG: (
  | { type: SalesDocumentType; title: string; description: string; icon: typeof FileText; category: "company" }
  | { type: SalesDocumentType; title: string; description: string; icon: typeof FileText; category: "procurement" }
)[] = [
  { type: "tcc_ura", title: "Tax Compliance Certificate (TCC)", description: "Current URA Tax Clearance / Compliance Certificate of the supplier.", icon: CheckCircle2, category: "company" },
  { type: "business_registration", title: "Certificate of Incorporation / Business Registration", description: "URSB registration (Company / Business Name certificate).", icon: Package, category: "company" },
  { type: "insurance_transit", title: "Insurance Certificate (Goods in Transit)", description: "Goods-in-transit / cargo insurance cover note — annual blanket or per-delivery.", icon: AlertTriangle, category: "company" },
  { type: "lpo_signed", title: "Signed LPO / Purchase Order", description: "Procuring entity-signed tender / bid copy (procurement instrument).", icon: ShoppingCart, category: "procurement" },
  { type: "supplier_quotation", title: "Supplier Quotation", description: "Original supplier quotation accepted by the procuring entity against this tender.", icon: FileText, category: "procurement" },
  { type: "tax_invoice_efris", title: "Tax Invoice (EFRIS compliant)", description: "URA e-invoice or validated EFRIS tax invoice against this tender.", icon: FileText, category: "procurement" },
  { type: "delivery_grn", title: "Delivery Note / Goods Received Note (GRN)", description: "Evidence of physical receipt with signature/acknowledgment from procuring entity.", icon: Truck, category: "procurement" },
  { type: "waybill_transport", title: "Waybill / Transport Document", description: "KCCA/URA transit waybill or 3rd-party carrier consignment note.", icon: TrendingUp, category: "procurement" },
  { type: "inspection_quality", title: "Inspection / Quality Report", description: "Goods inspection checklist or QA report where inspection is required.", icon: AlertCircle, category: "procurement" },
  { type: "payment_receipt", title: "Payment Confirmation / Receipt", description: "Proof of payment (receipt, bank slip, or acknowledgment slip).", icon: Download, category: "procurement" },
];

type DocCategory = "company" | "procurement";

const DOCUMENT_CATEGORY_META: Record<DocCategory, { label: string; chip: string; description: string; accent: string; icon: typeof FileText }> = {
  company: {
    label: "Company Documents",
    chip: "Supplier compliance (upload once, valid across tenders)",
    description: "Legal and compliance documents you hold as a registered Ugandan supplier. Upload once, they apply to every tender bid you submit.",
    accent: "from-sky-500/15 via-blue-600/10 to-indigo-600/10 ring-sky-500/20",
    icon: Building2,
  },
  procurement: {
    label: "Procurement Documents",
    chip: "Transactional (per-tender)",
    description: "Documents that are specific to this individual tender: the order itself, your quotation, tax invoice, delivery evidence, and payment proof.",
    accent: "from-emerald-500/15 via-teal-600/10 to-[#003399]/10 ring-emerald-500/20",
    icon: ClipboardList,
  },
};

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
                <p className="mt-0.5 text-xs text-white/80">Tender Account Preview &amp; Details</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
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
                  Procuring Entity
                </div>
                <div className="mt-1 font-semibold text-sm text-foreground truncate" title={order.customerName}>
                  {order.customerName}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {matchedCustomer ? matchedCustomer.type.toUpperCase() : "Procuring Entity Record"}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="text-[10.5px] font-medium text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-600" />
                  Bid Amount
                </div>
                <div className="mt-1 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400">
                  UGX {order.amount.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-emerald-600/80 mt-0.5">
                  {order.items?.length || 0} line items
                </div>
              </div>

              <div className={cn(
                "rounded-xl border p-3",
                isOverdue ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-slate-50/60"
              )}>
                <div className="text-[10.5px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  Submission Deadline
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

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-[#003399]" />
                  Section 2 · Required Document Names
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  List of documents selected for this tender account
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold bg-[#003399]/10 text-[#003399] border-[#003399]/25">
                {reqDocTypes.length} Selected
              </Badge>
            </div>

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [submissionDeadline, setSubmissionDeadline] = useState<string>("");
  const [handledBy, setHandledBy] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");

  const [companyAddress, setCompanyAddress] = useState<string>("");
  const [companyTin, setCompanyTin] = useState<string>("");
  const [companyLocation, setCompanyLocation] = useState<string>("");
  const [contactPersonName, setContactPersonName] = useState<string>("");
  const [contactPersonPhone, setContactPersonPhone] = useState<string>("");
  const [contactPersonEmail, setContactPersonEmail] = useState<string>("");

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
      toast.error("Please provide Tender Account #, Procuring Entity, Submission Deadline, and Staff in Charge");
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
        <div className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-md">
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <FilePlus className="h-5.5 w-5.5 text-white" />
              </span>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Create New Tender Account</h2>
                <p className="text-xs text-white/80">Configure tender account contract, required document checklist &amp; contact details</p>
              </div>
            </div>
          </div>

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
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tender Account # *</Label>
                  <Input
                    value={lpoNumber}
                    onChange={(e) => setLpoNumber(e.target.value)}
                    placeholder="e.g. LPO-2026-0001"
                    className="font-mono text-xs bg-slate-50"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Procuring Entity *</Label>
                  <Select value={selectedCustomerId} onValueChange={handleSelectCustomer}>
                    <SelectTrigger className="text-xs bg-slate-50">
                      <SelectValue placeholder="Select existing client or write custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">+ Write Custom Procuring Entity</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Procuring Entity Name *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter full registered procuring entity name..."
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Bid Amount (UGX)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      value={feeAmount}
                      onChange={(e) => setFeeAmount(e.target.value)}
                      placeholder="e.g. 5000000"
                      className="pl-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!valid}>
                  Create Bid Account
                </Button>
              </SheetFooter>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-2xl border border-[#003399]/20 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <Badge variant="outline" className="font-mono text-[10px] text-[#003399]">
                    {lpoNumber || "ACCOUNT-DRAFT"}
                  </Badge>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{companyName || "Procuring Entity Name"}</h3>
                  <p className="text-xs text-slate-500">{companyLocation || "Location not specified"}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Bid Amount</span>
                  <p className="font-mono text-sm font-bold text-[#003399]">
                    UGX {feeAmount ? Number(feeAmount).toLocaleString() : "0"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p><strong>Handled By:</strong> {handledBy || "Not assigned"}</p>
                <p><strong>Submission Deadline:</strong> {submissionDeadline || "Not set"}</p>
                <p><strong>Required Documents:</strong> {selectedDocs.length} items selected</p>
              </div>
            </div>
            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!valid}>
                Create Bid Account
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
                Uganda Public Procurement &amp; Disposal of Public Assets (PPDA) Compliance
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
            PPDA Schedule 3 preference margins applied during evaluated-price comparison. Foreign-bid adjustment: domestic goods ≥30% value-add (+15%), works &amp; services (+7%).
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
            Mandatory standstill window post Best Evaluated Bidder (BEB) notice publication. Contract signature or LPO execution is prohibited before expiry.
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
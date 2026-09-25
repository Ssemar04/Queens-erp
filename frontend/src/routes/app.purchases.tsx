import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Sparkles,
  TrendingUp,
  CreditCard,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { usePurchasesStore, fmtUGX, type Purchase } from "@/components/purchases/purchases-store";
import { PurchaseFormSheet } from "@/components/purchases/PurchaseFormSheet";
import { PurchaseDetailSheet } from "@/components/purchases/PurchaseDetailSheet";

export const Route = createFileRoute("/app/purchases")({
  component: PurchasesPage,
  head: () => ({ meta: [{ title: "Purchases · Queenstech ERP" }] }),
});

function PurchasesPage() {
  const store = usePurchasesStore();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [orderStatus, setOrderStatus] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const categories = useMemo(() => Array.from(new Set(store.purchases.map((p) => p.category))), [store.purchases]);

  const filtered = useMemo(() => {
    return store.purchases.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (paymentStatus !== "all" && p.paymentStatus !== paymentStatus) return false;
      if (orderStatus !== "all" && p.orderStatus !== orderStatus) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return [
          p.purchaseNumber,
          p.supplierName,
          p.category,
          p.itemsSummary,
          p.purchasedBy,
        ]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(s));
      }
      return true;
    });
  }, [store.purchases, q, category, paymentStatus, orderStatus]);

  if (!store.ready) return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;

  // Overview metrics
  const totalSpend = store.purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalPaid = store.purchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const totalOutstanding = Math.max(0, totalSpend - totalPaid);
  const receivedCount = store.purchases.filter((p) => p.orderStatus === "received").length;

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Hero section */}
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] -rotate-3">
              <ShoppingBag className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-emerald-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Truck className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Company Procurement
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {store.purchases.length.toLocaleString()} purchases · {fmtUGX(totalSpend)} total spend
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {fmtUGX(totalPaid)} paid · <span className="font-semibold text-amber-200">{fmtUGX(totalOutstanding)} outstanding balance</span> · {receivedCount} orders received
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              size="sm"
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" /> New purchase
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={ShoppingBag} label="Total Purchases" value={String(store.purchases.length)} sub={`${receivedCount} fulfilled`} />
        <Kpi icon={TrendingUp} label="Total Spend" value={fmtUGX(totalSpend)} sub="all time procurement" />
        <Kpi icon={CheckCircle2} label="Total Paid" value={fmtUGX(totalPaid)} tone="ok" sub="settled payments" />
        <Kpi icon={CreditCard} label="Outstanding Payables" value={fmtUGX(totalOutstanding)} tone={totalOutstanding > 0 ? "warn" : "ok"} sub="pending balance" />
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by PO#, supplier, category, items…"
            className="bg-white pl-8"
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All payments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>

        <Select value={orderStatus} onValueChange={setOrderStatus}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All order status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All order status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {store.purchases.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier & Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const balance = Math.max(0, p.totalAmount - p.paidAmount);
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setDetail(p)}
                >
                  <TableCell className="font-mono text-xs font-semibold">{p.purchaseNumber}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.supplierName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.itemsSummary || "No description"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.purchaseDate}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        p.orderStatus === "received" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                        p.orderStatus === "ordered" && "border-blue-200 bg-blue-50 text-blue-700",
                        p.orderStatus === "draft" && "border-slate-200 bg-slate-50 text-slate-700",
                        p.orderStatus === "cancelled" && "border-rose-200 bg-rose-50 text-rose-700",
                      )}
                    >
                      {p.orderStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        p.paymentStatus === "paid" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                        p.paymentStatus === "partially_paid" && "border-amber-200 bg-amber-50 text-amber-700",
                        p.paymentStatus === "unpaid" && "border-rose-200 bg-rose-50 text-rose-700",
                      )}
                    >
                      {p.paymentStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{fmtUGX(p.totalAmount)}</TableCell>
                  <TableCell className={cn("text-right font-mono text-sm font-medium", balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {fmtUGX(balance)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  No purchases found matching criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PurchaseFormSheet
        open={showForm}
        onOpenChange={setShowForm}
        initial={editing}
        onSubmit={store.addPurchase}
        onUpdate={store.updatePurchase}
      />

      <PurchaseDetailSheet
        open={detail !== null}
        onOpenChange={(v) => !v && setDetail(null)}
        purchase={detail}
        onEdit={(p) => {
          setEditing(p);
          setShowForm(true);
        }}
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon className={cn("h-4 w-4", tone === "warn" && "text-amber-600", tone === "ok" && "text-emerald-600")} />
      </div>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

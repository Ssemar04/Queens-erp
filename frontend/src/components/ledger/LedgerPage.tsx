import { useMemo, useState } from "react";
import {
  Plus, Search, Wallet, AlertTriangle, TrendingUp, Clock, Banknote,
  ArrowDownToLine, ArrowUpFromLine, Sparkles, Trash2, Calendar,
  Eye, CheckCircle2, FileText, Landmark, CreditCard, BadgeDollarSign, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ageDays, balance, bucket, nextReference, useLedger,
  type EntryStatus, type LedgerEntry, type LedgerKind,
} from "./ledger-store";
import { EntryFormSheet } from "./EntryFormSheet";
import { PaymentSheet } from "./PaymentSheet";

const STATUS_CLS: Record<EntryStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-500/10 text-blue-600",
  partial: "bg-amber-500/10 text-amber-600",
  paid: "bg-emerald-500/10 text-emerald-600",
  overdue: "bg-destructive/10 text-destructive",
  disputed: "bg-rose-500/10 text-rose-600",
};

const BUCKET_CLS: Record<ReturnType<typeof bucket>, string> = {
  current: "bg-emerald-500",
  "1-30": "bg-amber-400",
  "31-60": "bg-orange-500",
  "61-90": "bg-rose-500",
  "90+": "bg-red-600",
};

interface Props {
  kind: LedgerKind;
}

export function LedgerPage({ kind }: Props) {
  const { ready, entries, add, remove, pay } = useLedger(kind);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EntryStatus | "all">("all");
  const [bucketFilter, setBucketFilter] = useState<ReturnType<typeof bucket> | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [paying, setPaying] = useState<LedgerEntry | null>(null);
  const [previewing, setPreviewing] = useState<LedgerEntry | null>(null);

  const isDebtor = kind === "debtor";
  const titles = isDebtor
    ? { title: "Debtors", subtitle: "Money owed to you · Accounts receivable", action: "New invoice", entityNoun: "invoice" }
    : { title: "Creditors", subtitle: "Money you owe · Accounts payable", action: "New bill", entityNoun: "bill" };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (bucketFilter !== "all" && bucket(e) !== bucketFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        e.reference.toLowerCase().includes(q) ||
        e.partyName.toLowerCase().includes(q) ||
        (e.partyRef ?? "").toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [entries, query, statusFilter, bucketFilter]);

  const kpis = useMemo(() => {
    const open = entries.filter((e) => e.status !== "paid" && e.status !== "draft");
    const outstanding = open.reduce((s, e) => s + balance(e), 0);
    const overdue = open.filter((e) => ageDays(e) > 0);
    const overdueTotal = overdue.reduce((s, e) => s + balance(e), 0);
    const paidSum = entries.reduce((s, e) => s + e.paid, 0);
    const avgDays =
      open.length === 0 ? 0 : open.reduce((s, e) => s + Math.max(0, ageDays(e)), 0) / open.length;
    const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<
      ReturnType<typeof bucket>,
      number
    >;
    open.forEach((e) => {
      buckets[bucket(e)] += balance(e);
    });
    return { outstanding, overdueCount: overdue.length, overdueTotal, paidSum, avgDays, buckets };
  }, [entries]);

  const topRisks = useMemo(() => {
    return entries
      .filter((e) => e.status !== "paid" && ageDays(e) > 0)
      .sort((a, b) => balance(b) * (ageDays(b) + 1) - balance(a) * (ageDays(a) + 1))
      .slice(0, 3);
  }, [entries]);

  const newThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const iso = weekAgo.toISOString().slice(0, 10);
    return entries.filter((e) => (e.createdAt || "").slice(0, 10) >= iso).length;
  }, [entries]);

  const totalOpen = kpis.outstanding || 1;

  if (!ready) {
    return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;
  }

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));
  const HeroIcon = isDebtor ? ArrowDownToLine : ArrowUpFromLine;
  const HeroBadgeIcon = isDebtor ? FileText : Receipt;

  return (
    <div className="w-full min-w-0 space-y-6">
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
              <HeroIcon className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-amber-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <HeroBadgeIcon className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {isDebtor ? "Receivables hub" : "Payables hub"}
              {newThisWeek > 0 && (
                <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                  +{newThisWeek} this week
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {entries.length.toLocaleString()} {titles.entityNoun}s · UGX {kpis.outstanding.toLocaleString()} open
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {titles.subtitle}
              {kpis.overdueCount > 0 && (
                <> · <span className="font-semibold text-amber-200">{kpis.overdueCount} overdue · UGX {kpis.overdueTotal.toLocaleString()}</span></>
              )}
              {filtered.length !== entries.length && <> · showing {filtered.length} filtered</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" />
              {titles.action}
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label={isDebtor ? "Receivables" : "Payables"}
          value={`UGX ${kpis.outstanding.toLocaleString()}`}
          icon={isDebtor ? ArrowDownToLine : ArrowUpFromLine}
          accent={isDebtor ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"}
        />
        <Kpi
          label="Overdue"
          value={`UGX ${kpis.overdueTotal.toLocaleString()}`}
          sub={`${kpis.overdueCount} entries`}
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
        />
        <Kpi
          label={isDebtor ? "Collected" : "Settled"}
          value={`UGX ${kpis.paidSum.toLocaleString()}`}
          icon={Banknote}
          accent="bg-amber-500/10 text-amber-600"
        />
        <Kpi
          label={isDebtor ? "DSO" : "DPO"}
          value={`${Math.round(kpis.avgDays)} days`}
          sub={isDebtor ? "Days sales outstanding" : "Days payable outstanding"}
          icon={Clock}
          accent="bg-primary/10 text-primary"
        />
      </div>

      {/* Aging bar + Risk panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Aging bucket</h2>
            <span className="text-xs text-muted-foreground">Click a bucket to filter</span>
          </div>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {(["current", "1-30", "31-60", "61-90", "90+"] as const).map((b) => {
              const pct = (kpis.buckets[b] / totalOpen) * 100;
              if (pct <= 0) return null;
              return (
                <button
                  key={b}
                  onClick={() => setBucketFilter(bucketFilter === b ? "all" : b)}
                  style={{ width: `${pct}%` }}
                  className={cn("h-full transition-opacity hover:opacity-80", BUCKET_CLS[b])}
                  title={`${b} · UGX ${kpis.buckets[b].toLocaleString()}`}
                />
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {(["current", "1-30", "31-60", "61-90", "90+"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucketFilter(bucketFilter === b ? "all" : b)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-left transition-colors",
                  bucketFilter === b ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", BUCKET_CLS[b])} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{b}</span>
                </div>
                <div className="mt-1 font-mono text-xs">
                  UGX {(kpis.buckets[b] / 1000).toFixed(1)}K
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <h2 className="text-sm font-semibold">
              {isDebtor ? "Top collection priorities" : "Pay these first"}
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            {topRisks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing overdue. Smooth sailing.</p>
            ) : (
              topRisks.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setPaying(e)}
                  className="flex w-full items-start justify-between gap-2 rounded-lg border border-border bg-white p-2.5 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{e.partyName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{e.reference}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs">UGX {balance(e).toLocaleString()}</div>
                    <div className="text-[10px] text-destructive">{ageDays(e)}d late</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, party, tag…"
            className="bg-white pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as EntryStatus | "all")}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_CLS) as EntryStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {bucketFilter !== "all" && (
          <Button size="sm" variant="ghost" onClick={() => setBucketFilter("all")}>
            Clear bucket: {bucketFilter}
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={entries.length === 0 ? `No ${titles.entityNoun}s yet` : `No matching ${titles.entityNoun}s`}
          description={
            entries.length === 0
              ? `Add your first ${titles.entityNoun} to start tracking ${isDebtor ? "receivables" : "payables"}.`
              : "Adjust your filters or search."
          }
          actionLabel={entries.length === 0 ? titles.action : undefined}
          onAction={entries.length === 0 ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead>{isDebtor ? "Invoice" : "Bill"}</TableHead>
                <TableHead>{isDebtor ? "Customer" : "Supplier"}</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const age = ageDays(e);
                const b = bucket(e);
                const bal = balance(e);
                const progress = e.amount > 0 ? (e.paid / e.amount) * 100 : 0;
                return (
                  <TableRow key={e.id} className="group">
                    <TableCell>
                      <div className="font-mono text-xs font-medium">{e.reference}</div>
                      {e.partyRef && (
                        <div className="font-mono text-[10px] text-muted-foreground">{e.partyRef}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{e.partyName}</div>
                      {e.tags.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {e.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {e.issueDate}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{e.dueDate}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={cn("h-2 w-2 rounded-full", BUCKET_CLS[b])} />
                        {age > 0 ? `${age}d late` : age === 0 ? "due today" : `in ${-age}d`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {e.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono text-xs text-muted-foreground">
                        {e.paid.toLocaleString()}
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {bal.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border-0 capitalize", STATUS_CLS[e.status])}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 transition-all hover:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                          onClick={() => setPreviewing(e)}
                          title="Preview details"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </Button>
                        {e.status !== "paid" && e.status !== "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setPaying(e)}
                          >
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Pay
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={async () => {
                            try {
                              await remove(e.id);
                              toast.success(`${e.reference} removed`);
                            } catch {
                              toast.error(`Could not remove ${e.reference}`);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <EntryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={kind}
        nextRef={nextReference(kind, entries)}
        onCreate={async (entry) => {
          try {
            const created = await add(entry);
            toast.success(`${created.reference} created`);
            setFormOpen(false);
          } catch {
            toast.error(`Could not create ${titles.entityNoun}`);
          }
        }}
      />

      <PaymentSheet
        entry={paying}
        open={!!paying}
        onOpenChange={(v) => !v && setPaying(null)}
        onPay={async (id, payment) => {
          await pay(id, payment);
          toast.success(`UGX ${payment.amount.toLocaleString()} recorded`);
        }}
      />

      <EntryPreviewDialog
        entry={previewing}
        kind={kind}
        onOpenChange={(v) => !v && setPreviewing(null)}
        onRecordPayment={(entry) => {
          setPreviewing(null);
          setPaying(entry);
        }}
      />
    </div>
  );
}

function Kpi({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Wallet;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const METHOD_META: Record<string, { label: string; icon: typeof Wallet }> = {
  cash: { label: "Cash", icon: Banknote },
  mpesa: { label: "M-Pesa", icon: CreditCard },
  bank: { label: "Bank", icon: Landmark },
  cheque: { label: "Cheque", icon: BadgeDollarSign },
  card: { label: "Card", icon: CreditCard },
};

function EntryPreviewDialog({
  entry,
  kind,
  onOpenChange,
  onRecordPayment,
}: {
  entry: LedgerEntry | null;
  kind: LedgerKind;
  onOpenChange: (open: boolean) => void;
  onRecordPayment: (entry: LedgerEntry) => void;
}) {
  const open = Boolean(entry);
  if (!entry) return <Dialog open={open} onOpenChange={onOpenChange} />;

  const isDebtor = kind === "debtor";
  const bal = balance(entry);
  const progress = entry.amount > 0 ? Math.min(100, (entry.paid / entry.amount) * 100) : 0;
  const age = ageDays(entry);
  const b = bucket(entry);

  const sections = [
    "aging",
    "meta",
    "financials",
    entry.payments.length > 0 ? "payments" : null,
    entry.promiseToPay ? "promise" : null,
    entry.tags.length > 0 ? "tags" : null,
    entry.notes ? "notes" : null,
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,720px)] overflow-hidden p-0">
        {/* Header band */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`relative overflow-hidden px-6 py-5 pr-14 ${isDebtor ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white" : "bg-gradient-to-br from-blue-600 to-blue-700 text-white"}`}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -left-14 -bottom-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                {isDebtor ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-xl font-semibold tracking-wide">{entry.reference}</h2>
                  <Badge variant="outline" className="border-0 bg-white/10 text-white ring-1 ring-white/20 backdrop-blur capitalize">
                    {entry.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-white/75">
                  {isDebtor ? "Invoice · Accounts receivable" : "Bill · Accounts payable"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/70">Balance</div>
              <div className="font-mono text-2xl font-bold mt-0.5">UGX {bal.toLocaleString()}</div>
            </div>
          </div>
        </motion.div>

        {/* Scrollable content */}
        <div className="max-h-[calc(92vh-200px)] overflow-y-auto space-y-4 bg-muted/20 px-6 py-5">
          {/* Aging strip */}
          {sections.includes("aging") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("aging"), duration: 0.25 }}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", {
                    "bg-emerald-500/10 text-emerald-700": age <= 0,
                    "bg-amber-500/10 text-amber-700": age > 0 && age <= 30,
                    "bg-orange-500/10 text-orange-700": age > 30 && age <= 60,
                    "bg-rose-500/10 text-rose-700": age > 60 && age <= 90,
                    "bg-red-500/10 text-red-700": age > 90,
                  })}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", BUCKET_CLS[b])} />
                    Bucket: <span className="font-semibold capitalize">{b}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {age > 0 ? <span className="text-destructive font-medium">{age}d overdue</span> : age === 0 ? "Due today" : <span className="text-emerald-600 font-medium">In {-age}d</span>}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {progress.toFixed(0)}% {isDebtor ? "collected" : "settled"}
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
                  className={cn("h-full", progress >= 100 ? "bg-emerald-500" : bal === 0 ? "bg-emerald-500" : age > 60 ? "bg-rose-500" : age > 0 ? "bg-amber-500" : "bg-emerald-500")}
                />
              </div>
            </motion.div>
          )}

          {/* Meta grid */}
          {sections.includes("meta") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("meta"), duration: 0.25 }}
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              <div className="rounded-xl border border-border bg-white p-3.5 col-span-2 md:col-span-1 md:col-span-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {isDebtor ? <CreditCard className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                  {isDebtor ? "Customer" : "Supplier"}
                </div>
                <div className="mt-1.5 text-sm font-medium text-foreground truncate" title={entry.partyName}>
                  {entry.partyName}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Receipt className="h-3 w-3" />
                  Party ref
                </div>
                <div className="mt-1.5 text-sm font-mono text-foreground">
                  {entry.partyRef || "—"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Issue date
                </div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{entry.issueDate}</div>
              </div>
              <div className="rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Due date
                </div>
                <div className="mt-1.5 text-sm font-medium text-foreground">{entry.dueDate}</div>
              </div>
            </motion.div>
          )}

          {/* Financial summary */}
          {sections.includes("financials") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("financials"), duration: 0.25 }}
              className="rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</div>
                  <div className="mt-1 font-mono text-lg font-semibold text-foreground">UGX {entry.amount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {isDebtor ? "Paid" : "Settled"}
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-emerald-600">UGX {entry.paid.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {isDebtor ? "Outstanding" : "Owed"}
                  </div>
                  <div className={cn("mt-1 font-mono text-lg font-bold", bal > 0 ? (age > 30 ? "text-rose-600" : age > 0 ? "text-amber-600" : "text-emerald-700") : "text-emerald-600")}>
                    UGX {bal.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.9, delay: 0.18, ease: "easeOut" }}
                  className={cn("h-full", progress >= 100 ? "bg-emerald-500" : age > 60 ? "bg-rose-500" : age > 0 ? "bg-amber-500" : "bg-emerald-500")}
                />
              </div>
            </motion.div>
          )}

          {/* Payment timeline */}
          {sections.includes("payments") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("payments"), duration: 0.25 }}
              className="rounded-xl border border-border bg-white overflow-hidden"
            >
              <div className="border-b border-border bg-muted/40 px-4 py-2.5 flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Banknote className="h-3 w-3" />
                  Payment history
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{entry.payments.length} recorded</span>
              </div>
              {entry.payments.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm font-medium text-foreground">No payments recorded yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isDebtor ? "Record a payment from this customer to update the balance." : "Record a payment to this supplier to update the balance."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/80">
                  {[...entry.payments].reverse().map((p, idx) => {
                    const meta = METHOD_META[p.method] ?? { label: p.method, icon: Banknote };
                    const MethodIcon = meta.icon;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.04, duration: 0.22 }}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20">
                          <MethodIcon className="h-4 w-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground">{meta.label}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">· {p.date}</span>
                            </div>
                            <span className="font-mono text-sm font-semibold text-emerald-600 whitespace-nowrap">
                              − UGX {p.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {p.reference && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                                Ref: {p.reference}
                              </span>
                            )}
                            {p.note && (
                              <span className="text-muted-foreground truncate max-w-[380px]">{p.note}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Promise to pay */}
          {sections.includes("promise") && entry.promiseToPay && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("promise"), duration: 0.25 }}
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
                <Calendar className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                  {isDebtor ? "Promise to pay" : "Promise to settle"}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {isDebtor ? "Customer promised" : "You promised"} to settle by <span className="font-mono font-semibold">{entry.promiseToPay}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tags */}
          {sections.includes("tags") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("tags"), duration: 0.25 }}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Notes */}
          {sections.includes("notes") && entry.notes && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sections.indexOf("notes"), duration: 0.25 }}
              className="rounded-xl border border-border bg-white p-4"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                <FileText className="h-3 w-3" />
                Notes
              </div>
              <p className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                {entry.notes}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border bg-white px-6 py-3">
          <div className="text-xs text-muted-foreground font-mono">
            Created {entry.createdAt.slice(0, 10)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {bal > 0 && entry.status !== "draft" && entry.status !== "disputed" && (
              <Button
                size="sm"
                onClick={() => onRecordPayment(entry)}
                className={cn(isDebtor ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white")}
              >
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                {isDebtor ? "Record payment" : "Record settlement"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

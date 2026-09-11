import { useMemo, useState } from "react";
import {
  Plus, Search, Wallet, AlertTriangle, TrendingUp, Clock, Banknote,
  ArrowDownToLine, ArrowUpFromLine, Sparkles, Trash2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
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

  const totalOpen = kpis.outstanding || 1;

  if (!ready) {
    return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{titles.title}</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {entries.length} · {titles.subtitle}
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> {titles.action}
        </Button>
      </div>

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

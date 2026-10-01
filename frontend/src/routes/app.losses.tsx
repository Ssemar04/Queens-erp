import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Search, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRole } from "@/hooks/useRole";
import { getAssets, getItems } from "@/services/api";
import type { Item } from "@/types/inventory";
import { LossesTable } from "@/components/losses/LossesTable";
import { LossFormSheet, type AssetOption } from "@/components/losses/LossFormSheet";
import {
  LOSS_KIND_LABELS,
  LOSS_REASON_LABELS,
  LOSS_REASON_OPTIONS,
  LOSS_STATUS_LABELS,
  useLosses,
  type LossDraft,
  type LossKind,
  type LossReason,
  type LossRecord,
  type LossStatus,
} from "@/components/losses/loss-store";

export const Route = createFileRoute("/app/losses")({
  component: LossesPage,
  head: () => ({ meta: [{ title: "Losses · Queenstech ERP" }] }),
});

const ALL = "all";
const money = (n: number) => `UGX ${Math.round(Number(n) || 0).toLocaleString()}`;

function LossesPage() {
  const store = useLosses();
  const { isAdmin, isManager } = useRole();
  const canManage = isAdmin || isManager;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LossRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LossRecord | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<LossKind | typeof ALL>(ALL);
  const [reasonFilter, setReasonFilter] = useState<LossReason | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<LossStatus | typeof ALL>(ALL);

  useEffect(() => {
    getItems()
      .then((data) => { if (Array.isArray(data)) setItems(data); })
      .catch(() => {});
    getAssets()
      .then((data) => {
        if (Array.isArray(data)) setAssets(data.map((a) => ({ id: a.id, name: a.name, tag: a.tag })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleBranchChange = () => {
      getItems().then((data) => { if (Array.isArray(data)) setItems(data); }).catch(() => {});
      getAssets()
        .then((data) => { if (Array.isArray(data)) setAssets(data.map((a) => ({ id: a.id, name: a.name, tag: a.tag }))); })
        .catch(() => {});
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);
    return () => window.removeEventListener("qterp:branch-changed", handleBranchChange);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.losses.filter((l) => {
      if (kindFilter !== ALL && l.kind !== kindFilter) return false;
      if (reasonFilter !== ALL && l.reasonCode !== reasonFilter) return false;
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.reference, l.itemName, l.assetName, l.description, l.reportedBy]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [store.losses, search, kindFilter, reasonFilter, statusFilter]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (l: LossRecord) => { setEditing(l); setOpen(true); };

  const handleSubmit = async (data: LossDraft) => {
    if (editing) await store.update(editing.id, data);
    else await store.add(data);
  };

  if (!store.ready) return <div className="h-40 w-full animate-pulse rounded-2xl bg-muted/50" />;

  const stats = store.stats;

  return (
    <div className="w-full min-w-0 space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] p-6 text-white shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 md:block">
          <div className="relative">
            <div className="flex h-20 w-20 -rotate-3 items-center justify-center rounded-2xl bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-white/15 backdrop-blur">
              <AlertTriangle className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/90 text-[#111] shadow-lg">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Losses & damages register
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {stats.count.toLocaleString()} records · {money(stats.totalValue)} written off
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">
              {money(stats.thisMonthValue)} this month
              {stats.pending > 0 && <> · <span className="font-semibold text-amber-200">{stats.pending} pending review</span></>}
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
              <Button
                onClick={openNew}
                size="sm"
                className="gap-1.5 bg-white font-semibold text-[#003399] shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] transition-all hover:bg-white/95 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4 text-[#003399]" /> Record loss
              </Button>
            </div>
          )}
        </div>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total loss value" value={money(stats.totalValue)} />
        <StatCard label="This month" value={money(stats.thisMonthValue)} />
        <StatCard label="Records" value={String(stats.count)} />
        <StatCard label="Pending review" value={String(stats.pending)} accent={stats.pending > 0} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reference, item, asset, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterSelect value={kindFilter} onChange={(v) => setKindFilter(v as LossKind | typeof ALL)} label="All types">
          <SelectItem value={ALL}>All types</SelectItem>
          {(Object.keys(LOSS_KIND_LABELS) as LossKind[]).map((k) => (
            <SelectItem key={k} value={k}>{LOSS_KIND_LABELS[k]}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={reasonFilter} onChange={(v) => setReasonFilter(v as LossReason | typeof ALL)} label="All reasons">
          <SelectItem value={ALL}>All reasons</SelectItem>
          {LOSS_REASON_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as LossStatus | typeof ALL)} label="All statuses">
          <SelectItem value={ALL}>All statuses</SelectItem>
          {(Object.keys(LOSS_STATUS_LABELS) as LossStatus[]).map((s) => (
            <SelectItem key={s} value={s}>{LOSS_STATUS_LABELS[s]}</SelectItem>
          ))}
        </FilterSelect>
      </div>

      <LossesTable
        losses={filtered}
        canManage={canManage}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        onStatus={(l, status) => store.changeStatus(l.id, status)}
      />

      <LossFormSheet
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        items={items}
        assets={assets}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(v) => { if (!v) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the loss record
              {pendingDelete?.kind === "inventory" ? " and restores the written-off stock to inventory." : "."}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (pendingDelete) await store.remove(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={accent ? "mt-1 text-2xl font-bold text-amber-600" : "mt-1 text-2xl font-bold"}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[170px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

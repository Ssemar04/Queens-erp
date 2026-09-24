import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Boxes, Plus, Search, Gauge, Wrench, AlertTriangle, TrendingDown, Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAssetsStore, bookValue, currentMeter, serviceHealth, nextServiceDueDate, fmtKES, CATEGORY_COLOR, type Asset } from "@/components/assets/assets-store";
import { AssetFormSheet } from "@/components/assets/AssetFormSheet";
import { AssetDetailSheet } from "@/components/assets/AssetDetailSheet";

export const Route = createFileRoute("/app/assets")({
  component: AssetsPage,
  head: () => ({ meta: [{ title: "Assets · Queenstech ERP" }] }),
});

function AssetsPage() {
  const store = useAssetsStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [detail, setDetail] = useState<Asset | null>(null);

  const cats = useMemo(() => Array.from(new Set(store.assets.map((a) => a.category))), [store.assets]);

  const filtered = useMemo(() => store.assets.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (status !== "all" && a.status !== status) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return [a.name, a.tag, a.serialNumber, a.manufacturer, a.model, a.staff, a.assignedTo, a.location]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(s));
    }
    return true;
  }), [store.assets, q, cat, status]);

  if (!store.ready) return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  // KPI rollups
  const totalValue = store.assets.reduce((s, a) => s + a.purchaseCost, 0);
  const bookSum = store.assets.reduce((s, a) => s + bookValue(a), 0);
  const dueSoon = store.assets.filter((a) => ["due_soon", "overdue"].includes(serviceHealth(a).state));
  const inMaint = store.assets.filter((a) => a.status === "maintenance").length;
  const activeCount = store.assets.filter((a) => a.status === "active").length;

  // upcoming services
  const upcoming = store.assets
    .map((a) => ({ a, h: serviceHealth(a) }))
    .sort((x, y) => y.h.pressure - x.h.pressure)
    .slice(0, 5);

  // Category mix
  const byCat = Array.from(store.assets.reduce((m, a) => {
    m.set(a.category, (m.get(a.category) ?? 0) + bookValue(a));
    return m;
  }, new Map<string, number>()));
  const catMax = Math.max(1, ...byCat.map(([, v]) => v));

  return (
    <div className="w-full min-w-0 space-y-5">
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
              <Boxes className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-orange-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Assets hub
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {store.assets.length.toLocaleString()} assets · {fmtKES(bookSum)} book value
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              {activeCount} active · {fmtKES(totalValue)} original cost
              {dueSoon.length > 0 && <> · <span className="font-semibold text-amber-200">{dueSoon.length} service due{ dueSoon.length !== 1 ? "s" : "" }</span></>}
              {inMaint > 0 && <> · {inMaint} in maintenance</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              onClick={() => { setEditing(null); setShowForm(true); }}
              size="sm"
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all"
            >
              <Plus className="mr-1.5 h-4 w-4 text-[#003399]" /> New asset
            </Button>
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Boxes} label="Assets" value={String(store.assets.length)} sub={`${store.assets.filter((a) => a.status === "active").length} active`} />
        <Kpi icon={TrendingDown} label="Book value" value={fmtKES(bookSum)} sub={`of ${fmtKES(totalValue)} cost`} />
        <Kpi icon={Wrench} label="Service due" value={String(dueSoon.length)} sub={`${dueSoon.filter((a) => serviceHealth(a).state === "overdue").length} overdue`} tone={dueSoon.length ? "warn" : "ok"} />
        <Kpi icon={Activity} label="In maintenance" value={String(inMaint)} sub={`${((inMaint / Math.max(1, store.assets.length)) * 100).toFixed(0)}% of fleet`} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Upcoming service */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Service queue</h3>
              <p className="text-[11px] text-muted-foreground">Ranked by combined date + meter pressure</p>
            </div>
            <Badge variant="outline"><AlertTriangle className="mr-1 h-3 w-3" /> {dueSoon.length} need attention</Badge>
          </div>
          <div className="divide-y divide-border/60">
            {upcoming.map(({ a, h }) => (
              <button key={a.id} onClick={() => setDetail(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${CATEGORY_COLOR(a.category)}20`, color: CATEGORY_COLOR(a.category) }}>
                  <Wrench className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">{a.tag} · {a.location} · due {nextServiceDueDate(a) ?? "—"}</p>
                </div>
                <div className="w-40">
                  <Progress value={Math.min(100, h.pressure * 100)} className={cn("h-1.5", h.state === "overdue" && "[&>div]:bg-rose-600", h.state === "due_soon" && "[&>div]:bg-amber-500")} />
                  <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{(h.pressure * 100).toFixed(0)}%</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category mix */}
        <div className="overflow-hidden rounded-xl border border-border bg-white p-4">
          <h3 className="text-sm font-semibold">Value by category</h3>
          <p className="mb-3 text-[11px] text-muted-foreground">Book value distribution</p>
          <div className="space-y-2">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="flex items-center justify-between text-xs">
                  <span>{c}</span>
                  <span className="font-mono">{fmtKES(v)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(v / catMax) * 100}%`, background: CATEGORY_COLOR(c) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, tag, serial…" className="bg-white pl-8" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[170px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {store.assets.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>Asset</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-right">Meter</TableHead>
              <TableHead className="text-right">Book value</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => {
              const h = serviceHealth(a);
              return (
                <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetail(a)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${CATEGORY_COLOR(a.category)}20`, color: CATEGORY_COLOR(a.category) }}>
                        <Gauge className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{a.tag} · {a.category}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm"><div>{a.staff || a.assignedTo || "Unassigned"}</div></TableCell>
                  <TableCell className="text-right font-mono text-sm">{currentMeter(a).toLocaleString()} <span className="text-[10px] text-muted-foreground">{a.meterUnit}</span></TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtKES(bookValue(a))}</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <Progress value={Math.min(100, h.pressure * 100)} className={cn("h-1.5", h.state === "overdue" && "[&>div]:bg-rose-600", h.state === "due_soon" && "[&>div]:bg-amber-500")} />
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{h.state === "overdue" ? "Overdue" : h.state === "due_soon" ? `Due in ${h.daysToService ?? "?"}d` : "Healthy"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      a.status === "active" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                      a.status === "maintenance" && "border-amber-200 bg-amber-50 text-amber-700",
                      a.status === "idle" && "border-slate-200 bg-slate-50 text-slate-700",
                      a.status === "retired" && "border-rose-200 bg-rose-50 text-rose-700",
                    )}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setShowForm(true); }}>Edit</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No assets match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AssetFormSheet open={showForm} onOpenChange={setShowForm} initial={editing} onSubmit={store.addAsset} onUpdate={store.updateAsset} />
      <AssetDetailSheet open={detail !== null} onOpenChange={(v) => !v && setDetail(null)} asset={detail} onAddReading={store.addReading} onAddService={store.addService} onAddIncome={store.addIncome} onRemoveIncome={store.removeIncome} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: typeof Boxes; label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
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

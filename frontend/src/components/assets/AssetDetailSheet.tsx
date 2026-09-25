import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gauge, Wrench, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Activity, TrendingUp,
  Calendar, FileText, Plus, X, Package, Target, Beaker, Users, ArrowRightLeft, CircleDollarSign, History, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Asset, AssetIncome, AssetConsumable, AssetMonthlyTarget } from "./assets-store";
import { currentMeter, nextServiceDueDate, nextServiceDueMeter, serviceHealth, fmtKES } from "./assets-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
  onAddReading: (id: string, r: { date: string; value: number; recordedBy: string; note?: string }) => void;
  onAddService: (id: string, s: { date: string; type: "preventive" | "corrective" | "inspection" | "upgrade"; performedBy: string; cost: number; notes: string; nextDueDate?: string; nextDueMeter?: number }) => void;
  onAddIncome: (id: string, income: Omit<AssetIncome, "id" | "createdAt" | "updatedAt">) => Promise<unknown>;
  onRemoveIncome: (assetId: string, incomeId: string) => Promise<void>;
  onAddConsumable: (id: string, c: Omit<AssetConsumable, "id">) => AssetConsumable;
  onUpdateConsumable: (assetId: string, consumableId: string, patch: Partial<AssetConsumable>) => void;
  onRemoveConsumable: (assetId: string, consumableId: string) => void;
  onSetMonthlyTarget: (id: string, t: Omit<AssetMonthlyTarget, "id">) => void;
}

type RangePreset = "7d" | "30d" | "90d" | "year" | "all" | "custom";

export function AssetDetailSheet({ open, onOpenChange, asset, ...handlers }: Props) {
  if (!asset) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <Body asset={asset} {...handlers} />
      </SheetContent>
    </Sheet>
  );
}

function Body({
  asset, onAddReading, onAddService, onAddIncome, onRemoveIncome,
  onAddConsumable, onUpdateConsumable, onRemoveConsumable, onSetMonthlyTarget,
}: Omit<Props, "open" | "onOpenChange" | "asset"> & { asset: Asset }) {
  const health = useMemo(() => serviceHealth(asset), [asset]);
  const meter = currentMeter(asset);
  const dueDate = nextServiceDueDate(asset);
  const dueMeter = nextServiceDueMeter(asset);

  const { user } = useAuth();

  const monthly = useMemo(() => groupByMonth(asset.meterReadings), [asset.meterReadings]);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const thisMonthUsage = useMemo(() => monthly.find((m) => m.month === thisMonthKey)?.value ?? 0, [monthly, thisMonthKey]);
  const thisMonthTarget = useMemo(() => asset.monthlyTargets?.find((t) => t.period === thisMonthKey), [asset.monthlyTargets, thisMonthKey]);
  const replacementCount = (asset.consumables ?? []).length;
  const thisMonthIncome = useMemo(() => {
    const m = thisMonthKey;
    return (asset.income ?? []).reduce((s, i) => i.date.startsWith(m) ? s + Number(i.amount ?? 0) : s, 0);
  }, [asset.income, thisMonthKey]);
  const staffName = resolveStaffName(asset.staff || "", user);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{asset.tag}</span>
          <span>{asset.name}</span>
        </SheetTitle>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{asset.category}</Badge>
          <Badge variant="outline">Staff · {asset.staff || "Unassigned"}</Badge>
          <StatusChip status={asset.status} />
        </div>
      </SheetHeader>

      {/* Top KPI strip - 4 KPIs, Book Value + Age REMOVED */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <KPI icon={Gauge} label="Current meter" value={`${meter.toLocaleString()} ${asset.meterUnit}`} sub={`${thisMonthUsage.toLocaleString()} this month`} />
        <KPI icon={Wrench} label="Service health"
          value={health.state === "overdue" ? "Overdue" : health.state === "due_soon" ? "Due soon" : "Healthy"}
          sub={dueDate ? `Next: ${dueDate}` : "No history yet"}
          tone={health.state === "overdue" ? "danger" : health.state === "due_soon" ? "warn" : "ok"} />
        <KPI icon={Package} label="Replacements" value={`${replacementCount} log${replacementCount === 1 ? "" : "s"}`}
          sub={replacementCount === 0 ? "No refills yet" : `Latest · ${latestConsumableDate(asset.consumables)}`}
          tone={undefined} />
        <KPI icon={Target} label={thisMonthKey.replace("-", "/") + " income"}
          value={thisMonthTarget?.incomeTarget ? `${Math.min(100, Math.round((thisMonthIncome / thisMonthTarget.incomeTarget) * 100))}%` : "—"}
          sub={thisMonthTarget?.incomeTarget ? `${fmtKES(thisMonthIncome)} / ${fmtKES(thisMonthTarget.incomeTarget)}` : "Tap Targets tab to set"}
          tone={thisMonthTarget?.incomeTarget && (thisMonthIncome / thisMonthTarget.incomeTarget) >= 0.95 ? "ok" : undefined} />
      </div>

      {/* Service pressure gauge */}
      <div className="mt-3 rounded-xl border border-border bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Next service pressure</span>
          <span>{(Math.min(100, health.pressure * 100)).toFixed(0)}%</span>
        </div>
        <Progress value={Math.min(100, health.pressure * 100)} className={cn("h-2", health.state === "overdue" && "[&>div]:bg-rose-600", health.state === "due_soon" && "[&>div]:bg-amber-500")} />
        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{dueDate ? `Date due ${dueDate}` : "No prior service on file"}{health.daysToService != null ? ` · ${health.daysToService}d` : ""}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{dueMeter != null ? `Meter due ${dueMeter.toLocaleString()} ${asset.meterUnit}` : "Meter target not set"}{health.meterToService != null ? ` · ${health.meterToService.toLocaleString()} to go` : ""}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="readings" className="mt-4">
        <TabsList className="grid w-full grid-cols-5 rounded-xl bg-white p-1">
          <TabsTrigger value="readings" className="gap-1.5"><Gauge className="h-3.5 w-3.5" /> Readings</TabsTrigger>
          <TabsTrigger value="service" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Service</TabsTrigger>
          <TabsTrigger value="finance" className="gap-1.5"><CircleDollarSign className="h-3.5 w-3.5" /> Finance</TabsTrigger>
          <TabsTrigger value="consumables" className="gap-1.5"><Beaker className="h-3.5 w-3.5" /> Consumables</TabsTrigger>
          <TabsTrigger value="targets" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Target</TabsTrigger>
        </TabsList>

        <ReadingsTab asset={asset} onAddReading={onAddReading} monthly={monthly} staffName={staffName} />
        <ServiceTab asset={asset} onAddService={onAddService} />
        <FinanceTab asset={asset} />
        <ConsumablesTab asset={asset} onAdd={onAddConsumable} onRemove={onRemoveConsumable} staffName={staffName} />
        <TargetsTab asset={asset} onSetTarget={onSetMonthlyTarget} thisMonthKey={thisMonthKey} thisMonthIncome={thisMonthIncome} />
      </Tabs>
    </>
  );
}

/* ---------- READINGS TAB ---------- */
function ReadingsTab({ asset, onAddReading, monthly, staffName }: { asset: Asset; onAddReading: Props["onAddReading"]; monthly: { month: string; value: number }[]; staffName: string }) {
  const [r, setR] = useState({
    date: new Date().toISOString().slice(0, 10),
    current: 0,
    note: "",
  });

  const recentReading = useMemo(() => findPreviousReading(asset.meterReadings, r.date), [asset.meterReadings, r.date]);
  const dailyPages = useMemo(() => Math.max(0, Number(r.current || 0) - Number(recentReading?.value || 0)), [r.current, recentReading]);

  useEffect(() => {
    // No-op keeper. Reset logic happens only after submit.
  }, [asset.id]);

  function submitReading() {
    if (!r.current && r.current !== 0) {
      toast.error("Please enter current pages");
      return;
    }
    if (recentReading && Number(r.current) < Number(recentReading.value)) {
      toast.warning("Current value is below the prior day reading — verify before confirming");
    }
    const recordedBy = staffName || asset.staff || asset.assignedTo || "Auto";
    onAddReading(asset.id, { date: r.date, value: Number(r.current), recordedBy, note: r.note || undefined });
    toast.success(`Reading logged · credited to ${recordedBy}`);
    setR({ date: new Date().toISOString().slice(0, 10), current: 0, note: "" });
  }

  return (
    <TabsContent value="readings" className="mt-3 space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-white to-[#003399]/[0.03] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Daily meter reading</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80 max-w-md leading-relaxed">
                Enter today&apos;s closing meter. Yesterday&apos;s reading is looked up automatically, and staff is pulled from the signed-in session — no manual entry required.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {recentReading ? (
                <Badge variant="outline" className="bg-white border-[#003399]/20 text-[#003399]">
                  <History className="mr-1 h-3 w-3" /> Yesterday: <span className="ml-1 font-mono font-semibold">{recentReading.value.toLocaleString()}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-white text-muted-foreground">No prior day reading</Badge>
              )}
              {asset.meterUnit === "pages" && (
                <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                  Daily pages: <span className="ml-1 font-mono font-semibold">{dailyPages.toLocaleString()}</span>
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reading date</Label>
              <div className="mt-1 relative">
                <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} className="pl-9 bg-white" />
              </div>
            </div>

            <div className="md:col-span-4">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Current {asset.meterUnit}{" "}
                <span className="ml-0.5 font-normal normal-case text-muted-foreground/70">(close-of-day)</span>
              </Label>
              <div className="mt-1 relative">
                <Gauge className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#003399]/60" />
                <Input
                  type="number"
                  value={r.current || r.current === 0 ? r.current : ""}
                  onChange={(e) => setR({ ...r, current: Number(e.target.value) })}
                  placeholder={`Total ${asset.meterUnit} today`}
                  className="pl-9 bg-white font-mono text-base"
                  autoFocus
                />
              </div>
              {recentReading && (
                <p className="mt-1 text-[10px] text-muted-foreground/80 font-mono">
                  Diff = {Number(r.current || 0).toLocaleString()} − {recentReading.value.toLocaleString()} = <span className="font-semibold text-emerald-700">{dailyPages.toLocaleString()}</span>
                </p>
              )}
            </div>

            <div className="md:col-span-4">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Staff (auto)</span>
              </Label>
              <div className="mt-1 flex h-[38px] items-center rounded-lg border border-border bg-gradient-to-r from-muted/40 via-white to-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#003399]/10 text-[#003399]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span className="truncate font-medium">{staffName || "Signed-in user"}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">Locked</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/70 leading-snug">Populated from your session. Prevents mis-attribution and audit drift.</p>
            </div>

            <div className="md:col-span-8">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note (optional)</Label>
              <Input value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} placeholder="Jam resets, mode changes, shift handover…" className="mt-1 bg-white" />
            </div>

            <div className="flex items-end md:col-span-4">
              <Button
                onClick={submitReading}
                className="w-full gap-2 rounded-xl bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white shadow-[0_6px_18px_-6px_rgba(0,51,153,0.65)] hover:brightness-105 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <Zap className="h-4 w-4" /> Log {asset.meterUnit} reading
              </Button>
            </div>
          </div>
        </div>
      </div>
      <SparkBars data={monthly} unit={asset.meterUnit} />
      <ReadingsTable asset={asset} />
    </TabsContent>
  );
}

/* ---------- SERVICE TAB ---------- */
function ServiceTab({ asset, onAddService }: { asset: Asset; onAddService: Props["onAddService"] }) {
  const [s, setS] = useState({ date: new Date().toISOString().slice(0, 10), type: "preventive" as const, performedBy: asset.staff || "", cost: 0, notes: "" });

  function submitService() {
    if (s.cost && s.cost > 0 && !s.performedBy) {
      toast.error("Please specify performed by staff for expense sync");
      return;
    }
    onAddService(asset.id, s);
    toast.success(s.cost > 0 ? "Service logged · synced to expenses" : "Service logged");
    setS({ ...s, notes: "", cost: 0 });
  }

  return (
    <TabsContent value="service" className="mt-3 space-y-3">
      <div className="rounded-xl border border-border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Record service</p>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50/60 text-emerald-700 text-[10px]">
            <ArrowRightLeft className="mr-1 h-3 w-3" /> Amount auto-syncs to expenses
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} className="bg-white" />
          <Select value={s.type} onValueChange={(v) => setS({ ...s, type: v as typeof s.type })}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preventive">Preventive</SelectItem>
              <SelectItem value="corrective">Corrective</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="upgrade">Upgrade</SelectItem>
            </SelectContent>
          </Select>
          <Input value={s.performedBy} onChange={(e) => setS({ ...s, performedBy: e.target.value })} placeholder="Performed by (staff)" className="bg-white" />
          <Input type="number" value={s.cost || ""} onChange={(e) => setS({ ...s, cost: Number(e.target.value) })} placeholder="Amount (UGX)" className="bg-white font-mono" />
        </div>
        <Textarea className="mt-2 bg-white" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} placeholder="Notes / parts replaced…" />
        <div className="mt-2 flex justify-end">
          <Button onClick={submitService} className="gap-1.5">
            <Wrench className="h-4 w-4" /> Log service
          </Button>
        </div>
      </div>
      <ServiceTimeline asset={asset} />
    </TabsContent>
  );
}

/* ---------- FINANCE TAB ---------- */
function FinanceTab({ asset }: { asset: Asset }) {
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    if (preset !== "custom") {
      const r = presetDates(preset);
      setFrom(r.from ?? "");
      setTo(r.to ?? "");
    }
  }, [preset]);

  const filteredIncome = useMemo(() => {
    return (asset.income ?? []).filter((i) => {
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      return true;
    });
  }, [asset.income, from, to]);

  const totalIncome = useMemo(() => filteredIncome.reduce((s, x) => s + Number(x.amount ?? 0), 0), [filteredIncome]);
  const sparkData = useMemo(() => groupIncomeByMonth(filteredIncome), [filteredIncome]);

  return (
    <TabsContent value="finance" className="mt-3 space-y-3">
      <style>{`
        @keyframes barRise {
          from { transform: scaleY(0); transform-origin: bottom; opacity: 0.3; }
          to   { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
        }
      `}</style>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-50/50 via-white to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Income generated · auto-synced</p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-emerald-700">{fmtKES(totalIncome)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Badge variant="outline" className="bg-white/80 border-[#003399]/20 text-[#003399] text-[10px]">
                <Activity className="mr-1 h-3 w-3" /> {filteredIncome.length} {filteredIncome.length === 1 ? "entry" : "entries"}
              </Badge>
              <Badge variant="outline" className="bg-white/80 text-[10px]">Data pulled from sales records</Badge>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/90 leading-relaxed max-w-md">
              Income entries are synced automatically from invoiced sales linked to this asset. Manual recording is disabled for integrity.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    preset === p.key
                      ? "bg-white text-emerald-700 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(16,185,129,0.12)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="ml-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[130px] bg-white text-[11px]" />
                <span className="text-[11px]">→</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-[130px] bg-white text-[11px]" />
              </div>
            )}
          </div>

          <div className="rounded-xl bg-gradient-to-b from-emerald-50/40 to-white p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Monthly income trend</span>
              <span className="text-[10px] font-normal normal-case">last {sparkData.length} months</span>
            </div>
            {sparkData.some((d) => d.value > 0) ? (
              <IncomeSpark data={sparkData} />
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">No synced income in this period.</div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 bg-gradient-to-r from-white to-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Synced income records</p>
          </div>
          <span className="text-[10px] text-muted-foreground">Sorted by date · newest first</span>
        </div>
        {filteredIncome.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 mb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No synced income in this period</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">Entries appear automatically once sales are linked</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredIncome.slice().sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
              <div key={i.id} className="relative flex items-start justify-between gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-emerald-50/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-white border-emerald-100 text-emerald-700">{i.source || "—"}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{i.date}</span>
                    {i.reference && <span className="font-mono text-[10px] text-muted-foreground">#{i.reference}</span>}
                  </div>
                  {i.description && <p className="mt-0.5 truncate text-xs text-foreground/80">{i.description}</p>}
                  {i.recordedBy && <p className="text-[10px] text-muted-foreground/70">Posted by {i.recordedBy}</p>}
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700">{fmtKES(Number(i.amount ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );
}

/* ---------- CONSUMABLES TAB ---------- */
function ConsumablesTab({ asset, onAdd, onRemove, staffName }: {
  asset: Asset;
  onAdd: Props["onAddConsumable"];
  onRemove: Props["onRemoveConsumable"];
  staffName: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [n, setN] = useState<{ name: string; unit: string; dateReplaced: string; quantity: number; reason: string }>({
    name: "",
    unit: "pcs",
    dateReplaced: new Date().toISOString().slice(0, 10),
    quantity: 1,
    reason: "",
  });

  function submit() {
    if (!n.name.trim()) { toast.error("Consumable name is required"); return; }
    if (!n.unit.trim()) { toast.error("Unit is required"); return; }
    onAdd(asset.id, {
      name: n.name.trim(),
      unit: n.unit.trim(),
      dateReplaced: n.dateReplaced,
      quantity: Number(n.quantity) || 1,
      replacedBy: staffName || undefined,
      reason: n.reason.trim() || undefined,
    });
    toast.success(`Logged ${n.quantity} ${n.unit} of ${n.name}`);
    setN({ name: "", unit: "pcs", dateReplaced: new Date().toISOString().slice(0, 10), quantity: 1, reason: "" });
    setShowForm(false);
  }

  const list = useMemo(
    () => [...(asset.consumables ?? [])].sort((a, b) => b.dateReplaced.localeCompare(a.dateReplaced)),
    [asset.consumables],
  );

  const byName = useMemo(() => {
    const groups = new Map<string, { count: number; qty: number; last: string }>();
    for (const c of list) {
      const g = groups.get(c.name) ?? { count: 0, qty: 0, last: c.dateReplaced };
      g.count += 1;
      g.qty += Number(c.quantity ?? 1);
      if (c.dateReplaced > g.last) g.last = c.dateReplaced;
      groups.set(c.name, g);
    }
    return groups;
  }, [list]);

  return (
    <TabsContent value="consumables" className="mt-3 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consumables replacement log</p>
          <p className="text-[11px] text-muted-foreground max-w-lg leading-relaxed">
            Every time a consumable is refilled or replaced for this asset, log it here. Track name, unit of measure, and the date changed for procurement forecasting and maintenance reviews.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="gap-1.5 rounded-xl bg-gradient-to-br from-[#003399] to-[#004CCC] text-white shadow-sm hover:brightness-105 active:scale-[0.98] transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> {showForm ? "Close" : "Log replacement"}
        </Button>
      </div>

      {byName.size > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from(byName.entries()).slice(0, 4).map(([name, g]) => (
            <div key={name} className="rounded-xl border border-border bg-white px-3 py-2 transition-all duration-200 hover:border-[#003399]/20 hover:shadow-sm">
              <p className="truncate text-[11px] font-medium text-[#003399]">{name}</p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-lg font-bold tabular-nums">{g.qty.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">total · {g.count}x</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80">Last {g.last}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="overflow-hidden rounded-2xl border border-dashed border-[#003399]/25 bg-gradient-to-br from-[#003399]/[0.04] via-white to-transparent p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="col-span-2 md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Beaker className="h-3 w-3" /> Consumable name</span>
              </Label>
              <Input className="mt-1 bg-white" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} placeholder="Toner 12A, A4 paper, Fuel…" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit</Label>
              <Select value={["pcs", "L", "kg", "ream", "cartridge", "unit"].includes(n.unit) ? n.unit : "custom"}
                onValueChange={(v) => v !== "custom" && setN({ ...n, unit: v })}
              >
                <SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="L">Litres (L)</SelectItem>
                  <SelectItem value="kg">Kilograms (kg)</SelectItem>
                  <SelectItem value="ream">Ream (500 sheets)</SelectItem>
                  <SelectItem value="cartridge">Cartridge</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="custom">+ Custom unit</SelectItem>
                </SelectContent>
              </Select>
              {!["pcs", "L", "kg", "ream", "cartridge", "unit"].includes(n.unit) && (
                <Input className="mt-1 bg-white text-xs" placeholder="Type unit…" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} />
              )}
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date replaced</Label>
              <Input type="date" className="mt-1 bg-white" value={n.dateReplaced} onChange={(e) => setN({ ...n, dateReplaced: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity</Label>
              <Input type="number" className="mt-1 bg-white font-mono" value={n.quantity || ""} onChange={(e) => setN({ ...n, quantity: Number(e.target.value) })} min={1} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Replaced by (auto)</span>
              </Label>
              <div className="mt-1 flex h-[38px] items-center truncate rounded-lg border border-border bg-gradient-to-r from-muted/40 via-white to-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] text-[13px]">
                <span className="truncate">{staffName || "Signed-in user"}</span>
                <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground/70">Locked</span>
              </div>
            </div>
            <div className="col-span-2 md:col-span-6">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason / notes (optional)</Label>
              <Input className="mt-1 bg-white" value={n.reason} onChange={(e) => setN({ ...n, reason: e.target.value })} placeholder="Scheduled refill, breakdown, customer job…" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} className="gap-1.5 rounded-xl bg-gradient-to-br from-[#003399] to-[#004CCC] text-white shadow-sm hover:brightness-105 active:scale-[0.98] transition-all">
              <Package className="h-3.5 w-3.5" /> Save refill entry
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 mb-2">
            <Beaker className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No replacement history yet</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">Log a consumable refill to populate the trail</p>
        </div>
      ) : (
        <ol className="relative rounded-2xl border border-border bg-white p-2 pl-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {list.map((c, i) => (
            <li key={c.id} className="group relative flex gap-3 py-2.5 pl-14 pr-4 transition-all duration-200 hover:bg-[#003399]/[0.02]">
              <span className="absolute left-4 top-6 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,51,153,0.3)] bg-[#003399]" />
              <span className="absolute left-[22px] top-8 bottom-0 w-px bg-gradient-to-b from-[#003399]/30 via-border to-transparent" style={{ display: i === list.length - 1 ? "none" : undefined }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <Badge variant="outline" className="border-[#003399]/20 bg-[#003399]/5 text-[#003399] text-[10px]">
                    <Package className="mr-1 h-2.5 w-2.5" /> {c.quantity.toLocaleString()} {c.unit}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{c.dateReplaced}</Badge>
                  {c.replacedBy && (
                    <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-700">
                      <Users className="mr-1 h-2.5 w-2.5" /> {c.replacedBy}
                    </Badge>
                  )}
                </div>
                {c.reason && <p className="mt-0.5 text-[11px] text-muted-foreground/90 leading-relaxed">{c.reason}</p>}
              </div>
              <button
                onClick={() => { onRemove(asset.id, c.id); toast.success("Entry removed"); }}
                className="self-start rounded-lg p-1.5 text-muted-foreground/30 opacity-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                title="Remove this log entry"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </TabsContent>
  );
}

/* ---------- TARGETS TAB ---------- */
function TargetsTab({ asset, onSetTarget, thisMonthKey, thisMonthIncome }: {
  asset: Asset;
  onSetTarget: Props["onSetMonthlyTarget"];
  thisMonthKey: string;
  thisMonthIncome: number;
}) {
  const targets = asset.monthlyTargets ?? [];
  const thisMonthT = targets.find((t) => t.period === thisMonthKey);

  const [period, setPeriod] = useState<string>(thisMonthKey);
  const [incomeTarget, setIncomeTarget] = useState<number>(thisMonthT?.incomeTarget ?? 0);

  useEffect(() => {
    const t = targets.find((x) => x.period === period);
    setIncomeTarget(t?.incomeTarget ?? 0);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    onSetTarget(asset.id, { period, incomeTarget: incomeTarget || undefined });
    toast.success(`Income target updated for ${period}`);
  }

  const last6Periods = useMemo(() => {
    const arr: { period: string; incomeActual: number; incomeTarget?: number }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const periodIncome = (asset.income ?? []).reduce((s, inc) => inc.date.startsWith(key) ? s + Number(inc.amount ?? 0) : s, 0);
      const tgt = targets.find((t) => t.period === key);
      arr.push({ period: key, incomeActual: periodIncome, incomeTarget: tgt?.incomeTarget });
    }
    return arr;
  }, [targets, asset.income]);

  return (
    <TabsContent value="targets" className="mt-3 space-y-3">
      <style>{`
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.0); }
          50%     { box-shadow: 0 0 0 6px rgba(16,185,129,0.08); }
        }
        @keyframes targetFlip {
          from { transform: translateY(-4px) scale(0.98); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399]/5 via-white to-emerald-50/40 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#003399]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003399] to-[#004CCC] text-white shadow-[0_8px_18px_-8px_rgba(0,51,153,0.6)]">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#003399]/80">{thisMonthKey.replace("-", " / ")} · Income target</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed max-w-sm">Set the monthly revenue goal for this asset. Progress is auto-calculated from synced sales entries and is non-editable.</p>
            </div>
          </div>

          <div
            className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50 px-4 py-3 min-w-[200px] shadow-sm"
            style={{ animation: "targetFlip 400ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <p className="text-[10px] uppercase tracking-widest text-emerald-700/80">Progress</p>
            <div className="mt-0.5 flex items-baseline gap-1">
              <p className="font-mono text-2xl font-bold tabular-nums text-emerald-700">
                {thisMonthT?.incomeTarget ? `${Math.min(999, Math.round((thisMonthIncome / thisMonthT.incomeTarget) * 100))}%` : "—"}
              </p>
              {thisMonthT?.incomeTarget && (thisMonthIncome / thisMonthT.incomeTarget) >= 1 && (
                <Badge variant="outline" className="animate-[glowPulse_2.4s_ease-in-out_infinite] border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Target hit
                </Badge>
              )}
            </div>
            <div className="mt-2">
              <Progress
                value={thisMonthT?.incomeTarget ? Math.min(100, (thisMonthIncome / thisMonthT.incomeTarget) * 100) : 0}
                className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:via-emerald-400 [&>div]:to-[#10b981]"
              />
            </div>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {fmtKES(thisMonthIncome)} <span className="text-muted-foreground/60">/</span> {thisMonthT?.incomeTarget ? fmtKES(thisMonthT.incomeTarget) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/10 to-[#003399]/10">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Set monthly income target</p>
            <p className="text-[11px] text-muted-foreground">Choose any period and enter the target revenue (UGX).</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Period (YYYY-MM)</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 bg-white" />
          </div>
          <div className="md:col-span-6">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CircleDollarSign className="h-3 w-3 text-emerald-600" /> Income target (UGX)</span>
            </Label>
            <Input
              type="number"
              className="mt-1 bg-white font-mono text-base"
              value={incomeTarget || ""}
              onChange={(e) => setIncomeTarget(Number(e.target.value))}
              placeholder="e.g. 5000000"
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[1_000_000, 2_500_000, 5_000_000, 10_000_000].map((v) => (
                <button
                  key={v}
                  onClick={() => setIncomeTarget(v)}
                  className="rounded-md border border-border bg-white px-2 py-0.5 text-[10px] font-mono text-muted-foreground transition-all hover:border-[#003399]/30 hover:bg-[#003399]/5 hover:text-[#003399]"
                >
                  {fmtKES(v)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end md:col-span-3">
            <Button
              onClick={save}
              className="w-full gap-1.5 rounded-xl bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white shadow-[0_6px_18px_-6px_rgba(0,51,153,0.55)] hover:brightness-105 active:scale-[0.98] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              <Target className="h-3.5 w-3.5" /> Save target
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#003399]/10 text-[#003399]">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">6-month income vs target</p>
          </div>
          <p className="text-[10px] text-muted-foreground">Actuals are pulled from sales</p>
        </div>
        <div className="space-y-2.5">
          {last6Periods.map((p) => {
            const pct = p.incomeTarget ? Math.min(100, (p.incomeActual / p.incomeTarget) * 100) : 0;
            const tone = p.incomeTarget
              ? pct >= 100 ? "emerald" : pct >= 75 ? "blue" : "amber"
              : "slate";
            return (
              <div key={p.period} className="group">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-medium text-muted-foreground">{p.period.replace("-", " / ")}</span>
                  <span className="font-mono tabular-nums">
                    <span className="font-semibold">{fmtKES(p.incomeActual)}</span>
                    {p.incomeTarget
                      ? <> <span className="text-muted-foreground/60">·</span> <span className="text-muted-foreground">target {fmtKES(p.incomeTarget)}</span> <span className={cn("ml-2 font-semibold", tone === "emerald" && "text-emerald-600", tone === "blue" && "text-[#003399]", tone === "amber" && "text-amber-600")}>{pct.toFixed(0)}%</span> </>
                      : <span className="ml-2 text-muted-foreground/70 italic">no target set</span>}
                  </span>
                </div>
                <div className="mt-1 relative h-2.5 overflow-hidden rounded-full bg-muted/60">
                  {p.incomeTarget && (
                    <div
                      className={cn(
                        "absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        tone === "emerald" && "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]",
                        tone === "blue" && "bg-gradient-to-r from-[#003399] via-[#004CCC] to-[#003399] shadow-[0_0_0_1px_rgba(0,51,153,0.18)]",
                        tone === "amber" && "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]",
                      )}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TabsContent>
  );
}

/* ---------- Shared helpers / components ---------- */
function StatusChip({ status }: { status: Asset["status"] }) {
  const map: Record<Asset["status"], { l: string; c: string; Icon: typeof CheckCircle2 }> = {
    active: { l: "Active", c: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    idle: { l: "Idle", c: "bg-slate-50 text-slate-600 border-slate-200", Icon: Clock },
    maintenance: { l: "Maintenance", c: "bg-amber-50 text-amber-700 border-amber-200", Icon: Wrench },
    retired: { l: "Retired", c: "bg-rose-50 text-rose-700 border-rose-200", Icon: ShieldAlert },
  };
  const m = map[status];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", m.c)}><m.Icon className="h-3 w-3" /> {m.l}</span>;
}

function KPI({ icon: Icon, label, value, sub, tone }: { icon: typeof Gauge; label: string; value: string; sub?: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 transition-all duration-200 hover:shadow-[0_4px_14px_-6px_rgba(0,51,153,0.15)] hover:border-[#003399]/20">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon className={cn("h-3.5 w-3.5", tone === "danger" && "text-rose-600", tone === "warn" && "text-amber-600", tone === "ok" && "text-emerald-600")} />
      </div>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground/90">{sub}</p>}
    </div>
  );
}

function groupByMonth(rs: Asset["meterReadings"]) {
  const map = new Map<string, number>();
  const sorted = [...rs].sort((a, b) => a.date.localeCompare(b.date));
  let prev: number | null = null;
  for (const r of sorted) {
    const m = r.date.slice(0, 7);
    const usage = prev != null ? Math.max(0, r.value - prev) : 0;
    map.set(m, (map.get(m) ?? 0) + usage);
    prev = r.value;
  }
  return Array.from(map.entries()).slice(-12).map(([m, v]) => ({ month: m, value: v }));
}

function SparkBars({ data, unit }: { data: { month: string; value: number }[]; unit: string }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage trend ({unit})</p>
      <div className="flex h-24 items-end gap-1">
        {data.map((d) => (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t bg-gradient-to-t from-[#003399] to-[#004CCC]/70 shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-all duration-300 hover:from-[#002673] hover:to-[#003399]" style={{ height: `${(d.value / max) * 100}%` }} title={`${d.month}: ${d.value.toLocaleString()}`} />
            <span className="text-[9px] text-muted-foreground">{d.month.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingsTable({ asset }: { asset: Asset }) {
  const sorted = [...asset.meterReadings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent readings</div>
      {sorted.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No readings yet.</p> : sorted.map((r, i) => {
        const prev = sorted[i + 1];
        const delta = prev ? r.value - prev.value : 0;
        return (
          <div key={r.id} className="flex items-center justify-between border-b border-border/50 px-3 py-2 text-sm last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{r.date} · </span>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-[10px]">{r.recordedBy || "Staff"}</Badge>
            </div>
            <span className="font-mono">{r.value.toLocaleString()} {asset.meterUnit} {delta > 0 && <span className="ml-1 text-[11px] text-emerald-600">+{delta}</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

function ServiceTimeline({ asset }: { asset: Asset }) {
  if (asset.services.length === 0) return <p className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">No service history yet.</p>;
  return (
    <div className="space-y-2">
      {asset.services.slice().sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-white p-3 transition-all duration-200 hover:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#003399]/10 text-[#003399]"><Wrench className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-medium capitalize">{s.type}</span>
              <Badge variant="outline" className="text-[10px]">{s.date}</Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]">↳ Expense</Badge>
            </div>
            <span className="font-mono text-sm">{fmtKES(s.cost)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.notes || "—"} · by {s.performedBy || "Unspecified"}</p>
        </div>
      ))}
    </div>
  );
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "Qtr" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

function presetDates(preset: RangePreset): { from: string | null; to: string | null } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "7d": { const from = new Date(today); from.setDate(today.getDate() - 7); return { from: iso(from), to: iso(today) }; }
    case "30d": { const from = new Date(today); from.setDate(today.getDate() - 30); return { from: iso(from), to: iso(today) }; }
    case "90d": { const from = new Date(today); from.setDate(today.getDate() - 90); return { from: iso(from), to: iso(today) }; }
    case "year": { const from = new Date(today); from.setFullYear(today.getFullYear() - 1); return { from: iso(from), to: iso(today) }; }
    default: return { from: null, to: null };
  }
}

function groupIncomeByMonth(income: AssetIncome[]) {
  const map = new Map<string, number>();
  const sorted = [...income].sort((a, b) => a.date.localeCompare(b.date));
  for (const r of sorted) {
    const m = r.date.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + Number(r.amount ?? 0));
  }
  const arr = Array.from(map.entries()).slice(-12).map(([month, value]) => ({ month, value }));
  if (arr.length < 6) {
    const padCount = 6 - arr.length;
    const firstMonth = arr[0]?.month ?? new Date().toISOString().slice(0, 7);
    const [y, mo] = firstMonth.split("-").map(Number);
    const base = new Date(y, (mo ?? 1) - 1, 1);
    for (let i = padCount; i > 0; i--) {
      const d = new Date(base);
      d.setMonth(base.getMonth() - i);
      arr.unshift({ month: d.toISOString().slice(0, 7), value: 0 });
    }
  }
  return arr;
}

function IncomeSpark({ data }: { data: { month: string; value: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-24 items-end gap-1.5">
      {data.map((d, i) => {
        const heightPct = (d.value / max) * 100;
        const delay = i * 35;
        return (
          <div key={d.month} className="group relative flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 via-emerald-400 to-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.15)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:from-emerald-600 hover:to-emerald-400"
              style={{ height: `${heightPct}%`, animation: `barRise 600ms cubic-bezier(0.22,1,0.36,1) ${delay}ms both` }}
              title={`${d.month}: ${fmtKES(d.value)}`}
            />
            <span className="text-[9px] font-medium text-muted-foreground/80">{d.month.slice(5)}</span>
            <div className="pointer-events-none absolute -top-10 z-10 scale-90 whitespace-nowrap rounded-lg border border-border bg-white/95 px-2 py-1 text-[10px] font-mono shadow-md opacity-0 backdrop-blur transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100 group-hover:opacity-100">
              {fmtKES(d.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function findPreviousReading(readings: Asset["meterReadings"], forDate: string): { date: string; value: number } | null {
  if (!readings.length) return null;
  const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date));
  const prev = sorted.find((r) => r.date < forDate);
  if (prev) return { date: prev.date, value: prev.value };
  return sorted[0] && sorted[0].date === forDate && sorted[1]
    ? { date: sorted[1].date, value: sorted[1].value }
    : null;
}

function resolveStaffName(fallbackAssetStaff: string, user: ReturnType<typeof useAuth>["user"] | null | undefined): string {
  if (fallbackAssetStaff && typeof fallbackAssetStaff === "string") return fallbackAssetStaff;
  if (!user) return "";
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  if (meta?.full_name) return meta.full_name;
  if (meta?.name) return meta.name;
  if (user.email) {
    const [local] = user.email.split("@");
    if (local) return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "";
}

function latestConsumableDate(consumables: AssetConsumable[] | undefined): string {
  if (!consumables?.length) return "—";
  return [...consumables].sort((a, b) => b.dateReplaced.localeCompare(a.dateReplaced))[0].dateReplaced;
}

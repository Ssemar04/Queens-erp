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
import { Gauge, Wrench, ShieldAlert, TrendingDown, CheckCircle2, AlertTriangle, Clock, Activity, TrendingUp, DollarSign, Calendar, FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Asset, AssetIncome } from "./assets-store";
import { bookValue, currentMeter, nextServiceDueDate, nextServiceDueMeter, serviceHealth, fmtKES, ageYears } from "./assets-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset: Asset | null;
  onAddReading: (id: string, r: { date: string; value: number; recordedBy: string; note?: string }) => void;
  onAddService: (id: string, s: { date: string; type: "preventive" | "corrective" | "inspection" | "upgrade"; performedBy: string; cost: number; notes: string; nextDueDate?: string; nextDueMeter?: number }) => void;
  onAddIncome: (id: string, income: Omit<AssetIncome, "id" | "createdAt" | "updatedAt">) => Promise<unknown>;
  onRemoveIncome: (assetId: string, incomeId: string) => Promise<void>;
}

type RangePreset = "7d" | "30d" | "90d" | "year" | "all" | "custom";

export function AssetDetailSheet({ open, onOpenChange, asset, onAddReading, onAddService, onAddIncome, onRemoveIncome }: Props) {
  if (!asset) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <Body asset={asset} onAddReading={onAddReading} onAddService={onAddService} onAddIncome={onAddIncome} onRemoveIncome={onRemoveIncome} />
      </SheetContent>
    </Sheet>
  );
}

function Body({ asset, onAddReading, onAddService, onAddIncome, onRemoveIncome }: { asset: Asset; onAddReading: Props["onAddReading"]; onAddService: Props["onAddService"]; onAddIncome: Props["onAddIncome"]; onRemoveIncome: Props["onRemoveIncome"] }) {
  const health = useMemo(() => serviceHealth(asset), [asset]);
  const meter = currentMeter(asset);
  const bv = bookValue(asset);
  const depPct = Math.max(0, Math.min(100, (1 - bv / Math.max(1, asset.purchaseCost)) * 100));
  const dueDate = nextServiceDueDate(asset);
  const dueMeter = nextServiceDueMeter(asset);

  const monthly = useMemo(() => groupByMonth(asset.meterReadings), [asset.meterReadings]);

  const [r, setR] = useState({ date: new Date().toISOString().slice(0, 10), value: meter, recordedBy: "Operator", note: "" });
  const [s, setS] = useState({ date: new Date().toISOString().slice(0, 10), type: "preventive" as const, performedBy: "", cost: 0, notes: "" });

  function submitReading() {
    if (!r.value && r.value !== 0) return;
    onAddReading(asset.id, { ...r, note: r.note || undefined });
    setR({ ...r, value: r.value, note: "" });
  }
  function submitService() {
    onAddService(asset.id, s);
    setS({ ...s, notes: "", cost: 0 });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{asset.tag}</span>
          <span>{asset.name}</span>
        </SheetTitle>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{asset.category}</Badge>
          {asset.location && <Badge variant="outline">{asset.location}</Badge>}
          <Badge variant="outline">Staff · {asset.staff || asset.assignedTo || "Unassigned"}</Badge>
          <StatusChip status={asset.status} />
        </div>
      </SheetHeader>

      {/* Top KPI strip */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <KPI icon={Gauge} label="Current meter" value={`${meter.toLocaleString()} ${asset.meterUnit}`} />
        <KPI icon={TrendingDown} label="Book value" value={fmtKES(bv)} sub={`${depPct.toFixed(0)}% depreciated`} />
        <KPI icon={Activity} label="Age" value={`${ageYears(asset).toFixed(1)} yrs`} sub={`of ${asset.usefulLifeYears} yrs`} />
        <KPI icon={Wrench} label="Service health"
          value={health.state === "overdue" ? "Overdue" : health.state === "due_soon" ? "Due soon" : "Healthy"}
          tone={health.state === "overdue" ? "danger" : health.state === "due_soon" ? "warn" : "ok"} />
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
        <TabsList className="grid w-full grid-cols-4 rounded-xl bg-white p-1">
          <TabsTrigger value="readings">Readings</TabsTrigger>
          <TabsTrigger value="service">Service log</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="readings" className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily meter reading</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Input type="date" value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
              <Input type="number" value={r.value} onChange={(e) => setR({ ...r, value: Number(e.target.value) })} placeholder={`Value (${asset.meterUnit})`} />
              <Input value={r.recordedBy} onChange={(e) => setR({ ...r, recordedBy: e.target.value })} placeholder="Recorded by" />
              <Button onClick={submitReading}>Log reading</Button>
            </div>
          </div>
          <SparkBars data={monthly} unit={asset.meterUnit} />
          <ReadingsTable asset={asset} />
        </TabsContent>

        <TabsContent value="service" className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Record service</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} />
              <Select value={s.type} onValueChange={(v) => setS({ ...s, type: v as typeof s.type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventive</SelectItem>
                  <SelectItem value="corrective">Corrective</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                </SelectContent>
              </Select>
              <Input value={s.performedBy} onChange={(e) => setS({ ...s, performedBy: e.target.value })} placeholder="Performed by" />
              <Input type="number" value={s.cost} onChange={(e) => setS({ ...s, cost: Number(e.target.value) })} placeholder="Cost (UGX)" />
            </div>
            <Textarea className="mt-2" rows={2} value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} placeholder="Notes" />
            <div className="mt-2 flex justify-end"><Button onClick={submitService}><Wrench className="mr-1.5 h-4 w-4" /> Log service</Button></div>
          </div>
          <ServiceTimeline asset={asset} />
        </TabsContent>

        <TabsContent value="finance" className="mt-3 space-y-3">
          <FinancePanel asset={asset} onAddIncome={onAddIncome} onRemoveIncome={onRemoveIncome} />
        </TabsContent>

        <TabsContent value="docs" className="mt-3 space-y-2 text-sm">
          <Row label="Warranty expiry" value={asset.warrantyExpiry ?? "—"} tone={chipTone(asset.warrantyExpiry)} />
          <Row label="Insurance expiry" value={asset.insuranceExpiry ?? "—"} tone={chipTone(asset.insuranceExpiry)} />
          <Row label="Notes" value={asset.notes || "—"} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function chipTone(d?: string | null): "ok" | "warn" | "danger" | undefined {
  if (!d) return undefined;
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86400_000);
  if (days < 0) return "danger";
  if (days < 60) return "warn";
  return "ok";
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-white p-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn("font-medium", tone === "danger" && "text-rose-600", tone === "warn" && "text-amber-600", tone === "ok" && "text-emerald-600")}>{value}</span>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, tone }: { icon: typeof Gauge; label: string; value: string; sub?: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <Icon className={cn("h-3.5 w-3.5", tone === "danger" && "text-rose-600", tone === "warn" && "text-amber-600", tone === "ok" && "text-emerald-600")} />
      </div>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

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
            <div className="w-full rounded-t bg-gradient-to-t from-primary to-primary/60" style={{ height: `${(d.value / max) * 100}%` }} title={`${d.month}: ${d.value.toLocaleString()}`} />
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
            <span className="text-muted-foreground">{r.date} · {r.recordedBy}</span>
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
        <div key={s.id} className="rounded-xl border border-border bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wrench className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-medium capitalize">{s.type}</span>
              <Badge variant="outline" className="text-[10px]">{s.date}</Badge>
            </div>
            <span className="font-mono text-sm">{fmtKES(s.cost)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.notes} · by {s.performedBy}</p>
        </div>
      ))}
    </div>
  );
}

function presetDates(preset: RangePreset): { from: string | null; to: string | null } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "7d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 7);
      return { from: iso(from), to: iso(today) };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 30);
      return { from: iso(from), to: iso(today) };
    }
    case "90d": {
      const from = new Date(today);
      from.setDate(today.getDate() - 90);
      return { from: iso(from), to: iso(today) };
    }
    case "year": {
      const from = new Date(today);
      from.setFullYear(today.getFullYear() - 1);
      return { from: iso(from), to: iso(today) };
    }
    default:
      return { from: null, to: null };
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

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "Qtr" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
  { key: "custom", label: "Custom" },
];

function FinancePanel({ asset, onAddIncome, onRemoveIncome }: { asset: Asset; onAddIncome: Props["onAddIncome"]; onRemoveIncome: Props["onRemoveIncome"] }) {
  const annual = (asset.purchaseCost - (asset.salvageValue ?? 0)) / Math.max(1, asset.usefulLifeYears);
  const bv = bookValue(asset);
  const accumDep = asset.purchaseCost - bv;
  const totalService = asset.services.reduce((s, x) => s + x.cost, 0);
  const totalCost = asset.purchaseCost + totalService;

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
  const net = totalIncome - totalCost;
  const topSource = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of filteredIncome) {
      const k = i.source || "Unspecified";
      m.set(k, (m.get(k) ?? 0) + Number(i.amount ?? 0));
    }
    let best: [string, number] | null = null;
    for (const [k, v] of m) if (!best || v > best[1]) best = [k, v];
    return best;
  }, [filteredIncome]);

  const sparkData = useMemo(() => groupIncomeByMonth(filteredIncome), [filteredIncome]);

  const [showForm, setShowForm] = useState(false);
  const [nf, setNf] = useState({
    date: new Date().toISOString().slice(0, 10),
    source: "",
    amount: 0,
    currency: "UGX",
    description: "",
    reference: "",
    recordedBy: "",
  });

  async function submitIncome() {
    if (!nf.date || !nf.amount) {
      toast.error("Date and amount are required");
      return;
    }
    try {
      await onAddIncome(asset.id, { ...nf });
      toast.success("Income recorded");
      setNf({ date: new Date().toISOString().slice(0, 10), source: "", amount: 0, currency: "UGX", description: "", reference: "", recordedBy: "" });
      setShowForm(false);
    } catch {
      toast.error("Could not record income");
    }
  }

  async function delIncome(id: string) {
    try {
      await onRemoveIncome(asset.id, id);
      toast.success("Entry removed");
    } catch {
      toast.error("Could not remove entry");
    }
  }

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes barRise {
          from { transform: scaleY(0); transform-origin: bottom; opacity: 0.3; }
          to   { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
        }
      `}</style>

      <div className="grid grid-cols-2 gap-2">
        <FinRow label="Purchase cost" value={fmtKES(asset.purchaseCost)} />
        <FinRow label="Book value" value={fmtKES(bv)} tone="ok" />
        <FinRow label="Accum. depreciation" value={fmtKES(accumDep)} />
        <FinRow label="Lifetime service" value={fmtKES(totalService)} />
        <FinRow label="Total cost of ownership" value={fmtKES(totalCost)} tone="warn" />
        <FinRow
          label="Net result (income − TCO)"
          value={`${net < 0 ? "−" : ""}${fmtKES(Math.abs(net)).replace(/^UGX\s*/, "")}`}
          tone={net >= 0 ? "ok" : "danger"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-50/50 via-white to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow-sm">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Income generated</p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-emerald-700">{fmtKES(totalIncome)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="bg-white/80">{filteredIncome.length} {filteredIncome.length === 1 ? "entry" : "entries"}</Badge>
              {topSource && <Badge variant="outline" className="bg-white/80">Top source: {topSource[0]} · {fmtKES(topSource[1])}</Badge>}
              {filteredIncome.length > 0 && <Badge variant="outline" className="bg-white/80">Avg/mo · {fmtKES(totalIncome / Math.max(1, sparkData.length))}</Badge>}
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700">
            <Plus className="h-3.5 w-3.5" /> Record income
          </Button>
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
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 w-[130px] bg-white text-[11px]"
                />
                <span className="text-[11px]">→</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 w-[130px] bg-white text-[11px]"
                />
              </div>
            )}
            <div className="ml-auto text-[11px] text-muted-foreground">
              {from || to ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 border border-border/70 shadow-sm">
                    <Calendar className="h-3 w-3" />
                    {from ?? "∞"} → {to ?? "∞"}
                  </span>
                </>
              ) : (
                <span className="rounded-md bg-white px-2 py-0.5 border border-border/70 shadow-sm">All records</span>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-b from-emerald-50/40 to-white p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Monthly income trend</span>
              <span className="text-[10px] font-normal normal-case">last {sparkData.length} months</span>
            </div>
            {sparkData.some((d) => d.value > 0) ? (
              <IncomeSpark data={sparkData} />
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                No income in this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">New income entry</p>
                <p className="text-[11px] text-muted-foreground">Log revenue generated by this asset</p>
              </div>
            </div>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white hover:text-rose-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={nf.date} onChange={(e) => setNf({ ...nf, date: e.target.value })} className="mt-1 h-8 bg-white text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount (UGX)</Label>
              <Input type="number" value={nf.amount || ""} onChange={(e) => setNf({ ...nf, amount: Number(e.target.value) })} placeholder="0" className="mt-1 h-8 bg-white font-mono text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</Label>
              <Input value={nf.source} onChange={(e) => setNf({ ...nf, source: e.target.value })} placeholder="e.g. Rental, Billing" className="mt-1 h-8 bg-white text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reference</Label>
              <Input value={nf.reference} onChange={(e) => setNf({ ...nf, reference: e.target.value })} placeholder="INV-XXX" className="mt-1 h-8 bg-white font-mono text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recorded by</Label>
              <Input value={nf.recordedBy} onChange={(e) => setNf({ ...nf, recordedBy: e.target.value })} placeholder="Department" className="mt-1 h-8 bg-white text-xs" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
              <Input value={nf.description} onChange={(e) => setNf({ ...nf, description: e.target.value })} placeholder="Details of the revenue" className="mt-1 h-8 bg-white text-xs" />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={submitIncome} className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700">
              <Plus className="mr-1 h-3.5 w-3.5" /> Save entry
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 bg-gradient-to-r from-white to-muted/30">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Income records</p>
          </div>
          <span className="text-[10px] text-muted-foreground">Sorted by date · newest first</span>
        </div>
        {filteredIncome.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40 mb-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No income recorded in this period</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">Click “Record income” to log the first entry</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredIncome.slice().sort((a, b) => b.date.localeCompare(a.date)).map((i) => (
              <div key={i.id} className="group relative flex items-start justify-between gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-emerald-50/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-white border-emerald-100 text-emerald-700">{i.source || "—"}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{i.date}</span>
                    {i.reference && <span className="font-mono text-[10px] text-muted-foreground">#{i.reference}</span>}
                  </div>
                  {i.description && <p className="mt-0.5 truncate text-xs text-foreground/80">{i.description}</p>}
                  {i.recordedBy && <p className="text-[10px] text-muted-foreground/70">Recorded by {i.recordedBy}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700">{fmtKES(Number(i.amount ?? 0))}</span>
                  <button
                    onClick={() => delIncome(i.id)}
                    className="rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    title="Delete entry"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinRow({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", tone === "ok" && "text-emerald-600", tone === "warn" && "text-amber-700", tone === "danger" && "text-rose-600")}>{value}</p>
    </div>
  );
}

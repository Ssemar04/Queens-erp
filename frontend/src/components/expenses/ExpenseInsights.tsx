import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, Zap } from "lucide-react";
import type { Expense } from "./expenses-store";

const fmt = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

interface Props { expenses: Expense[] }

export function ExpenseInsights({ expenses }: Props) {
  const insights = useMemo(() => {
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const thisM = monthKey(now);
    const lastM = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const thisTotal = expenses.filter((e) => monthKey(new Date(e.date)) === thisM).reduce((s, e) => s + e.amount, 0);
    const lastTotal = expenses.filter((e) => monthKey(new Date(e.date)) === lastM).reduce((s, e) => s + e.amount, 0);
    const growth = lastTotal ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

    const allMonth = expenses.filter((e) => monthKey(new Date(e.date)) === thisM);
    const avgAmt = allMonth.length ? allMonth.reduce((s, e) => s + e.amount, 0) / allMonth.length : 0;
    const anomalies = expenses.filter((e) => avgAmt > 0 && e.amount > avgAmt * 3);

    const daysSoFar = now.getDate();
    const burn = thisTotal / Math.max(1, daysSoFar);
    const projected = burn * 30;

    const dayCount: Record<string, number> = {};
    expenses.forEach((e) => { dayCount[e.date] = (dayCount[e.date] ?? 0) + e.amount; });
    const peak = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

    return { growth, anomalies, burn, projected, peak, thisTotal };
  }, [expenses]);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <InsightCard
        tone={insights.growth >= 0 ? "warm" : "cool"}
        icon={insights.growth >= 0 ? TrendingUp : TrendingDown}
        label="Month-over-month"
        value={`${insights.growth >= 0 ? "+" : ""}${insights.growth}%`}
        hint={`${fmt(insights.thisTotal)} spent so far this month`}
      />
      <InsightCard
        tone="cool"
        icon={Zap}
        label="Daily burn rate"
        value={fmt(insights.burn)}
        hint={`Projecting ${fmt(insights.projected)} by month-end`}
      />
      {insights.peak && (
        <InsightCard
          tone="info"
          icon={Sparkles}
          label="Peak spending day"
          value={new Date(insights.peak[0]).toLocaleDateString("en", { month: "short", day: "numeric" })}
          hint={fmt(insights.peak[1])}
        />
      )}
      {insights.anomalies.length > 0 && (
        <InsightCard
          tone="alert"
          icon={AlertTriangle}
          label="Unusual expense detected"
          value={`${insights.anomalies.length} item${insights.anomalies.length === 1 ? "" : "s"}`}
          hint={`Top · ${fmt(insights.anomalies[0].amount)} · ${insights.anomalies[0].description || insights.anomalies[0].employee}`}
        />
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  warm: "from-amber-50 to-amber-100/40 border-amber-200 text-amber-900",
  cool: "from-emerald-50 to-emerald-100/40 border-emerald-200 text-emerald-900",
  info: "from-sky-50 to-sky-100/40 border-sky-200 text-sky-900",
  alert: "from-rose-50 to-rose-100/40 border-rose-200 text-rose-900",
};

function InsightCard({ tone, icon: Icon, label, value, hint }: { tone: string; icon: typeof Zap; label: string; value: string; hint: string }) {
  return (
    <Card className={`overflow-hidden rounded-xl border bg-gradient-to-br ${TONES[tone]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
            <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
            <p className="mt-1 text-xs opacity-80">{hint}</p>
          </div>
          <span className="rounded-lg bg-white/60 p-2 backdrop-blur-sm"><Icon className="h-4 w-4" /></span>
        </div>
      </CardContent>
    </Card>
  );
}

interface HeatmapProps { expenses: Expense[] }

export function ExpenseHeatmap({ expenses }: HeatmapProps) {
  const cells = useMemo(() => {
    const today = new Date();
    const totals: Record<string, number> = {};
    expenses.forEach((e) => { totals[e.date] = (totals[e.date] ?? 0) + e.amount; });
    const max = Math.max(1, ...Object.values(totals));
    const days: { date: string; total: number; intensity: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const total = totals[key] ?? 0;
      days.push({ date: key, total, intensity: total / max });
    }
    return days;
  }, [expenses]);

  return (
    <Card className="rounded-xl bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spending pulse · last 12 weeks</CardTitle>
        <p className="text-xs text-muted-foreground">Hover any day to see its total</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {cells.map((c) => {
            const a = c.intensity;
            const bg = a === 0
              ? "hsl(var(--muted))"
              : `color-mix(in oklab, hsl(var(--primary)) ${20 + a * 80}%, transparent)`;
            return (
              <div
                key={c.date}
                title={`${c.date} · ${fmt(c.total)}`}
                className="h-3 w-3 rounded-sm transition-transform hover:scale-150"
                style={{ background: bg }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>12 weeks ago</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {[0.1, 0.3, 0.6, 0.9].map((a) => (
              <span key={a} className="h-2.5 w-2.5 rounded-sm"
                style={{ background: `color-mix(in oklab, hsl(var(--primary)) ${20 + a * 80}%, transparent)` }} />
            ))}
            <span>More</span>
          </div>
          <span>Today</span>
        </div>
      </CardContent>
    </Card>
  );
}

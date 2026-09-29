import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import type { Expense } from "./expenses-store";

const fmt = (n: number) => `UGX ${n.toLocaleString()}`;

interface Props {
  expenses: Expense[];
}

const TYPE_PALETTE: Record<string, string> = {
  employee: "hsl(var(--primary))",
  travel: "#f59e0b",
  recurring: "#8b5cf6",
};

const TYPE_LABEL: Record<string, string> = {
  employee: "Employee",
  travel: "Travel",
  recurring: "Recurring",
};

export function ExpensesDashboard({ expenses }: Props) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const thisMonth = monthKey(now);

    const monthExp = expenses.filter((e) => monthKey(new Date(e.date)) === thisMonth);
    const total = monthExp.reduce((s, e) => s + e.amount, 0);
    const pending = expenses.filter((e) => e.status === "submitted").reduce((s, e) => s + e.amount, 0);
    const approved = expenses.filter((e) => e.status === "approved" || e.status === "paid" || e.status === "reimbursed").reduce((s, e) => s + e.amount, 0);
    const rejected = expenses.filter((e) => e.status === "rejected").reduce((s, e) => s + e.amount, 0);

    const trend: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const total = expenses.filter((e) => monthKey(new Date(e.date)) === key).reduce((s, e) => s + e.amount, 0);
      trend.push({ month: d.toLocaleString("en", { month: "short" }), total });
    }

    const byType = (["employee", "travel", "recurring"] as const).map((t) => ({
      name: TYPE_LABEL[t] ?? t,
      value: expenses.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0),
      color: TYPE_PALETTE[t] ?? "#94a3b8",
    })).filter((r) => r.value > 0);

    const top = Object.entries(expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.employee] = (acc[e.employee] ?? 0) + e.amount; return acc;
    }, {})).map(([employee, total]) => ({ employee, total })).sort((a, b) => b.total - a.total).slice(0, 5);

    const byStatus = (["submitted", "approved", "rejected", "reimbursed", "paid"] as const).map((s) => ({
      status: s.charAt(0).toUpperCase() + s.slice(1),
      amount: expenses.filter((e) => e.status === s).reduce((sum, e) => sum + e.amount, 0),
    })).filter((r) => r.amount > 0);

    return { total, pending, approved, rejected, trend, byType, top, byStatus };
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total · this month" value={fmt(stats.total)} accent="from-primary to-primary/70" />
        <Kpi label="Pending approvals" value={fmt(stats.pending)} accent="from-amber-500 to-amber-400" />
        <Kpi label="Approved" value={fmt(stats.approved)} accent="from-emerald-600 to-emerald-500" />
        <Kpi label="Rejected" value={fmt(stats.rejected)} accent="from-destructive to-destructive/70" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-xl bg-white">
          <CardHeader><CardTitle className="text-base">Monthly expenses trend</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#gExp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-white">
          <CardHeader><CardTitle className="text-base">By expense type</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.byType} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45}>
                  {stats.byType.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl bg-white">
          <CardHeader><CardTitle className="text-base">Status breakdown</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={stats.byStatus}>
                <XAxis dataKey="status" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-white">
          <CardHeader><CardTitle className="text-base">Top spenders</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.top.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No data yet.</p>}
            {stats.top.map((t) => (
              <div key={t.employee} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 transition-all hover:border-[#003399]/30 hover:bg-[#003399]/[0.03]">
                <span className="text-sm font-medium">{t.employee}</span>
                <span className="font-mono text-xs text-muted-foreground">{fmt(t.total)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-white">
          <CardHeader><CardTitle className="text-base">Expense volume</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.byStatus.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>}
            {stats.byStatus.map((s, i) => {
              const max = Math.max(1, ...stats.byStatus.map((x) => x.amount));
              const pct = (s.amount / max) * 100;
              return (
                <div key={s.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{s.status}</span>
                    <span className="font-mono">{fmt(s.amount)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#003399] to-[#004CCC] transition-all"
                      style={{ width: `${pct}%`, animationDelay: `${i * 0.05}s` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, extra, suffix }: { label: string; value: string; accent: string; extra?: React.ReactNode; suffix?: string }) {
  return (
    <Card className="overflow-hidden rounded-xl bg-white">
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-xl font-semibold text-foreground">{value} {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}</p>
        {extra}
      </CardContent>
    </Card>
  );
}

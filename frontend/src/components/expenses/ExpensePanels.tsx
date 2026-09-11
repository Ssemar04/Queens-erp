import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuditEntry, Expense } from "./expenses-store";

const fmt = (n: number) => `UGX ${n.toLocaleString()}`;

export function ReportsPanel({ expenses }: { expenses: Expense[] }) {
  const exportCSV = (kind: string, rows: Record<string, string | number>[]) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${kind}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    { id: "summary", title: "Expense summary", desc: "All expenses with status, department and amounts.",
      rows: () => expenses.map((e) => ({
        ref: e.reference, date: e.date, employee: e.employee, dept: e.department,
        type: e.type, amount: e.amount, currency: e.currency, status: e.status,
      })) },
    { id: "reimbursements", title: "Reimbursements", desc: "Outstanding and processed employee reimbursements.",
      rows: () => expenses.filter((e) => e.reimbursable).map((e) => ({
        ref: e.reference, employee: e.employee, amount: e.amount,
        status: e.reimbursed ? "reimbursed" : "outstanding", date: e.date,
      })) },
    { id: "travel", title: "Travel expenses", desc: "Travel-related expenses with destinations.",
      rows: () => expenses.filter((e) => e.type === "travel").map((e) => ({
        ref: e.reference, employee: e.employee, destination: e.travel?.destination ?? "—",
        purpose: e.travel?.purpose ?? "—", amount: e.amount, date: e.date,
      })) },
    { id: "recurring", title: "Recurring expenses", desc: "Subscriptions and recurring charges.",
      rows: () => expenses.filter((e) => e.type === "recurring").map((e) => ({
        ref: e.reference, frequency: e.recurring?.frequency ?? "—",
        nextRun: e.recurring?.nextRun ?? "—", amount: e.amount, description: e.description,
      })) },
    { id: "department", title: "By department", desc: "Aggregated spend per department.",
      rows: () => {
        const map = new Map<string, { count: number; total: number }>();
        expenses.forEach((e) => {
          const cur = map.get(e.department) ?? { count: 0, total: 0 };
          map.set(e.department, { count: cur.count + 1, total: cur.total + e.amount });
        });
        return Array.from(map.entries()).map(([department, v]) => ({
          department, count: v.count, total: v.total, avg: v.count ? Math.round(v.total / v.count) : 0,
        }));
      } },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {reports.map((r) => (
        <Card key={r.id} className="rounded-xl bg-white">
          <CardHeader>
            <CardTitle className="text-base">{r.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{r.rows().length} rows</span>
            <Button size="sm" variant="outline" onClick={() => exportCSV(r.id, r.rows())}>Export CSV</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AuditLogPanel({ audit, expenses }: { audit: AuditEntry[]; expenses: Expense[] }) {
  const map = new Map<string, Expense>();
  expenses.forEach((e) => map.set(e.id, e));
  return (
    <Card className="rounded-xl bg-white">
      <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {audit.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>}
        {audit.map((a) => {
          const exp = map.get(a.expenseId);
          const tone = a.action === "approved"
            ? "bg-emerald-100 text-emerald-800"
            : a.action === "rejected"
              ? "bg-rose-100 text-rose-800"
              : "bg-indigo-100 text-indigo-800";
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{a.action}</span>
              <div className="flex-1">
                <p className="text-sm"><span className="font-mono">{exp?.reference ?? a.expenseId.slice(0, 6)}</span> · by <span className="font-medium">{a.actor}</span></p>
                <p className="text-xs text-muted-foreground">{a.note}</p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

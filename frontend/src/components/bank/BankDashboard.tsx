import { useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, Activity, Banknote, Smartphone, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankAccount, BankTxn } from "./bank-store";
import { fmt } from "./bank-store";

interface Props {
  accounts: BankAccount[];
  txns: BankTxn[];
}

export function BankDashboard({ accounts, txns }: Props) {
  const stats = useMemo(() => {
    const totalKES = accounts
      .filter((a) => a.currency === "UGX" && a.status === "active")
      .reduce((s, a) => s + a.currentBalance, 0);
    const inflow = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outflow = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const unreconciled = txns.filter((t) => !t.reconciled).length;
    const mobile = txns.filter((t) => t.subtype === "mobile_money").reduce((s, t) => s + Math.abs(t.amount), 0);
    return { totalKES, inflow, outflow, unreconciled, mobile, net: inflow - outflow };
  }, [accounts, txns]);

  const recent = useMemo(
    () => [...txns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [txns],
  );

  return (
    <div className="space-y-6">
      {/* Headline strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Cash position (UGX)" value={fmt(stats.totalKES, "UGX")} icon={Wallet} tint="text-primary bg-primary/10" />
        <Metric label="Inflows" value={fmt(stats.inflow)} icon={TrendingUp} tint="text-emerald-600 bg-emerald-500/10" />
        <Metric label="Outflows" value={fmt(stats.outflow)} icon={TrendingDown} tint="text-destructive bg-destructive/10" />
        <Metric label="Unreconciled" value={String(stats.unreconciled)} icon={Activity} tint="text-amber-600 bg-amber-500/10" />
      </div>

      {/* Account cards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Multi-bank wallets
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "relative overflow-hidden rounded-xl bg-gradient-to-br p-5 text-white shadow-sm",
                a.color,
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest opacity-80">{a.bankName}</p>
                  <p className="mt-0.5 text-base font-semibold">{a.accountName}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    a.status === "active" ? "bg-white/20" : "bg-black/30",
                  )}
                >
                  {a.status}
                </span>
              </div>
              <div className="mt-6">
                <p className="font-mono text-2xl font-semibold">
                  {fmt(a.currentBalance, a.currency)}
                </p>
                <p className="mt-1 text-[11px] opacity-80">
                  Opening · {fmt(a.openingBalance, a.currency)}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] opacity-90">
                <span className="font-mono">···· {a.accountNumber.slice(-4)}</span>
                <span>{a.branch} · {a.swiftCode}</span>
              </div>
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      {/* Activity + breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
            <span className="text-xs text-muted-foreground">{recent.length} entries</span>
          </div>
          <div className="space-y-2">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    t.amount > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {t.subtype === "mobile_money" ? <Smartphone className="h-4 w-4" /> : t.subtype === "cheque" ? <FileText className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.date} · {t.party} · <span className="font-mono">{t.reference}</span>
                  </p>
                </div>
                <p
                  className={cn(
                    "font-mono text-sm font-semibold",
                    t.amount > 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {fmt(t.amount)}
                </p>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No activity yet</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Net position</h3>
          <p className="font-mono text-3xl font-semibold text-foreground">{fmt(stats.net)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Inflows minus outflows · all accounts</p>
          <div className="mt-5 space-y-3">
            <Bar label="Mobile money" value={stats.mobile} total={stats.inflow + stats.outflow || 1} cls="bg-emerald-500" />
            <Bar label="Inflows" value={stats.inflow} total={stats.inflow + stats.outflow || 1} cls="bg-primary" />
            <Bar label="Outflows" value={stats.outflow} total={stats.inflow + stats.outflow || 1} cls="bg-destructive" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Bar({ label, value, total, cls }: { label: string; value: number; total: number; cls: string }) {
  const pct = Math.min(100, Math.round((value / total) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{fmt(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", cls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

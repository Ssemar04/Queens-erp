import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Calendar,
  ClipboardList,
  FileBarChart2,
  Scale,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useBankStore } from "@/components/bank/bank-store";
import { useLedger } from "@/components/ledger/ledger-store";
import { useExpensesStore } from "@/components/expenses/expenses-store";
import { useAssetsStore } from "@/components/assets/assets-store";
import { ReportViewer, type ReportKey } from "@/components/reports/ReportViewer";
import { presetRange, type Granularity, type DateRange, type ReportSale } from "@/components/reports/reports-engine";
import { fetchMovementTransactions } from "@/lib/movements-backend-api";
import type { StockMovement } from "@/types/inventory";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports · Queenstech ERP" }] }),
});

interface ReportDef { key: ReportKey; label: string; group: string; icon: LucideIcon; description: string }

const REPORTS: ReportDef[] = [
  { key: "income_statement", label: "Income statement", group: "Financial statements", icon: TrendingUp, description: "Revenue, COGS, opex, net income" },
  { key: "balance_sheet", label: "Balance sheet", group: "Financial statements", icon: Scale, description: "Assets, liabilities, equity as of date" },
  { key: "cash_flow", label: "Cash flow", group: "Financial statements", icon: Wallet, description: "Inflow vs outflow by period" },
  { key: "pnl_periodic", label: "Periodic P&L", group: "Operational", icon: ClipboardList, description: "Revenue & expense rollup by period" },
  { key: "ar_aging", label: "Debtors aging", group: "Ledgers", icon: ArrowDownToLine, description: "Outstanding receivables by bucket" },
  { key: "ap_aging", label: "Creditors aging", group: "Ledgers", icon: ArrowUpFromLine, description: "Outstanding payables by bucket" },
  { key: "debtors_outstanding", label: "Debtors outstanding", group: "Ledgers", icon: ArrowDownToLine, description: "Open invoices line by line" },
  { key: "creditors_outstanding", label: "Creditors outstanding", group: "Ledgers", icon: ArrowUpFromLine, description: "Open bills line by line" },
  { key: "bank_summary", label: "Bank summary", group: "Treasury", icon: Wallet, description: "All bank accounts with balances" },
  { key: "asset_register", label: "Asset register", group: "Assets", icon: Boxes, description: "Full asset list with book values" },
];

function ReportsPage() {
  const bank = useBankStore();
  const debtors = useLedger("debtor");
  const creditors = useLedger("creditor");
  const exp = useExpensesStore();
  const assets = useAssetsStore();
  const { data: movements = [], isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["backend", "movements"],
    queryFn: () => fetchMovementTransactions(),
    initialData: [],
  });

  const [range, setRange] = useState<DateRange>(presetRange("ytd"));
  const [g, setG] = useState<Granularity>("monthly");
  const [active, setActive] = useState<ReportKey>("income_statement");

  const sales = useMemo<ReportSale[]>(() => {
    const byReceipt = new Map<string, ReportSale>();

    for (const movement of movements) {
      const sale = movement.sale;
      if (!sale) continue;

      const receiptNumber = sale.receiptNumber || movement.reference || movement.id;
      if (byReceipt.has(receiptNumber)) continue;

      byReceipt.set(receiptNumber, {
        receiptNumber,
        date: movement.createdAt.slice(0, 10),
        customer: sale.customer || "Walk-in",
        totalAmount: sale.totalAmount || 0,
        deposit: sale.deposit || 0,
        balance: sale.balance || 0,
        paymentMethod: sale.paymentMethod || "",
        status: sale.status || "paid",
      });
    }

    return Array.from(byReceipt.values());
  }, [movements]);

  const inputs = useMemo(() => ({
    bank: { txns: bank.txns, accounts: bank.accounts },
    debtors: debtors.entries,
    creditors: creditors.entries,
    expenses: exp.expenses,
    assets: assets.assets,
    sales,
  }), [bank.txns, bank.accounts, debtors.entries, creditors.entries, exp.expenses, assets.assets, sales]);

  const categoriesById = useMemo(() => new Map<string, string>(), []);

  const groups = Array.from(new Set(REPORTS.map((r) => r.group)));

  const reportingOverview = useMemo(() => {
    const salesTotal = sales.reduce((s, r) => s + r.totalAmount, 0);
    const expTotal = exp.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      reports: REPORTS.length,
      groups: groups.length,
      salesCount: sales.length,
      salesTotal,
      expTotal,
      assetsBook: assets.assets.reduce((s, a) => s + (a.bookValue || 0), 0),
    };
  }, [sales, exp.expenses, assets.assets, groups.length]);

  const ready = bank.ready && debtors.ready && creditors.ready && exp.ready && assets.ready && !movementsLoading;
  if (!ready) return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));
  const meta = REPORTS.find((r) => r.key === active)!;

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
              <FileBarChart2 className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-emerald-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Reports & insights
          </div>
          <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
            {reportingOverview.reports} reports across {reportingOverview.groups} categories
          </h2>
          <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
            {reportingOverview.salesCount} receipts · UGX {reportingOverview.salesTotal.toLocaleString()} in sales
            {reportingOverview.expTotal > 0 && <> · UGX {reportingOverview.expTotal.toLocaleString()} expenses</>}
          </p>
        </div>
      </motion.section>

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Quick range</Label>
            <div className="flex flex-wrap gap-1">
              {[
                ["today", "Today"], ["week", "Week"], ["month", "Month"], ["quarter", "Quarter"],
                ["ytd", "YTD"], ["year", "12 mo"], ["last30", "30d"], ["last90", "90d"],
              ].map(([k, l]) => (
                <Button key={k} size="sm" variant="outline" onClick={() => setRange(presetRange(k as Parameters<typeof presetRange>[0]))}>{l}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
            <Input type="date" className="bg-white" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
            <Input type="date" className="bg-white" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Granularity</Label>
            <Select value={g} onValueChange={(v) => setG(v as Granularity)}>
              <SelectTrigger className="w-[160px] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> {range.from} → {range.to}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Selector */}
        <aside className="space-y-3">
          {groups.map((grp) => (
            <div key={grp}>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{grp}</p>
              <div className="space-y-1">
                {REPORTS.filter((r) => r.group === grp).map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.key} onClick={() => setActive(r.key)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        active === r.key ? "border-primary bg-primary/5" : "border-border bg-white hover:border-primary/40",
                      )}
                    >
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", active === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{r.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Viewer */}
        <ReportViewer reportKey={active} title={meta.label} range={range} granularity={g} inputs={inputs} categoriesById={categoriesById} />
      </div>
    </div>
  );
}

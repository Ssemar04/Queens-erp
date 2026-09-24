import { createFileRoute } from "@tanstack/react-router";
import { Landmark, LayoutGrid, BookCheck, ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet, Wallet, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBankStore, type StatementLine } from "@/components/bank/bank-store";
import { BankDashboard } from "@/components/bank/BankDashboard";
import { AccountsManager } from "@/components/bank/AccountsManager";
import { CashFlowPanel } from "@/components/bank/CashFlowPanel";
import { ReconciliationPanel } from "@/components/bank/ReconciliationPanel";
import { ReportsPanel } from "@/components/bank/ReportsPanel";
import { motion } from "framer-motion";
import { useMemo } from "react";

export const Route = createFileRoute("/app/bank")({
  component: BankPage,
  head: () => ({ meta: [{ title: "Bank · Queenstech ERP" }] }),
});

function BankPage() {
  const store = useBankStore();

  if (!store.ready) {
    return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;
  }

  async function importSample(accountId: string) {
    const today = new Date();
    const iso = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const lines: Omit<StatementLine, "id" | "accountId" | "importedAt">[] = [
      { date: iso(-1), description: "M-Pesa C2B settlement", reference: "QGT7H4X9PA", amount: 48_500 },
      { date: iso(-2), description: "Inward cheque clearing", reference: "CHQ-00871", amount: 120_000 },
      { date: iso(-3), description: "EFT to Mavuno Suppliers", reference: "EFT-44120", amount: -65_400 },
      { date: iso(-5), description: "Bank service charge", reference: "BSC-MAY", amount: -450 },
      { date: iso(-6), description: "Interest credit", reference: "INT-Q2", amount: 1_280 },
    ];
    await store.importStatement(accountId, lines);
  }

  const overview = useMemo(() => {
    const totalBalance = store.accounts.reduce((s, a) => s + a.balance, 0);
    const inflow = store.txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outflow = store.txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const unreconciled = store.txns.filter((t) => !t.reconciled).length;
    return { totalBalance, inflow, outflow, unreconciled, accounts: store.accounts.length };
  }, [store.accounts, store.txns]);

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  return (
    <div className="w-full min-w-0 space-y-6">
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
              <Landmark className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-emerald-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Treasury hub
          </div>
          <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
            {overview.accounts} account{overview.accounts !== 1 ? "s" : ""} · UGX {overview.totalBalance.toLocaleString()} consolidated
          </h2>
          <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> UGX {overview.inflow.toLocaleString()} in</span>
            <span className="mx-2 text-white/40">·</span>
            <span className="inline-flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5" /> UGX {overview.outflow.toLocaleString()} out</span>
            {overview.unreconciled > 0 && (
              <>
                <span className="mx-2 text-white/40">·</span>
                <span className="font-semibold text-amber-200">{overview.unreconciled} unreconciled</span>
              </>
            )}
          </p>
        </div>
      </motion.section>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-white p-1 md:w-auto">
          <Tab value="dashboard" icon={LayoutGrid} label="Dashboard" />
          <Tab value="accounts" icon={Wallet} label="Accounts" />
          <Tab value="deposits" icon={ArrowDownToLine} label="Deposits" />
          <Tab value="withdrawals" icon={ArrowUpFromLine} label="Withdrawals" />
          <Tab value="reconcile" icon={BookCheck} label="Reconcile" />
          <Tab value="reports" icon={FileSpreadsheet} label="Reports" />
        </TabsList>

        <TabsContent value="dashboard" className="mt-5">
          <BankDashboard accounts={store.accounts} txns={store.txns} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-5">
          <AccountsManager
            accounts={store.accounts}
            onCreate={store.addAccount}
            onUpdate={store.updateAccount}
            onRemove={store.removeAccount}
          />
        </TabsContent>
        <TabsContent value="deposits" className="mt-5">
          <CashFlowPanel direction="deposit" accounts={store.accounts} txns={store.txns} onAdd={store.addTxn} />
        </TabsContent>
        <TabsContent value="withdrawals" className="mt-5">
          <CashFlowPanel direction="withdrawal" accounts={store.accounts} txns={store.txns} onAdd={store.addTxn} />
        </TabsContent>
        <TabsContent value="reconcile" className="mt-5">
          <ReconciliationPanel
            accounts={store.accounts}
            txns={store.txns}
            statements={store.statements}
            onToggleReconciled={store.toggleReconciled}
            onImportSample={importSample}
          />
        </TabsContent>
        <TabsContent value="reports" className="mt-5">
          <ReportsPanel accounts={store.accounts} txns={store.txns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Tab({ value, icon: Icon, label }: { value: string; icon: typeof Landmark; label: string }) {
  return (
    <TabsTrigger value={value} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </TabsTrigger>
  );
}

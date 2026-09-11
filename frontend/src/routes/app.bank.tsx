import { createFileRoute } from "@tanstack/react-router";
import { Landmark, LayoutGrid, BookCheck, ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBankStore, type StatementLine } from "@/components/bank/bank-store";
import { BankDashboard } from "@/components/bank/BankDashboard";
import { AccountsManager } from "@/components/bank/AccountsManager";
import { CashFlowPanel } from "@/components/bank/CashFlowPanel";
import { ReconciliationPanel } from "@/components/bank/ReconciliationPanel";
import { ReportsPanel } from "@/components/bank/ReportsPanel";

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

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Bank</h1>
            <p className="text-sm text-muted-foreground">
              Multi-bank cash management · reconciliation · statements · reports
            </p>
          </div>
        </div>
      </div>

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

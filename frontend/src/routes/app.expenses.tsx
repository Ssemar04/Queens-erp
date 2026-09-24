import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Receipt, LayoutGrid, FileText, FileSpreadsheet, Sparkles, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useExpensesStore, type Expense } from "@/components/expenses/expenses-store";
import { ExpensesDashboard } from "@/components/expenses/ExpensesDashboard";
import { ExpensesTable } from "@/components/expenses/ExpensesTable";
import { ExpenseFormSheet } from "@/components/expenses/ExpenseFormSheet";
import { ReportsPanel } from "@/components/expenses/ExpensePanels";
import { ExpenseInsights, ExpenseHeatmap } from "@/components/expenses/ExpenseInsights";
import { ReceiptScanner } from "@/components/expenses/ReceiptScanner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/app/expenses")({
  component: ExpensesPage,
  head: () => ({ meta: [{ title: "Expenses · Queenstech ERP" }] }),
});

function ExpensesPage() {
  const store = useExpensesStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  if (!store.ready) return <div className="w-full h-32 animate-pulse rounded-xl bg-muted/50" />;

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setOpen(true); };

  const overview = useMemo(() => {
    const total = store.expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const approved = store.expenses.filter((e) => e.status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    const pending = store.expenses.filter((e) => e.status === "submitted" || e.status === "draft").length;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const thisMonthTotal = store.expenses
      .filter((e) => (e.date || "").slice(0, 7) === thisMonth)
      .reduce((s, e) => s + (e.amount || 0), 0);
    return { total, approved, pending, count: store.expenses.length, thisMonthTotal };
  }, [store.expenses]);

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
              <Receipt className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-rose-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Expenses hub
            </div>
            <h2 className="text-2xl font-bold leading-tight md:text-[28px]">
              {overview.count.toLocaleString()} claims · UGX {overview.total.toLocaleString()} tracked
            </h2>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              UGX {overview.thisMonthTotal.toLocaleString()} this month
              {overview.pending > 0 && <> · <span className="font-semibold text-amber-200">{overview.pending} pending review</span></>}
              {overview.approved > 0 && <> · UGX {overview.approved.toLocaleString()} approved</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
            <Button
              onClick={openNew}
              size="sm"
              className="bg-white text-[#003399] font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_16px_-2px_rgba(0,0,0,0.25)] hover:bg-white/95 active:scale-[0.98] transition-all gap-1.5"
            >
              <Receipt className="h-4 w-4 text-[#003399]" /> New expense
            </Button>
          </div>
        </div>
      </motion.section>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-white p-1 md:w-auto">
          <Tab value="dashboard" icon={LayoutGrid} label="Dashboard" />
          <Tab value="expenses" icon={FileText} label="Expenses" />
          <Tab value="reports" icon={FileSpreadsheet} label="Reports" />
        </TabsList>

        <TabsContent value="dashboard" className="mt-5 space-y-6">
          <ExpenseInsights expenses={store.expenses} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2"><ExpenseHeatmap expenses={store.expenses} /></div>
            <ReceiptScanner onCapture={store.addExpense} />
          </div>
          <ExpensesDashboard expenses={store.expenses} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-5">
          <ExpensesTable
            title="All expenses"
            expenses={store.expenses}
            onAdd={openNew}
            onEdit={openEdit}
            onDuplicate={store.duplicateExpense}
            onRemove={store.removeExpense}
            onDecide={(id, d) => store.decideExpense(id, d, "Faith Njeri", d === "approved" ? "Approved via inbox" : "Rejected")}
            onSubmitForApproval={(id) => store.updateExpense(id, { status: "submitted" })}
            onReimburse={(id) => store.reimburse(id, "Faith Njeri")}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-5">
          <ReportsPanel expenses={store.expenses} />
        </TabsContent>
      </Tabs>

      <ExpenseFormSheet
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={(data) => editing ? store.updateExpense(editing.id, data) : store.addExpense(data)}
      />
    </div>
  );
}

function Tab({ value, icon: Icon, label }: { value: string; icon: typeof Receipt; label: string }) {
  return (
    <TabsTrigger value={value} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </TabsTrigger>
  );
}

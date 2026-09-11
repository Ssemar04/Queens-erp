import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Receipt, LayoutGrid, FileText, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useExpensesStore, type Expense } from "@/components/expenses/expenses-store";
import { ExpensesDashboard } from "@/components/expenses/ExpensesDashboard";
import { ExpensesTable } from "@/components/expenses/ExpensesTable";
import { ExpenseFormSheet } from "@/components/expenses/ExpenseFormSheet";
import { ReportsPanel } from "@/components/expenses/ExpensePanels";
import { ExpenseInsights, ExpenseHeatmap } from "@/components/expenses/ExpenseInsights";
import { ReceiptScanner } from "@/components/expenses/ReceiptScanner";

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

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
            <p className="text-sm text-muted-foreground">All claims in one table · filter by employee, department, status</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Receipt className="h-4 w-4" /> New expense</Button>
      </div>

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

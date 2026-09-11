import type { BankTxn, BankAccount } from "@/components/bank/bank-store";
import type { LedgerEntry } from "@/components/ledger/ledger-store";
import type { Expense } from "@/components/expenses/expenses-store";
import type { Asset } from "@/components/assets/assets-store";
import { bookValue } from "@/components/assets/assets-store";
import type { PaymentMethod, TransactionStatus } from "@/types/inventory";

export type Granularity = "daily" | "weekly" | "monthly" | "quarterly" | "annually";

export interface DateRange { from: string; to: string }

export function inRange(date: string, r: DateRange) {
  return date >= r.from && date <= r.to;
}

export function presetRange(p: "today" | "week" | "month" | "quarter" | "ytd" | "year" | "last30" | "last90"): DateRange {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(now);
  if (p === "today") return { from: iso(now), to: iso(now) };
  if (p === "week") { start.setDate(now.getDate() - 6); return { from: iso(start), to: iso(now) }; }
  if (p === "month") { start.setDate(1); return { from: iso(start), to: iso(now) }; }
  if (p === "quarter") { const q = Math.floor(now.getMonth() / 3); start.setMonth(q * 3, 1); return { from: iso(start), to: iso(now) }; }
  if (p === "ytd") { start.setMonth(0, 1); return { from: iso(start), to: iso(now) }; }
  if (p === "year") { start.setFullYear(now.getFullYear() - 1); start.setDate(start.getDate() + 1); return { from: iso(start), to: iso(now) }; }
  if (p === "last30") { start.setDate(now.getDate() - 29); return { from: iso(start), to: iso(now) }; }
  start.setDate(now.getDate() - 89); return { from: iso(start), to: iso(now) };
}

export function periodKey(date: string, g: Granularity): string {
  const d = new Date(date);
  if (g === "daily") return date;
  if (g === "weekly") {
    const day = d.getUTCDay();
    const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    return `Week of ${monday.toISOString().slice(0, 10)}`;
  }
  if (g === "monthly") return date.slice(0, 7);
  if (g === "quarterly") return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  return String(d.getUTCFullYear());
}

export interface FinanceInputs {
  bank: { txns: BankTxn[]; accounts: BankAccount[] };
  debtors: LedgerEntry[];
  creditors: LedgerEntry[];
  expenses: Expense[];
  assets: Asset[];
  sales: ReportSale[];
}

export interface ReportSale {
  receiptNumber: string;
  date: string;
  customer: string;
  totalAmount: number;
  deposit: number;
  balance: number;
  paymentMethod: PaymentMethod | "";
  status: TransactionStatus;
}

// ----- Income Statement -----
export interface IncomeStatement {
  rows: { label: string; amount: number; bold?: boolean; emphasis?: "ok" | "danger" | "muted" }[];
  netIncome: number;
}

export function buildIncomeStatement(i: FinanceInputs, r: DateRange): IncomeStatement {
  const ledgerRevenue = i.debtors
    .filter((e) => inRange(e.issueDate, r))
    .reduce((s, e) => s + e.amount, 0);
  const transactionRevenue = i.sales
    .filter((s) => s.status !== "void" && inRange(s.date, r))
    .reduce((total, sale) => total + sale.totalAmount, 0);
  const revenue = ledgerRevenue + transactionRevenue;

  const cogs = i.creditors
    .filter((e) => inRange(e.issueDate, r) && e.tags.includes("materials"))
    .reduce((s, e) => s + e.amount, 0);

  const grossProfit = revenue - cogs;

  const opex = i.expenses
    .filter((e) => inRange(e.date, r) && ["approved", "paid", "reimbursed"].includes(e.status))
    .reduce((s, e) => s + e.amount, 0);

  const otherBills = i.creditors
    .filter((e) => inRange(e.issueDate, r) && !e.tags.includes("materials"))
    .reduce((s, e) => s + e.amount, 0);

  const depreciation = depreciationForRange(i.assets, r);

  const operatingIncome = grossProfit - opex - otherBills - depreciation;

  // Bank charges & interest
  const charges = i.bank.txns.filter((t) => inRange(t.date, r) && t.type === "charge").reduce((s, t) => s + Math.abs(t.amount), 0);
  const interest = i.bank.txns.filter((t) => inRange(t.date, r) && t.type === "interest").reduce((s, t) => s + t.amount, 0);

  const netIncome = operatingIncome + interest - charges;

  return {
    rows: [
      { label: "Revenue (ledger invoices)", amount: ledgerRevenue },
      { label: "Revenue (transactions)", amount: transactionRevenue },
      { label: "Total revenue", amount: revenue, bold: true },
      { label: "Cost of goods sold", amount: -cogs },
      { label: "Gross profit", amount: grossProfit, bold: true, emphasis: grossProfit >= 0 ? "ok" : "danger" },
      { label: "Operating expenses", amount: -opex },
      { label: "Vendor bills (non-COGS)", amount: -otherBills },
      { label: "Depreciation", amount: -depreciation },
      { label: "Operating income", amount: operatingIncome, bold: true },
      { label: "Bank charges", amount: -charges, emphasis: "muted" },
      { label: "Interest income", amount: interest, emphasis: "muted" },
      { label: "Net income", amount: netIncome, bold: true, emphasis: netIncome >= 0 ? "ok" : "danger" },
    ],
    netIncome,
  };
}

function depreciationForRange(assets: Asset[], r: DateRange): number {
  const fromMs = new Date(r.from).getTime();
  const toMs = new Date(r.to).getTime();
  const years = Math.max(0, (toMs - fromMs) / (365 * 86400_000));
  return assets.reduce((s, a) => {
    const annual = (a.purchaseCost - a.salvageValue) / Math.max(1, a.usefulLifeYears);
    return s + annual * years;
  }, 0);
}

// ----- Balance Sheet -----
export interface BalanceSheet {
  assets: { label: string; amount: number; sub?: boolean }[];
  liabilities: { label: string; amount: number; sub?: boolean }[];
  equity: { label: string; amount: number; sub?: boolean }[];
  totalAssets: number;
  totalLiabEquity: number;
}

export function buildBalanceSheet(i: FinanceInputs, asOf: string): BalanceSheet {
  // Cash & equivalents
  const transactionCash = i.sales
    .filter((s) => s.status !== "void" && s.date <= asOf)
    .reduce((sum, sale) => sum + sale.deposit, 0);
  const cash = i.bank.accounts.reduce((s, a) => s + a.currentBalance, 0) + transactionCash;
  // Accounts receivable (open balances)
  const transactionReceivables = i.sales
    .filter((s) => s.status !== "void" && s.date <= asOf)
    .reduce((sum, sale) => sum + Math.max(0, sale.balance), 0);
  const ar = i.debtors.reduce((s, e) => s + Math.max(0, e.amount - e.paid), 0) + transactionReceivables;
  // Inventory (placeholder via assets categorised "Furniture/Equipment"? skip — leave 0 for clarity)
  // Fixed assets at book value
  const fixed = i.assets.reduce((s, a) => s + bookValue(a), 0);

  const totalAssets = cash + ar + fixed;

  // Accounts payable
  const ap = i.creditors.reduce((s, e) => s + Math.max(0, e.amount - e.paid), 0);
  const totalLiab = ap;

  const retainedEarnings = totalAssets - totalLiab;

  return {
    assets: [
      { label: "Current assets", amount: cash + ar, sub: false },
      { label: "Cash & bank balances", amount: cash, sub: true },
      { label: "Accounts receivable", amount: ar, sub: true },
      { label: "Non-current assets", amount: fixed },
      { label: "Property, plant & equipment (NBV)", amount: fixed, sub: true },
    ],
    liabilities: [
      { label: "Current liabilities", amount: ap },
      { label: "Accounts payable", amount: ap, sub: true },
    ],
    equity: [
      { label: "Retained earnings", amount: retainedEarnings },
    ],
    totalAssets,
    totalLiabEquity: totalLiab + retainedEarnings,
  };
}

// ----- Cash Flow -----
export function buildCashFlow(i: FinanceInputs, r: DateRange, g: Granularity) {
  const map = new Map<string, { inflow: number; outflow: number }>();
  const add = (date: string, inflow: number, outflow: number) => {
    const k = periodKey(date, g);
    const cur = map.get(k) ?? { inflow: 0, outflow: 0 };
    cur.inflow += inflow;
    cur.outflow += outflow;
    map.set(k, cur);
  };

  for (const t of i.bank.txns) {
    if (!inRange(t.date, r)) continue;
    add(t.date, t.amount > 0 ? t.amount : 0, t.amount < 0 ? Math.abs(t.amount) : 0);
  }
  for (const sale of i.sales) {
    if (sale.status === "void" || !inRange(sale.date, r) || sale.deposit <= 0) continue;
    add(sale.date, sale.deposit, 0);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ Period: k, Inflow: v.inflow, Outflow: v.outflow, Net: v.inflow - v.outflow }));
}

// ----- Periodic P&L summary -----
export function buildPeriodicPL(i: FinanceInputs, r: DateRange, g: Granularity) {
  const map = new Map<string, { revenue: number; expenses: number }>();
  for (const e of i.debtors) {
    if (!inRange(e.issueDate, r)) continue;
    const k = periodKey(e.issueDate, g);
    const c = map.get(k) ?? { revenue: 0, expenses: 0 };
    c.revenue += e.amount; map.set(k, c);
  }
  for (const sale of i.sales) {
    if (sale.status === "void" || !inRange(sale.date, r)) continue;
    const k = periodKey(sale.date, g);
    const c = map.get(k) ?? { revenue: 0, expenses: 0 };
    c.revenue += sale.totalAmount; map.set(k, c);
  }
  for (const e of i.expenses) {
    if (!inRange(e.date, r) || !["approved", "paid", "reimbursed"].includes(e.status)) continue;
    const k = periodKey(e.date, g);
    const c = map.get(k) ?? { revenue: 0, expenses: 0 };
    c.expenses += e.amount; map.set(k, c);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ Period: k, Revenue: v.revenue, Expenses: v.expenses, "Net result": v.revenue - v.expenses }));
}

// ----- AR / AP aging summary -----
export function buildAgingSummary(entries: LedgerEntry[]) {
  const buckets: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const today = Date.now();
  for (const e of entries) {
    const bal = Math.max(0, e.amount - e.paid);
    if (bal === 0) continue;
    const days = Math.round((today - new Date(e.dueDate).getTime()) / 86400_000);
    if (days <= 0) buckets.current += bal;
    else if (days <= 30) buckets["1-30"] += bal;
    else if (days <= 60) buckets["31-60"] += bal;
    else if (days <= 90) buckets["61-90"] += bal;
    else buckets["90+"] += bal;
  }
  return buckets;
}

export function buildSalesAgingSummary(sales: ReportSale[]) {
  const buckets: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const today = Date.now();
  for (const sale of sales) {
    if (sale.status === "void") continue;
    const bal = Math.max(0, sale.balance);
    if (bal === 0) continue;
    const days = Math.round((today - new Date(sale.date).getTime()) / 86400_000);
    if (days <= 0) buckets.current += bal;
    else if (days <= 30) buckets["1-30"] += bal;
    else if (days <= 60) buckets["31-60"] += bal;
    else if (days <= 90) buckets["61-90"] += bal;
    else buckets["90+"] += bal;
  }
  return buckets;
}

// ----- Asset register -----
export function buildAssetRegister(assets: Asset[]) {
  return assets.map((a) => ({
    Tag: a.tag, Name: a.name, Category: a.category, Location: a.location,
    "Purchase date": a.purchaseDate, "Purchase cost": a.purchaseCost,
    "Book value": Math.round(bookValue(a)), Status: a.status, Condition: a.condition,
    "Last service": a.lastServiceDate ?? "—",
  }));
}

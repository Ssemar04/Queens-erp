import { useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, FileText, BookOpen, Wallet, ArrowUpRight, ArrowDownRight, AlertCircle, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BankAccount, BankTxn } from "./bank-store";
import { fmt } from "./bank-store";
import { exportAll, type ExportRow } from "./bank-export";

type ReportKey = "ledger" | "cashbook" | "cashflow" | "deposits" | "withdrawals" | "reconciliation" | "outstanding";

interface Props {
  accounts: BankAccount[];
  txns: BankTxn[];
}

const REPORTS: { key: ReportKey; label: string; description: string; icon: typeof BookOpen }[] = [
  { key: "ledger", label: "Bank ledger", description: "Chronological account postings with running balance", icon: BookOpen },
  { key: "cashbook", label: "Cash book", description: "Side-by-side receipts and payments", icon: Wallet },
  { key: "cashflow", label: "Cash flow", description: "Monthly inflow, outflow, and net movement", icon: Calculator },
  { key: "deposits", label: "Deposit report", description: "All deposits grouped by type", icon: ArrowUpRight },
  { key: "withdrawals", label: "Withdrawal report", description: "All withdrawals grouped by type", icon: ArrowDownRight },
  { key: "reconciliation", label: "Reconciliation report", description: "Matched vs pending, variance summary", icon: FileText },
  { key: "outstanding", label: "Outstanding payments", description: "Cheques & transfers still un-cleared", icon: AlertCircle },
];

export function ReportsPanel({ accounts, txns }: Props) {
  const [accountId, setAccountId] = useState<string>("all");
  const [active, setActive] = useState<ReportKey>("ledger");

  const scoped = useMemo(
    () => (accountId === "all" ? txns : txns.filter((t) => t.accountId === accountId)),
    [txns, accountId],
  );

  const data = useMemo(() => buildReport(active, scoped, accounts), [active, scoped, accounts]);
  const meta = REPORTS.find((r) => r.key === active)!;

  function handleExport(fmtKind: "csv" | "excel" | "pdf") {
    if (data.rows.length === 0) return;
    exportAll(`stackwise-${active}`, `Stackwise · ${meta.label}`, data.rows, fmtKind);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Report selector */}
      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial reports</p>
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActive(r.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                active === r.key
                  ? "border-primary bg-primary/5"
                  : "border-border bg-white hover:border-primary/40",
              )}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{r.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report viewer */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-3">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{data.rows.length} row{data.rows.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleExport("pdf")} disabled={data.rows.length === 0}>
              <FileText className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport("excel")} disabled={data.rows.length === 0}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button size="sm" onClick={() => handleExport("csv")} disabled={data.rows.length === 0}>
              <FileDown className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
            <p className="text-[11px] text-muted-foreground">{meta.description}</p>
          </div>
          {data.rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No data for this report.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  {Object.keys(data.rows[0]).map((h) => <TableHead key={h}>{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r, i) => (
                  <TableRow key={i}>
                    {Object.keys(r).map((h) => (
                      <TableCell key={h} className={cn("text-sm", /amount|balance|net|total|in|out/i.test(h) && "font-mono")}>
                        {r[h]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

function buildReport(key: ReportKey, txns: BankTxn[], accounts: BankAccount[]): { rows: ExportRow[] } {
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.accountName ?? "—";

  if (key === "ledger") {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return {
      rows: sorted.map((t) => {
        bal += t.amount;
        return {
          Date: t.date,
          Account: nameOf(t.accountId),
          Reference: t.reference,
          Description: t.description,
          Party: t.party,
          Debit: t.amount < 0 ? Math.abs(t.amount).toLocaleString() : "",
          Credit: t.amount > 0 ? t.amount.toLocaleString() : "",
          Balance: bal.toLocaleString(),
        };
      }),
    };
  }

  if (key === "cashbook") {
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
    return {
      rows: sorted.map((t) => ({
        Date: t.date,
        Account: nameOf(t.accountId),
        Receipts: t.amount > 0 ? t.amount.toLocaleString() : "",
        Payments: t.amount < 0 ? Math.abs(t.amount).toLocaleString() : "",
        Reference: t.reference,
        Details: `${t.description} (${t.party})`,
      })),
    };
  }

  if (key === "cashflow") {
    const map = new Map<string, { in: number; out: number }>();
    for (const t of txns) {
      const m = t.date.slice(0, 7);
      const cur = map.get(m) ?? { in: 0, out: 0 };
      if (t.amount > 0) cur.in += t.amount; else cur.out += Math.abs(t.amount);
      map.set(m, cur);
    }
    return {
      rows: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => ({
        Month: m,
        Inflow: v.in.toLocaleString(),
        Outflow: v.out.toLocaleString(),
        Net: (v.in - v.out).toLocaleString(),
      })),
    };
  }

  if (key === "deposits" || key === "withdrawals") {
    const want = key === "deposits";
    return {
      rows: txns
        .filter((t) => (want ? t.amount > 0 : t.amount < 0))
        .map((t) => ({
          Date: t.date,
          Type: t.subtype ?? "",
          Provider: t.mobileProvider ?? "",
          Reference: t.reference,
          Party: t.party,
          Account: nameOf(t.accountId),
          Amount: Math.abs(t.amount).toLocaleString(),
        })),
    };
  }

  if (key === "reconciliation") {
    return {
      rows: accounts.map((a) => {
        const accTxns = txns.filter((t) => t.accountId === a.id);
        const matched = accTxns.filter((t) => t.reconciled);
        const pending = accTxns.filter((t) => !t.reconciled);
        const reconciledBal = a.openingBalance + matched.reduce((s, t) => s + t.amount, 0);
        return {
          Account: a.accountName,
          Bank: a.bankName,
          "Book balance": fmt(a.currentBalance, a.currency),
          "Reconciled balance": fmt(reconciledBal, a.currency),
          Matched: String(matched.length),
          Pending: String(pending.length),
          Variance: fmt(a.currentBalance - reconciledBal, a.currency),
        };
      }),
    };
  }

  // outstanding
  return {
    rows: txns
      .filter((t) => !t.reconciled && (t.subtype === "cheque" || t.subtype === "transfer"))
      .map((t) => ({
        Date: t.date,
        Type: t.subtype ?? "",
        Reference: t.reference,
        Party: t.party,
        Description: t.description,
        Account: nameOf(t.accountId),
        Amount: fmt(t.amount),
      })),
  };
}

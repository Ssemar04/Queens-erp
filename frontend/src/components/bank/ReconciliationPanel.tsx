import { useMemo, useState } from "react";
import { Check, X, FileSpreadsheet, Wand2, FileDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BankAccount, BankTxn, StatementLine } from "./bank-store";
import { fmt } from "./bank-store";

interface Props {
  accounts: BankAccount[];
  txns: BankTxn[];
  statements: StatementLine[];
  onToggleReconciled: (id: string) => Promise<unknown>;
  onImportSample: (accountId: string) => Promise<unknown>;
}

export function ReconciliationPanel({ accounts, txns, statements, onToggleReconciled, onImportSample }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);

  const accTxns = useMemo(() => txns.filter((t) => t.accountId === accountId), [txns, accountId]);
  const reconciledCount = accTxns.filter((t) => t.reconciled).length;
  const pct = accTxns.length ? Math.round((reconciledCount / accTxns.length) * 100) : 0;

  const bookBalance = useMemo(
    () => (account?.openingBalance ?? 0) + accTxns.reduce((s, t) => s + t.amount, 0),
    [account, accTxns],
  );
  const reconciledBalance = useMemo(
    () => (account?.openingBalance ?? 0) + accTxns.filter((t) => t.reconciled).reduce((s, t) => s + t.amount, 0),
    [account, accTxns],
  );
  const variance = bookBalance - reconciledBalance;

  const accStatements = useMemo(
    () => statements.filter((s) => s.accountId === accountId).sort((a, b) => a.date.localeCompare(b.date)),
    [statements, accountId],
  );

  const statementTotals = useMemo(() => {
    const credits = accStatements.filter((s) => s.amount > 0).reduce((s, t) => s + t.amount, 0);
    const debits = accStatements.filter((s) => s.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const minDate = accStatements[0]?.date ?? "";
    const maxDate = accStatements[accStatements.length - 1]?.date ?? "";
    return { credits, debits, net: credits - debits, count: accStatements.length, minDate, maxDate };
  }, [accStatements]);

  function openStatementPdf(autoPrint: boolean) {
    if (!account || accStatements.length === 0) {
      toast.error("No imported statement lines to export for this account");
      return;
    }
    const w = window.open("", "_blank", "width=980,height=820");
    if (!w) {
      toast.error("Please allow pop-ups to view the statement PDF");
      return;
    }

    const style = `
      *{box-sizing:border-box}
      body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0;padding:36px 44px;color:#0b1733;background:#ffffff}
      .brand{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #003399;padding-bottom:16px;margin-bottom:22px}
      .brand h1{font-size:20px;font-weight:700;margin:0;color:#003399;letter-spacing:.02em}
      .brand .sub{font-size:11px;color:#64748b;margin-top:4px}
      .brand .stamp{text-align:right;font-size:10px;color:#64748b;line-height:1.5}
      .meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:22px}
      .meta .cell{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#f8fafc}
      .meta .cell .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px}
      .meta .cell .val{font-size:13px;font-weight:600;color:#0b1733;font-variant-numeric:tabular-nums}
      .summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:20px}
      .summary .card{border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb}
      .summary .card.cr{background:#ecfdf5;border-color:#a7f3d0}
      .summary .card.dr{background:#fff1f2;border-color:#fecdd3}
      .summary .card.net{background:#eff6ff;border-color:#bfdbfe}
      .summary .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:4px}
      .summary .amt{font-size:18px;font-weight:700;font-family:ui-monospace,"SFMono-Regular",Menlo,monospace}
      .summary .card.cr .amt{color:#047857}
      .summary .card.dr .amt{color:#b91c1c}
      .summary .card.net .amt{color:#1d4ed8}
      h2.section{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#003399;margin:4px 0 10px;padding-bottom:6px;border-bottom:1px dashed #cbd5e1;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#0b1733;color:#ffffff;padding:9px 10px;text-align:left;font-weight:600;border:1px solid #0b1733;font-size:10px;letter-spacing:.04em;text-transform:uppercase}
      th.r{text-align:right}
      td{padding:7px 10px;border:1px solid #e5e7eb;vertical-align:top;line-height:1.45}
      td.r{text-align:right;font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-variant-numeric:tabular-nums}
      tr:nth-child(even) td{background:#f8fafc}
      tr.cr td.r{color:#047857;font-weight:600}
      tr.dr td.r{color:#b91c1c;font-weight:600}
      .foot{margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#64748b}
      .ref{font-family:ui-monospace,"SFMono-Regular",Menlo,monospace;font-size:10px;color:#475569}
      @media print{
        body{padding:18px 20px}
        .meta .cell,.summary .card{break-inside:avoid}
      }
    `;

    const rows = accStatements.map((s, i) => {
      const isCr = s.amount > 0;
      const credit = isCr ? `<td class="r">${fmt(s.amount, account.currency)}</td><td class="r">—</td>` : `<td class="r">—</td><td class="r">${fmt(Math.abs(s.amount), account.currency)}</td>`;
      return `<tr class="${isCr ? "cr" : "dr"}">
        <td style="width:18%">${s.date}</td>
        <td class="ref" style="width:18%">${s.reference || "—"}</td>
        <td>${s.description || "—"}</td>
        ${credit}
      </tr>`;
    }).join("");

    const periodText = statementTotals.minDate && statementTotals.maxDate
      ? `${statementTotals.minDate} → ${statementTotals.maxDate}`
      : "As imported";

    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>Bank Statement · ${account.accountName}</title>
      <style>${style}</style></head><body>
      <div class="brand">
        <div>
          <h1>QUEENSTECH ERP · BANK STATEMENT</h1>
          <div class="sub">Imported statement reconciliation report</div>
        </div>
        <div class="stamp">
          Generated<br/>
          <strong>${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</strong>
        </div>
      </div>

      <div class="meta">
        <div class="cell">
          <div class="lbl">Account name</div>
          <div class="val">${account.accountName}</div>
        </div>
        <div class="cell">
          <div class="lbl">Bank · Branch</div>
          <div class="val">${account.bankName}${account.branch ? ` · ${account.branch}` : ""}</div>
        </div>
        <div class="cell">
          <div class="lbl">Account number · Currency</div>
          <div class="val">${account.accountNumber || "—"} · ${account.currency}</div>
        </div>
        <div class="cell">
          <div class="lbl">Statement period</div>
          <div class="val">${periodText}</div>
        </div>
        <div class="cell">
          <div class="lbl">Lines imported</div>
          <div class="val">${statementTotals.count} line${statementTotals.count === 1 ? "" : "s"}</div>
        </div>
        <div class="cell">
          <div class="lbl">Book balance (ERP)</div>
          <div class="val">${fmt(bookBalance, account.currency)}</div>
        </div>
      </div>

      <div class="summary">
        <div class="card cr">
          <div class="lbl">Total credits (inflows)</div>
          <div class="amt">${fmt(statementTotals.credits, account.currency)}</div>
        </div>
        <div class="card dr">
          <div class="lbl">Total debits (outflows)</div>
          <div class="amt">${fmt(statementTotals.debits, account.currency)}</div>
        </div>
        <div class="card net">
          <div class="lbl">Net movement</div>
          <div class="amt">${fmt(statementTotals.net, account.currency)}</div>
        </div>
      </div>

      <h2 class="section">Statement line items</h2>
      <table>
        <thead>
          <tr>
            <th style="width:18%">Date</th>
            <th style="width:18%">Reference</th>
            <th>Description</th>
            <th class="r" style="width:16%">Credit</th>
            <th class="r" style="width:16%">Debit</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="foot">
        <span>Queenstech ERP · Bank Reconciliation Module</span>
        <span>Document is auto-generated — please review against official bank statement.</span>
      </div>

      <script>window.onload = () => { ${autoPrint ? "window.focus(); window.print();" : ""} };</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.accountName} · {a.bankName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!accountId}
            onClick={async () => {
              try {
                await onImportSample(accountId);
                toast.success("Sample statement imported");
              } catch {
                toast.error("Could not import statement");
              }
            }}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Import statement
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={accStatements.length === 0}
            onClick={() => openStatementPdf(false)}
            className="gap-1.5"
          >
            <Eye className="h-4 w-4" /> View PDF
          </Button>
          <Button
            size="sm"
            disabled={accStatements.length === 0}
            onClick={() => openStatementPdf(true)}
            className="gap-1.5 bg-[#003399] hover:bg-[#002b80]"
          >
            <FileDown className="h-4 w-4" /> Save as PDF
          </Button>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Reconciliation progress</p>
          <div className="mt-1 flex items-center gap-3">
            <Progress value={pct} className="w-40" />
            <span className="font-mono text-sm font-semibold">{pct}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Book balance" value={fmt(bookBalance, account?.currency)} />
        <Stat label="Reconciled balance" value={fmt(reconciledBalance, account?.currency)} />
        <Stat label="Variance" value={fmt(variance, account?.currency)} highlight={variance !== 0} />
      </div>

      {/* Reconciliation table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="w-10" />
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accTxns.map((t) => (
              <TableRow key={t.id} className={cn(t.reconciled && "bg-emerald-50/30")}>
                <TableCell>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onToggleReconciled(t.id);
                      } catch {
                        toast.error("Could not update reconciliation");
                      }
                    }}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                      t.reconciled ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-white text-transparent hover:border-primary",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.date}</TableCell>
                <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                <TableCell className="text-sm">{t.description} <span className="text-muted-foreground">· {t.party}</span></TableCell>
                <TableCell className={cn("text-right font-mono text-sm font-semibold", t.amount > 0 ? "text-emerald-600" : "text-destructive")}>
                  {fmt(t.amount, account?.currency)}
                </TableCell>
                <TableCell>
                  {t.reconciled ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"><Check className="mr-1 h-3 w-3" /> Matched</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {accTxns.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No transactions for this account.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Statement preview */}
      {accStatements.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wand2 className="h-4 w-4" /> Imported statement lines
              </h3>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-[11px]">
                  {fmt(statementTotals.credits, account?.currency)} in
                </Badge>
                <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 text-[11px]">
                  {fmt(statementTotals.debits, account?.currency)} out
                </Badge>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[11px]">
                  {statementTotals.count} lines
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openStatementPdf(false)}
                className="gap-1.5 h-8 text-xs"
              >
                <Eye className="h-3.5 w-3.5" /> View PDF
              </Button>
              <Button
                size="sm"
                onClick={() => openStatementPdf(true)}
                className="gap-1.5 h-8 text-xs bg-[#003399] hover:bg-[#002b80]"
              >
                <FileDown className="h-3.5 w-3.5" /> Save PDF
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accStatements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm text-muted-foreground">{s.date}</TableCell>
                    <TableCell className="font-mono text-xs">{s.reference}</TableCell>
                    <TableCell className="text-sm">{s.description}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", s.amount > 0 ? "text-emerald-600" : "text-destructive")}>
                      {fmt(s.amount, account?.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white p-4", highlight ? "border-amber-500/40" : "border-border")}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-lg font-semibold", highlight ? "text-amber-600" : "text-foreground")}>{value}</p>
    </div>
  );
}

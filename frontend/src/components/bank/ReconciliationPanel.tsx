import { useMemo, useState } from "react";
import { Check, X, FileSpreadsheet, Wand2 } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-3">
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
      {statements.filter((s) => s.accountId === accountId).length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wand2 className="h-4 w-4" /> Imported statement lines
          </h3>
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
                {statements.filter((s) => s.accountId === accountId).map((s) => (
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

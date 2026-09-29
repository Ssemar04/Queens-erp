import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Search, Pencil, Copy, Trash2, CheckCircle2, XCircle, Send, Paperclip, ShieldAlert } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import type { Expense, ExpenseStatus } from "./expenses-store";

const STATUS_TONE: Record<ExpenseStatus, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
  reimbursed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  paid: "bg-sky-100 text-sky-800 border-sky-200",
};

interface Props {
  title?: string;
  expenses: Expense[];
  onAdd?: () => void;
  onEdit: (e: Expense) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
  onSubmitForApproval: (id: string) => void;
  onReimburse?: (id: string) => void;
}

export function ExpensesTable({ title, expenses, onAdd, onEdit, onDuplicate, onRemove, onDecide, onSubmitForApproval, onReimburse }: Props) {
  const { isAdmin, isManager } = useRole();
  const canDecide = isAdmin || isManager;

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [employee, setEmployee] = useState<string>("all");

  const employees = useMemo(() => Array.from(new Set(expenses.map((e) => e.employee))).sort(), [expenses]);

  const rows = useMemo(() => {
    return expenses
      .filter((e) => status === "all" || e.status === status)
      .filter((e) => employee === "all" || e.employee === employee)
      .filter((e) => {
        if (!q) return true;
        const t = q.toLowerCase();
        return (e.reference ?? "").toLowerCase().includes(t)
          || (e.employee ?? "").toLowerCase().includes(t)
          || (e.description ?? "").toLowerCase().includes(t);
      });
  }, [expenses, status, employee, q]);

  const total = rows.reduce((s, e) => s + e.amount, 0);

  const clear = () => { setQ(""); setStatus("all"); setEmployee("all"); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {title && <h2 className="mr-auto text-base font-semibold">{title}</h2>}
        {onAdd && <Button onClick={onAdd} className="gap-1.5"><Plus className="h-4 w-4" /> New expense</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, staff, description…" className="w-64 bg-white pl-8" />
        </div>
        <Select value={employee} onValueChange={setEmployee}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {employees.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted · approvals</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="reimbursed">Reimbursed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No expenses match these filters.</TableCell></TableRow>
            ) : rows.map((e, i) => {
              return (
                <TableRow
                  key={e.id}
                  className="text-sm transition-all hover:bg-muted/40"
                >
                  <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                  <TableCell className="font-mono text-xs">{e.date}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{e.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-medium">{e.employee}</TableCell>
                  <TableCell className="text-right font-mono">{e.currency} {e.amount.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_TONE[e.status]}>{e.status}</Badge></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(e)}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(e.id)}><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                        {e.status === "draft" && <DropdownMenuItem onClick={() => onSubmitForApproval(e.id)}><Send className="mr-2 h-3.5 w-3.5" /> Submit</DropdownMenuItem>}
                        {e.status === "submitted" && canDecide && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDecide(e.id, "approved")} className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700"><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDecide(e.id, "rejected")} className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"><XCircle className="mr-2 h-3.5 w-3.5" /> Reject</DropdownMenuItem>
                          </>
                        )}
                        {e.status === "submitted" && !canDecide && (
                          <DropdownMenuItem disabled className="text-xs text-muted-foreground opacity-70"><ShieldAlert className="mr-2 h-3.5 w-3.5" /> Approval restricted to Admin/Manager</DropdownMenuItem>
                        )}
                        {onReimburse && e.status === "approved" && canDecide && (
                          <DropdownMenuItem onClick={() => onReimburse(e.id)}><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark reimbursed</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onRemove(e.id)} className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
          <span className="font-mono font-semibold">Total · UGX {total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

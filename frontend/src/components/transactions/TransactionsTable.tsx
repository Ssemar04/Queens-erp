import { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  MoreHorizontal,
  Eye,
  Printer,
  Ban,
  Search,
  Boxes,
  User,
  CreditCard,
  CalendarClock,
  Share2,
  FileText,
  Image as ImageIcon,
  Download,
  Copy,
  ChevronDown,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/ThemeContext";
import { useBranch } from "@/contexts/BranchContext";
import { useRole } from "@/hooks/useRole";
import { getReceiptSummary, printReceipt } from "@/components/transactions/receipt-printer";
import { exportReceipt } from "@/components/transactions/receipt-exporter";
import { format } from "date-fns";
import type { StockMovement, TransactionStatus } from "@/types/inventory";
import type { GroupedTransaction } from "@/routes/app.movements";

interface Props {
  transactions: GroupedTransaction[];
  itemNameMap: Map<string, string>;
  initialQuery?: string;
  onUpdateStatus?: (receiptNumber: string, status: TransactionStatus) => Promise<void> | void;
  onDeleteTransaction?: (receiptNumber: string) => Promise<void> | void;
}

export function getLastName(name: string): string {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

const TRANSACTION_STATUSES: TransactionStatus[] = ["paid", "partial", "pending", "void"];

const PER_PAGE = 25;

const STATUS_STYLES: Record<TransactionStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  pending: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  void: "bg-red-500/10 text-red-600 border-red-500/20",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile: "Mobile",
  bank_transfer: "Bank",
  credit: "Credit",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(n || 0);

const hasBalance = (n: number) => n > 0;

type RangeFilter = "any" | "zero" | "positive";

function StatusEditor({
  currentStatus,
  isSmall = false,
}: {
  receipt?: string;
  currentStatus: TransactionStatus;
  disabled?: boolean;
  onUpdate?: (receipt: string, status: TransactionStatus) => Promise<void> | void;
  isSmall?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={`${STATUS_STYLES[currentStatus] || STATUS_STYLES.pending} capitalize ${
        isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {currentStatus}
    </Badge>
  );
}

export function TransactionsTable({ transactions, itemNameMap, initialQuery = "", onUpdateStatus, onDeleteTransaction }: Props) {
  const { isAdmin } = useRole();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState(initialQuery);
  const [customer, setCustomer] = useState("all");
  const [staff, setStaff] = useState("all");
  const [status, setStatus] = useState("all");
  const [itemId, setItemId] = useState("all");
  const [balance, setBalance] = useState<RangeFilter>("any");
  const [receiptTarget, setReceiptTarget] = useState<GroupedTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupedTransaction | null>(null);
  const [updatingReceipt, setUpdatingReceipt] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const { branches, selectedBranch } = useBranch();

  const resolveBranch = (t: GroupedTransaction) => {
    const m = t.movements[0];
    const locId = m?.toLocationId || m?.fromLocationId || m?.toBranchId || m?.fromBranchId;
    if (locId && branches.length > 0) {
      const found = branches.find((b) => b.id === locId);
      if (found) return found;
    }
    return selectedBranch;
  };

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  const customers = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.customer))).sort(),
    [transactions],
  );
  const staffList = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.staff))).sort(),
    [transactions],
  );
  const itemOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const t of transactions) {
      for (const m of t.movements) {
        const name = itemNameMap.get(m.itemId) ?? m.sale?.itemName ?? "Unknown";
        const id = m.itemId || `manual:${name}`;
        map.set(id, { id, name });
      }
    }
    return Array.from(map.values());
  }, [transactions, itemNameMap]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (customer !== "all" && t.customer !== customer) return false;
      if (staff !== "all" && t.staff !== staff) return false;
      if (status !== "all" && t.status !== status) return false;
      if (balance === "zero" && t.balance !== 0) return false;
      if (balance === "positive" && t.balance <= 0) return false;
      if (itemId !== "all") {
        const containsItem = t.movements.some((m) => {
          const name = itemNameMap.get(m.itemId) ?? m.sale?.itemName ?? "";
          const key = m.itemId || `manual:${name}`;
          return key === itemId;
        });
        if (!containsItem) return false;
      }
      if (q.trim()) {
        const needle = q.toLowerCase();
        const items = t.movements.map((m) => itemNameMap.get(m.itemId) ?? m.sale?.itemName ?? "").join(" ");
        const assets = t.movements.map((m) => m.sale?.assetName ?? "").join(" ");
        return [t.receiptNumber, t.customer, t.staff, items, assets, t.saleDetails?.telephone ?? "", t.saleDetails?.email ?? ""].some((v) =>
          v?.toLowerCase().includes(needle),
        );
      }
      return true;
    });
  }, [transactions, customer, staff, status, itemId, balance, q, itemNameMap]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = sorted.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  const clearFilters = () => {
    setQ(""); setCustomer("all"); setStaff("all"); setStatus("all");
    setItemId("all"); setBalance("any"); setPage(0);
  };

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receipt, customer, item, asset…" className="bg-white pl-8" />
      </div>
      <Select value={customer} onValueChange={setCustomer}>
        <SelectTrigger className="w-[150px] bg-white"><SelectValue placeholder="Customer" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All customers</SelectItem>
          {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={staff} onValueChange={setStaff}>
        <SelectTrigger className="w-[140px] bg-white"><SelectValue placeholder="Staff" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All staff</SelectItem>
          {staffList.map((s) => <SelectItem key={s} value={s}>{getLastName(s)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={itemId} onValueChange={setItemId}>
        <SelectTrigger className="w-[150px] bg-white"><SelectValue placeholder="Item" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All items</SelectItem>
          {itemOptions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[120px] bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partial</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="void">Void</SelectItem>
        </SelectContent>
      </Select>
      <Select value={balance} onValueChange={(v) => setBalance(v as RangeFilter)}>
        <SelectTrigger className="w-[130px] bg-white"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any balance</SelectItem>
          <SelectItem value="positive">Outstanding</SelectItem>
          <SelectItem value="zero">Settled</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No transactions recorded
      </p>
    );
  }

  const pagination = (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {sorted.length === 0 ? 0 : safePage * PER_PAGE + 1}–
        {Math.min((safePage + 1) * PER_PAGE, sorted.length)} of {sorted.length}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage(safePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        {filterBar}
        <div className="space-y-3">
          {paged.map((t) => {
            const r = getReceiptSummary(t, itemNameMap);
            return (
              <Card
                key={t.receiptNumber}
                className="cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[inset_3px_0_0_rgba(0,51,153,0.5),0_4px_20px_-8px_rgba(0,0,0,0.1)] hover:border-[#003399]/30"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button")) return;
                  setReceiptTarget(t);
                }}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 text-primary p-1.5">
                        <Receipt className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{r.receipt}</p>
                        <p className="text-sm font-medium">{r.item}</p>
                        {r.assets.length > 0 && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Boxes className="h-3 w-3" />{r.assets.join(", ")}</p>}
                      </div>
                    </div>
                  </div>
                  <StatusEditor
                    receipt={r.receipt}
                    currentStatus={r.status}
                    disabled={updatingReceipt !== null && updatingReceipt !== r.receipt}
                    onUpdate={onUpdateStatus ? async (receipt, status) => {
                      try {
                        setUpdatingReceipt(receipt);
                        await onUpdateStatus(receipt, status);
                      } finally {
                        setUpdatingReceipt(null);
                      }
                    } : undefined}
                    isSmall
                  />
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="text-muted-foreground">Qty</div>
                    <div className="text-right font-mono">{r.qty}</div>
                    <div className="text-muted-foreground">Total</div>
                    <div className="text-right font-mono font-medium">{fmtMoney(r.total)}</div>
                    {hasBalance(r.balance) && (
                      <>
                        <div className="text-muted-foreground">Balance</div>
                        <div className="text-right font-mono text-amber-600">{fmtMoney(r.balance)}</div>
                      </>
                    )}
                    <div className="text-muted-foreground">Method</div>
                    <div className="text-right">{METHOD_LABEL[r.method] ?? r.method}</div>
                    <div className="text-muted-foreground">Customer</div>
                    <div className="text-right">{r.customer}</div>
                    <div className="text-muted-foreground">Staff</div>
                    <div className="text-right">{getLastName(r.staff)}</div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => setReceiptTarget(t)}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1 text-xs">
                          <Share2 className="h-3.5 w-3.5 text-emerald-600" /> Share
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-white">
                        <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "pdf", "share", resolveBranch(t))}>
                          <FileText className="mr-2 h-4 w-4 text-red-500" /> Share as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "image", "share", resolveBranch(t))}>
                          <ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> Share as Image
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "pdf", "download", resolveBranch(t))}>
                          <Download className="mr-2 h-4 w-4 text-slate-500" /> Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "image", "download", resolveBranch(t))}>
                          <Download className="mr-2 h-4 w-4 text-slate-500" /> Download Image
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => printReceipt(t, itemNameMap, settings.companyDetails, resolveBranch(t))}>
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Button>
                    {isAdmin && onDeleteTransaction && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive hover:bg-red-50 border-destructive/20" onClick={() => setDeleteTarget(t)} title="Delete sale">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {pagination}
        <ReceiptDialog
          transaction={receiptTarget}
          itemNameMap={itemNameMap}
          onUpdateStatus={onUpdateStatus}
          updatingReceipt={updatingReceipt}
          setUpdatingReceipt={setUpdatingReceipt}
          onOpenChange={(open) => {
            if (!open) setReceiptTarget(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filterBar}
      <div className="overflow-x-auto rounded-md border border-border bg-white">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-[140px]">Receipt #</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Assets</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead className="w-[110px] text-right">Total</TableHead>
              <TableHead className="w-[110px] text-right">Balance</TableHead>
              <TableHead className="w-[100px]">Method</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="w-[120px]">Staff</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[90px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">No transactions match these filters.</TableCell></TableRow>
            ) : paged.map((t) => {
              const r = getReceiptSummary(t, itemNameMap);
              return (
                <TableRow
                  key={t.receiptNumber}
                  className="group hover:bg-muted/40 cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[inset_2px_0_0_rgba(0,51,153,0.5)]"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest('[role="menuitem"]') || target.closest('[data-dialog-close]')) {
                      return;
                    }
                    setReceiptTarget(t);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="group-hover:bg-[#003399]/15 group-hover:text-[#003399] rounded-md bg-primary/10 text-primary p-1 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
                        <Receipt className="h-3.5 w-3.5" />
                      </span>
                      <div className="leading-tight">
                        <div className="font-mono text-xs">{r.receipt}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {format(new Date(r.time), "MMM d, HH:mm")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{r.itemSummary}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.assets.length > 0 ? (
                      <span className="inline-flex items-center gap-1"><Boxes className="h-3 w-3" />{r.assets.join(", ")}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.qty}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {fmtMoney(r.total)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      hasBalance(r.balance) ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {hasBalance(r.balance) ? fmtMoney(r.balance) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {METHOD_LABEL[r.method] ?? r.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getLastName(r.staff)}</TableCell>
                  <TableCell>
                    <StatusEditor
                      receipt={r.receipt}
                      currentStatus={r.status}
                      disabled={updatingReceipt !== null && updatingReceipt !== r.receipt}
                      onUpdate={onUpdateStatus ? async (receipt, status) => {
                        try {
                          setUpdatingReceipt(receipt);
                          await onUpdateStatus(receipt, status);
                        } finally {
                          setUpdatingReceipt(null);
                        }
                      } : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-[#003399] hover:bg-[#003399]/8"
                        title="View receipt"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReceiptTarget(t);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Download receipt"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white">
                          <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "pdf", "download", resolveBranch(t))}>
                            <FileText className="mr-2 h-4 w-4 text-red-500" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportReceipt(t, itemNameMap, settings.companyDetails, "image", "download", resolveBranch(t))}>
                            <ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> Download Image
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-white">
                          <DropdownMenuItem onSelect={() => setReceiptTarget(t)}>
                            <Eye className="mr-2 h-4 w-4" /> View receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => printReceipt(t, itemNameMap, settings.companyDetails, resolveBranch(t))}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => exportReceipt(t, itemNameMap, settings.companyDetails, "pdf", "share", resolveBranch(t))}>
                            <FileText className="mr-2 h-4 w-4 text-red-500" /> Share as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => exportReceipt(t, itemNameMap, settings.companyDetails, "image", "share", resolveBranch(t))}>
                            <ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> Share as Image
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={!isAdmin || !onUpdateStatus || r.status === "void" || (updatingReceipt !== null && updatingReceipt !== r.receipt)}
                            onSelect={async () => {
                              if (onUpdateStatus) {
                                try {
                                  setUpdatingReceipt(r.receipt);
                                  await onUpdateStatus(r.receipt, "void");
                                } finally {
                                  setUpdatingReceipt(null);
                                }
                              }
                            }}
                          >
                            <Ban className="mr-2 h-4 w-4" /> Void
                          </DropdownMenuItem>
                          {isAdmin && onDeleteTransaction && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive font-medium"
                                onSelect={() => setDeleteTarget(t)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete sale
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pagination}
      <ReceiptDialog
        transaction={receiptTarget}
        itemNameMap={itemNameMap}
        onUpdateStatus={onUpdateStatus}
        updatingReceipt={updatingReceipt}
        setUpdatingReceipt={setUpdatingReceipt}
        onOpenChange={(open) => {
          if (!open) setReceiptTarget(null);
        }}
      />
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Delete sale transaction?
            </DialogTitle>
            <DialogDescription className="pt-2 text-slate-600">
              Are you sure you want to delete transaction <strong className="font-mono text-slate-900">{deleteTarget?.receiptNumber}</strong>?
              <br /><br />
              This action will permanently delete the transaction record and <strong className="text-slate-900">restore inventory stock levels</strong> for all items in this sale.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end pt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (deleteTarget && onDeleteTransaction) {
                  try {
                    setIsDeleting(true);
                    await onDeleteTransaction(deleteTarget.receiptNumber);
                    setDeleteTarget(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Delete sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptDialog({
  transaction,
  itemNameMap,
  onUpdateStatus,
  updatingReceipt,
  setUpdatingReceipt,
  onOpenChange,
}: {
  transaction: GroupedTransaction | null;
  itemNameMap: Map<string, string>;
  onUpdateStatus?: (receiptNumber: string, status: TransactionStatus) => Promise<void> | void;
  updatingReceipt: string | null;
  setUpdatingReceipt: (receipt: string | null) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings } = useSettings();
  const { branches, selectedBranch } = useBranch();

  const resolveBranch = (t: GroupedTransaction) => {
    const m = t.movements[0];
    const locId = m?.toLocationId || m?.fromLocationId || m?.toBranchId || m?.fromBranchId;
    if (locId && branches.length > 0) {
      const found = branches.find((b) => b.id === locId);
      if (found) return found;
    }
    return selectedBranch;
  };

  const r = transaction ? getReceiptSummary(transaction, itemNameMap) : null;
  const subtotal = r ? r.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0) : 0;
  const totalDiscount = r ? r.lineItems.reduce((s, li) => s + li.discount, 0) : 0;
  const totalVat = r ? r.lineItems.reduce((s, li) => s + li.vat, 0) : 0;

  return (
    <Dialog open={!!transaction} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(94vw,560px)] overflow-y-auto p-0">
        {r && transaction && (
          <>
            <div className="bg-foreground px-6 py-5 text-background">
              <DialogHeader>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-background/10">
                    <Receipt className="h-5 w-5" />
                  </span>
                  <StatusEditor
                    receipt={r.receipt}
                    currentStatus={r.status}
                    disabled={updatingReceipt !== null && updatingReceipt !== r.receipt}
                    onUpdate={onUpdateStatus ? async (receipt, status) => {
                      try {
                        setUpdatingReceipt(receipt);
                        await onUpdateStatus(receipt, status);
                      } finally {
                        setUpdatingReceipt(null);
                      }
                    } : undefined}
                  />
                </div>
                <DialogTitle className="font-mono text-xl">{r.receipt}</DialogTitle>
                <DialogDescription className="text-background/70">
                  Queenstech ERP sales receipt
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <ReceiptMeta icon={CalendarClock} label="Served" value={format(new Date(r.time), "MMM d, yyyy HH:mm")} />
                <ReceiptMeta icon={User} label="Customer" value={r.customer} />
                <ReceiptMeta icon={CreditCard} label="Payment" value={METHOD_LABEL[r.method] ?? r.method} />
              </div>

              <div className="rounded-md border border-border">
                <div className="grid grid-cols-[1fr_64px_96px] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Amount</span>
                </div>
                {r.lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_64px_96px] gap-3 px-3 py-3 text-sm last:border-b-0 border-b border-border last:pb-3">
                    <div>
                      <p className="font-medium">{li.itemName}</p>
                      {li.assetName && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Boxes className="h-3 w-3" /> {li.assetName}
                        </p>
                      )}
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{fmtMoney(li.unitPrice)} each</p>
                    </div>
                    <span className="text-right font-mono">{li.quantity}</span>
                    <span className="text-right font-mono font-medium">{fmtMoney(li.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-md bg-muted/40 p-4">
                <ReceiptLine label="Subtotal" value={fmtMoney(subtotal)} />
                {totalDiscount > 0 && <ReceiptLine label="Discount" value={fmtMoney(totalDiscount)} />}
                {totalVat > 0 && <ReceiptLine label="VAT" value={fmtMoney(totalVat)} />}
                <ReceiptLine label="Total" value={fmtMoney(r.total)} strong />
                {hasBalance(r.balance) && <ReceiptLine label="Balance" value={fmtMoney(r.balance)} tone="amber" />}
                <ReceiptLine label="Change" value={fmtMoney(r.lineItems.length > 0 && transaction.saleDetails?.changeDue ? transaction.saleDetails.changeDue : 0)} />
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <ReceiptPlain label="Staff" value={getLastName(r.staff)} />
                <ReceiptPlain label="Reference" value={r.reference} />
                {r.telephone && <ReceiptPlain label="Telephone" value={r.telephone} />}
                {r.email && <ReceiptPlain label="Email" value={r.email} />}
              </div>
            </div>

            <DialogFooter className="border-t border-border px-6 py-4 flex flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 text-slate-700 hover:bg-slate-100" title="Quick download receipt">
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white">
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "pdf", "download", resolveBranch(transaction))}>
                      <FileText className="mr-2 h-4 w-4 text-red-500" /> Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "image", "download", resolveBranch(transaction))}>
                      <ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> Download Image
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50">
                      <Share2 className="h-4 w-4 text-emerald-600" />
                      Share receipt
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-white">
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "pdf", "share", resolveBranch(transaction))}>
                      <FileText className="mr-2 h-4 w-4 text-red-500" /> Share as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "image", "share", resolveBranch(transaction))}>
                      <ImageIcon className="mr-2 h-4 w-4 text-blue-500" /> Share as Image
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "pdf", "download", resolveBranch(transaction))}>
                      <Download className="mr-2 h-4 w-4 text-slate-500" /> Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "image", "download", resolveBranch(transaction))}>
                      <Download className="mr-2 h-4 w-4 text-slate-500" /> Download Image
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportReceipt(transaction, itemNameMap, settings.companyDetails, "image", "copy", resolveBranch(transaction))}>
                      <Copy className="mr-2 h-4 w-4 text-slate-500" /> Copy Image
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button className="gap-1.5" onClick={() => printReceipt(transaction, itemNameMap, settings.companyDetails, resolveBranch(transaction))}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceiptMeta({ icon: Icon, label, value }: { icon: typeof Receipt; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

function ReceiptLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "emerald" | "amber" | "muted";
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "border-t border-border pt-2 text-base font-semibold" : "text-sm"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-mono ${
          tone === "emerald"
            ? "text-emerald-600"
            : tone === "amber"
            ? "text-amber-600"
            : tone === "muted"
            ? "text-muted-foreground"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ReceiptPlain({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

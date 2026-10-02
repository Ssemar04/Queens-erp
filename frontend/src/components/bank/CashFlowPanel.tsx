import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Banknote, FileText, Smartphone, Search, Paperclip, Upload, Eye, X, Check, User, Pencil, CalendarDays, Building2, CheckCircle2, StickyNote, Hash, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BankAccount, BankTxn, DepositType, WithdrawalType, MobileProvider, ReceiptAttachment, TxnComment } from "./bank-store";
import { fmt } from "./bank-store";
import { useCustomers, type Customer } from "@/components/customers/customers-store";
import { useEmployees } from "@/components/employees/employees-store";
import { useAuth } from "@/hooks/useAuth";
import { useBranch } from "@/contexts/BranchContext";
import { useRole } from "@/hooks/useRole";


type Direction = "deposit" | "withdrawal";

const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function customerSearchText(customer: Customer) {
  return compact([
    customer.reference,
    customer.name,
    customer.email,
    customer.phone,
    customer.contactPerson,
    customer.taxId,
  ].filter(Boolean).join(" "));
}

interface Props {
  direction: Direction;
  accounts: BankAccount[];
  txns: BankTxn[];
  onAdd: (t: Omit<BankTxn, "id" | "createdAt" | "reconciled">) => Promise<unknown>;
  onUpdate?: (id: string, patch: Partial<BankTxn>) => Promise<unknown>;
}

const DEPOSIT_TYPES: { value: DepositType; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "cheque", label: "Cheque", icon: FileText },
  { value: "mobile_money", label: "Mobile money", icon: Smartphone },
];
const MOBILE_PROVIDERS: MobileProvider[] = ["Airtel Mobile Money", "MTN Mobile Money"];
const WITHDRAWAL_TYPES: { value: WithdrawalType; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "cheque", label: "Cheque", icon: FileText },
  { value: "transfer", label: "Bank transfer", icon: FileText },
  { value: "mobile_money", label: "Mobile money", icon: Smartphone },
];

export function CashFlowPanel({ direction, accounts, txns, onAdd, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<ReceiptAttachment | null>(null);
  const [previewTxn, setPreviewTxn] = useState<BankTxn | null>(null);
  const [editingTxn, setEditingTxn] = useState<BankTxn | null>(null);
  const [q, setQ] = useState("");
  const isDeposit = direction === "deposit";
  const { isAdmin, isManager } = useRole();
  const canEdit = Boolean(onUpdate) && isAdmin;
  const columnCount = 9 + (canEdit ? 1 : 0);

  const filtered = useMemo(() => {
    const rel = txns.filter((t) => (isDeposit ? t.amount > 0 : t.amount < 0));
    if (!q) return rel;
    const s = q.toLowerCase();
    return rel.filter((t) =>
      [t.reference, t.party, t.description].some((v) => v.toLowerCase().includes(s)),
    );
  }, [txns, q, isDeposit]);

  const totals = useMemo(() => {
    const all = txns.filter((t) => (isDeposit ? t.amount > 0 : t.amount < 0));
    const total = all.reduce((s, t) => s + Math.abs(t.amount), 0);
    const today = all
      .filter((t) => t.date === new Date().toISOString().slice(0, 10))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const mobile = all.filter((t) => t.subtype === "mobile_money").reduce((s, t) => s + Math.abs(t.amount), 0);
    return { total, today, mobile, count: all.length };
  }, [txns, isDeposit]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Total ${isDeposit ? "deposits" : "withdrawals"}`} value={fmt(totals.total)} />
        <Stat label="Today" value={fmt(totals.today)} />
        <Stat label="Mobile money" value={fmt(totals.mobile)} />
        <Stat label="Entries" value={String(totals.count)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference, party…" className="bg-white pl-9" />
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New {isDeposit ? "deposit" : "withdrawal"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>{isDeposit ? "From" : "To"}</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {canEdit && (
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const acc = accounts.find((a) => a.id === t.accountId);
              return (
                <TableRow
                  key={t.id}
                  onClick={() => setPreviewTxn(t)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <TableCell className="text-sm text-muted-foreground">{t.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1 capitalize">
                      {t.subtype === "mobile_money" ? <Smartphone className="h-3 w-3" /> : t.subtype === "cheque" ? <FileText className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                      {t.subtype?.replace("_", " ")}
                      {t.mobileProvider ? ` · ${t.mobileProvider}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="text-sm">{t.party}</TableCell>
                  <TableCell className="text-xs">
                    {t.performedBy ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <User className="h-3 w-3" />
                        {t.performedBy}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{t.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{acc?.accountName ?? "—"}</TableCell>
                  <TableCell>
                    {t.attachment ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewAttachment(t.attachment ?? null);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted"
                        title={t.attachment.name}
                      >
                        <Paperclip className="h-3 w-3" />
                        view
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-sm font-semibold", isDeposit ? "text-emerald-600" : "text-destructive")}>
                    {fmt(t.amount, acc?.currency)}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTxn(t);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                        title="Edit deposit"
                        aria-label="Edit deposit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={columnCount} className="py-12 text-center text-sm text-muted-foreground">No {isDeposit ? "deposits" : "withdrawals"} yet.</TableCell></TableRow>
            )}
          </TableBody>

        </Table>
      </div>

      <CashFlowSheet
        open={open || Boolean(editingTxn)}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(false);
            setEditingTxn(null);
          } else {
            setOpen(true);
          }
        }}
        direction={direction}
        accounts={accounts}
        initial={editingTxn}
        onSubmit={async (t) => {
          const editing = editingTxn;
          try {
            if (editing && onUpdate) {
              await onUpdate(editing.id, t);
              toast.success("Deposit updated");
            } else {
              await onAdd(t);
              toast.success(`${isDeposit ? "Deposit" : "Withdrawal"} recorded`);
            }
            setOpen(false);
            setEditingTxn(null);
            setPreviewTxn(null);
          } catch {
            toast.error(
              editing
                ? "Could not update deposit"
                : `Could not record ${isDeposit ? "deposit" : "withdrawal"}`,
            );
          }
        }}
      />
      <DepositPreviewDialog
        txn={previewTxn}
        account={previewTxn ? accounts.find((a) => a.id === previewTxn.accountId) ?? null : null}
        open={Boolean(previewTxn)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewTxn(null);
        }}
        canEdit={canEdit}
        onEdit={(txn) => {
          setPreviewTxn(null);
          setEditingTxn(txn);
        }}
        onViewAttachment={(attachment) => setPreviewAttachment(attachment)}
        onUpdate={onUpdate}
      />
      <AttachmentPreviewDialog
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewAttachment(null);
        }}
      />
    </div>
  );
}

function DepositPreviewDialog({
  txn: txnProp,
  account: accountProp,
  open,
  onOpenChange,
  canEdit,
  onEdit,
  onViewAttachment,
  onUpdate,
}: {
  txn: BankTxn | null;
  account?: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onEdit: (txn: BankTxn) => void;
  onViewAttachment: (attachment: ReceiptAttachment) => void;
  onUpdate?: (id: string, patch: Partial<BankTxn>) => Promise<unknown>;
}) {
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const [commentText, setCommentText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const last = useRef<{ txn: BankTxn; account: BankAccount | null } | null>(null);
  if (txnProp) last.current = { txn: txnProp, account: accountProp ?? null };
  const view = txnProp ? { txn: txnProp, account: accountProp ?? null } : last.current;

  if (!view) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    );
  }

  const txn = view.txn;
  const account = view.account;
  const isDeposit = txn.amount >= 0;
  const TypeIcon =
    txn.subtype === "mobile_money" ? Smartphone : txn.subtype === "cheque" ? FileText : Banknote;
  const typeLabel = (txn.subtype ?? (isDeposit ? "deposit" : "withdrawal")).replace("_", " ");

  const authorName =
    (user?.user_metadata?.full_name as string) || (user?.email?.split("@")[0]) || "User";
  const userRoleLabel = isAdmin ? "Admin" : isManager ? "Manager" : "Staff";

  async function handleAddComment() {
    if (!commentText.trim() || !onUpdate) return;
    setIsPosting(true);
    try {
      const newComment: TxnComment = {
        id: crypto.randomUUID(),
        author: authorName,
        role: userRoleLabel,
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };
      const existing = txn.comments || [];
      await onUpdate(txn.id, { comments: [...existing, newComment] });
      setCommentText("");
      toast.success("Comment added to transaction");
    } catch {
      toast.error("Could not add comment");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,580px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg",
                isDeposit ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600",
              )}
            >
              <Banknote className="h-4 w-4" />
            </span>
            {isDeposit ? "Deposit details" : "Withdrawal details"}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{txn.reference}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "rounded-xl border border-border p-4",
            isDeposit
              ? "bg-gradient-to-br from-emerald-50 to-white"
              : "bg-gradient-to-br from-rose-50 to-white",
          )}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
          <p
            className={cn(
              "mt-1 font-mono text-3xl font-bold",
              isDeposit ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {fmt(txn.amount, account?.currency)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 capitalize">
              <TypeIcon className="h-3 w-3" />
              {typeLabel}
              {txn.mobileProvider ? ` · ${txn.mobileProvider}` : ""}
            </Badge>
            <Badge variant={txn.reconciled ? "default" : "secondary"} className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {txn.reconciled ? "Reconciled" : "Unreconciled"}
            </Badge>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailRow icon={Hash} label="Reference" value={txn.reference} mono />
          <DetailRow icon={CalendarDays} label="Date" value={txn.date} />
          <DetailRow icon={User} label={isDeposit ? "From (payer)" : "To (payee)"} value={txn.party || "—"} />
          <DetailRow icon={User} label="Staff" value={txn.performedBy || "—"} />
          <DetailRow
            icon={Building2}
            label="Account"
            value={account ? `${account.accountName} · ${account.bankName}` : "—"}
          />
          <DetailRow
            icon={CalendarDays}
            label="Recorded"
            value={txn.createdAt ? new Date(txn.createdAt).toLocaleString() : "—"}
          />
        </dl>

        {txn.description && (
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5" /> Description
            </p>
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
              {txn.description}
            </p>
          </div>
        )}

        {txn.attachment && (
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> Receipt attachment
            </p>
            <div>
              <button
                type="button"
                onClick={() => onViewAttachment(txn.attachment as ReceiptAttachment)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-primary transition-colors hover:bg-muted"
              >
                <Paperclip className="h-4 w-4" />
                <span className="max-w-[280px] truncate">{txn.attachment.name}</span>
                <Eye className="ml-auto h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> Comments & Notes
              {txn.comments && txn.comments.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {txn.comments.length}
                </Badge>
              )}
            </h4>
          </div>

          {txn.comments && txn.comments.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {txn.comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" />
                      {c.author}
                      <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal uppercase">
                        {c.role}
                      </Badge>
                    </span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No comments yet. Managers can add notes or edit requests for the Admin.</p>
          )}

          {onUpdate && (
            <div className="space-y-2 pt-1">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={isManager && !isAdmin ? "Add a comment or edit request for Admin review…" : "Add a note or comment on this transaction…"}
                rows={2}
                className="bg-white text-xs"
              />
              <div className="flex items-center justify-between">
                {!canEdit && isManager && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Only Admin can edit transaction details.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!commentText.trim() || isPosting}
                  onClick={handleAddComment}
                  className="ml-auto gap-1.5 text-xs"
                >
                  <Send className="h-3 w-3" />
                  Post Comment
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => onEdit(txn)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit {isDeposit ? "deposit" : "withdrawal"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
}: {
  attachment: ReceiptAttachment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isImage = attachment?.type.startsWith("image/");
  const isPdf = attachment?.type === "application/pdf" || attachment?.name.toLowerCase().endsWith(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,980px)] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="truncate text-base">{attachment?.name ?? "Attachment preview"}</DialogTitle>
          <DialogDescription>
            {attachment ? `${attachment.type || "File"} · ${formatBytes(attachment.size)}` : "Preview attachment"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(92vh-130px)] min-h-[360px] items-center justify-center overflow-auto bg-muted/30 p-4">
          {attachment && isImage && (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-h-[calc(92vh-170px)] max-w-full rounded-md object-contain shadow-sm"
            />
          )}

          {attachment && isPdf && (
            <iframe
              title={attachment.name}
              src={attachment.dataUrl}
              className="h-[calc(92vh-170px)] min-h-[420px] w-full rounded-md border border-border bg-white"
            />
          )}

          {attachment && !isImage && !isPdf && (
            <div className="max-w-sm rounded-lg border border-border bg-white p-6 text-center shadow-sm">
              <Paperclip className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">{attachment.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">This file type cannot be previewed here.</p>
            </div>
          )}
        </div>

        {attachment && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" size="sm" asChild>
              <a href={attachment.dataUrl} target="_blank" rel="noreferrer">
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Open
              </a>
            </Button>
            <Button size="sm" asChild>
              <a href={attachment.dataUrl} download={attachment.name}>
                Download
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function CashFlowSheet({
  open, onOpenChange, direction, accounts, onSubmit, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  direction: Direction;
  accounts: BankAccount[];
  onSubmit: (t: Omit<BankTxn, "id" | "createdAt" | "reconciled">) => Promise<void>;
  initial?: BankTxn | null;
}) {
  const isDeposit = direction === "deposit";
  const isEditing = Boolean(initial);
  const types = isDeposit ? DEPOSIT_TYPES : WITHDRAWAL_TYPES;
  const { customers, loading: customersLoading } = useCustomers();
  const { employees } = useEmployees();
  const { user } = useAuth();
  const { currentBranchId } = useBranch();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [subtype, setSubtype] = useState<string>(types[0].value);
  const [reference, setReference] = useState("");
  const [party, setParty] = useState("");
  const [partyFocused, setPartyFocused] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState<MobileProvider>(MOBILE_PROVIDERS[0]);
  const [attachment, setAttachment] = useState<ReceiptAttachment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [staff, setStaff] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;

  const activeStaff = useMemo(() => {
    const list = employees.filter((e) => {
      const statusOk = !e.status || e.status.toLowerCase() === "active" || e.status.toLowerCase() === "probation";
      if (!statusOk) return false;
      if (!currentBranchId) return true;
      return e.branchId === currentBranchId || !e.branchId;
    });
    return list;
  }, [employees, currentBranchId]);

  const authenticatedUserName = useMemo(() => {
    const fullName = (user?.user_metadata?.full_name as string) || "";
    const emailPrefix = (user?.email?.split("@")[0]) || "";
    const authEmail = user?.email || "";
    const authUser = employees.find((e) => {
      const eEmail = (e.email || "").toLowerCase().trim();
      const authEm = authEmail.toLowerCase().trim();
      const eName = (e.name || "").toLowerCase().trim();
      const fName = fullName.toLowerCase().trim();
      if (authEm && eEmail && eEmail === authEm) return true;
      if (fName && eName && (eName === fName || eName.includes(fName) || fName.includes(eName))) return true;
      return false;
    });
    return authUser?.name || fullName || emailPrefix || "";
  }, [employees, user]);

  const matchingCustomers = useMemo(() => {
    const query = compact(party);
    if (!query) return customers.slice(0, 6);

    const terms = query.split(" ").filter(Boolean);
    return customers
      .map((customer) => ({ customer, text: customerSearchText(customer) }))
      .filter(({ text }) => terms.every((term) => text.includes(term)))
      .sort((a, b) => {
        const aName = compact(a.customer.name);
        const bName = compact(b.customer.name);
        const aStarts = aName.startsWith(query) ? 0 : 1;
        const bStarts = bName.startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.customer.name.localeCompare(b.customer.name);
      })
      .slice(0, 6)
      .map(({ customer }) => customer);
  }, [customers, party]);

  const showPartyMatches = partyFocused && !selectedCustomer && (party.trim().length > 0 || matchingCustomers.length > 0);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setAccountId(initial.accountId);
      setSubtype(initial.subtype ?? types[0].value);
      setReference(initial.reference ?? "");
      setParty(initial.party ?? "");
      setPartyFocused(false);
      setSelectedCustomerId(initial.customerId ?? null);
      setDescription(initial.description ?? "");
      setAmount(String(Math.abs(initial.amount ?? 0)));
      setDate(initial.date ?? new Date().toISOString().slice(0, 10));
      setProvider((initial.mobileProvider as MobileProvider) ?? MOBILE_PROVIDERS[0]);
      setAttachment(initial.attachment ?? null);
      setPreviewOpen(false);
      setStaff(initial.performedBy || authenticatedUserName || activeStaff[0]?.name || "");
      return;
    }
    setAccountId(accounts[0]?.id ?? "");
    setSubtype(types[0].value);
    setReference("");
    setParty("");
    setPartyFocused(false);
    setSelectedCustomerId(null);
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setProvider(MOBILE_PROVIDERS[0]);
    setAttachment(null);
    setPreviewOpen(false);
    setStaff(authenticatedUserName || activeStaff[0]?.name || "");
  }, [accounts, open, types, authenticatedUserName, activeStaff, initial]);

  function selectCustomerProfile(profile: Customer) {
    setSelectedCustomerId(profile.id);
    setParty(profile.name);
    setPartyFocused(false);
  }

  function clearCustomerProfile() {
    setSelectedCustomerId(null);
    setParty("");
    setPartyFocused(true);
  }

  function updateParty(value: string) {
    setParty(value);
    if (selectedCustomer && value !== selectedCustomer.name) {
      setSelectedCustomerId(null);
    }
  }

  const valid = accountId && reference && party && parseFloat(amount) > 0 && staff.trim().length > 0 && Boolean(attachment);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt too large (max 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: String(reader.result ?? ""),
    });
    reader.readAsDataURL(file);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Edit" : "New"} {isDeposit ? "deposit" : "withdrawal"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update this entry. Account balance and customer records adjust automatically."
              : isDeposit
                ? "Money coming into a bank account."
                : "Money leaving a bank account."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <Field label="Account">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => a.status === "active").map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.accountName} · {a.bankName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {types.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSubtype(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs transition-colors",
                      subtype === t.value
                        ? "border-primary bg-primary/5 text-primary font-semibold"
                        : "border-border bg-white text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {subtype === "mobile_money" && (
            <Field label="Mobile provider">
              <Select value={provider} onValueChange={(v) => setProvider(v as MobileProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOBILE_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Amount"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></Field>
          </div>

          <Field label="Reference"><Input className="font-mono" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="RCP / CHQ / EFT / Mpesa code" /></Field>
          <Field label={isDeposit ? "From (payer)" : "To (payee)"}>
            <div className="relative">
              <Input
                value={party}
                onChange={(e) => updateParty(e.target.value)}
                onFocus={() => setPartyFocused(true)}
                onBlur={() => window.setTimeout(() => setPartyFocused(false), 140)}
                placeholder="Customer or supplier name"
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearCustomerProfile}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border bg-white p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear selected customer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {showPartyMatches && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
                  {customersLoading ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Searching customers...</div>
                  ) : matchingCustomers.length > 0 ? (
                    matchingCustomers.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomerProfile(profile)}
                      >
                        <span>
                          <span className="block font-medium">{profile.name}</span>
                          <span className="block text-xs text-muted-foreground">{profile.reference}{profile.phone ? ` · ${profile.phone}` : ""}</span>
                        </span>
                        <Check className="mt-0.5 h-3.5 w-3.5 text-primary" />
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No matching customers found. You can still type a new name manually.</div>
                  )}
                </div>
              )}
            </div>
            {selectedCustomer ? (
              <p className="text-[11px] text-muted-foreground">
                Linked to {selectedCustomer.reference} · {selectedCustomer.phone || selectedCustomer.email || "customer profile"}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Start typing to select an existing customer, or enter a new name manually.</p>
            )}
          </Field>
          <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional notes" /></Field>

          <Field label="Staff member">
            <Select value={staff} onValueChange={setStaff}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {activeStaff.length > 0 ? activeStaff.map((e) => (
                  <SelectItem key={e.id} value={e.name}>
                    <span className="inline-flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {e.name}
                      <span className="text-[10px] text-muted-foreground">· {e.department || e.role}</span>
                    </span>
                  </SelectItem>
                )) : (
                  <SelectItem value={staff || "System"} disabled={false}>
                    <span className="inline-flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {staff || "System"}
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {authenticatedUserName && staff !== authenticatedUserName && (
              <p className="text-[11px] text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{authenticatedUserName}</span>
              </p>
            )}
          </Field>

          <Field label="Receipt (image or PDF) *">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {attachment ? "Replace receipt" : "Upload receipt"}
              </Button>
              {attachment && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[140px] truncate">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="text-primary hover:underline"
                    title="Preview receipt"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {!attachment && (
              <p className="text-[11px] font-medium text-destructive mt-1">
                A receipt attachment (image or PDF) is mandatory to complete this {isDeposit ? "deposit" : "withdrawal"}.
              </p>
            )}
          </Field>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const amt = parseFloat(amount);
              onSubmit({
                accountId,
                date,
                type: isDeposit ? "deposit" : "withdrawal",
                subtype: subtype as DepositType | WithdrawalType,
                reference: reference.trim(),
                description: description.trim(),
                amount: isDeposit ? amt : -amt,
                party: party.trim(),
                customerId: selectedCustomerId ?? null,
                mobileProvider: subtype === "mobile_money" ? provider : undefined,
                attachment,
                performedBy: staff.trim(),
              });
              setPreviewOpen(false);
              setAttachment(null);
            }}
          >
            {isEditing ? "Save changes" : "Record"}
          </Button>
        </SheetFooter>
      </SheetContent>
      <AttachmentPreviewDialog
        attachment={attachment}
        open={previewOpen && Boolean(attachment)}
        onOpenChange={setPreviewOpen}
      />
    </Sheet>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

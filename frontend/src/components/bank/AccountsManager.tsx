import { useEffect, useState } from "react";
import { Plus, Building2, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BankAccount, Currency } from "./bank-store";
import { fmt } from "./bank-store";

interface Props {
  accounts: BankAccount[];
  onCreate: (a: Omit<BankAccount, "id" | "createdAt" | "color">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<BankAccount>) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}

export function AccountsManager({ accounts, onCreate, onUpdate, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Bank accounts</h2>
          <p className="text-xs text-muted-foreground">
            {accounts.length} configured · {accounts.filter((a) => a.status === "active").length} active
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add account
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead>Account</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>SWIFT</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white", a.color)}>
                      <Building2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{a.accountName}</p>
                      <p className="text-[11px] text-muted-foreground">{a.bankName}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{a.accountNumber}</TableCell>
                <TableCell className="text-sm">{a.branch}</TableCell>
                <TableCell className="font-mono text-xs">{a.swiftCode}</TableCell>
                <TableCell><Badge variant="outline">{a.currency}</Badge></TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(a.openingBalance, a.currency)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{fmt(a.currentBalance, a.currency)}</TableCell>
                <TableCell>
                  <Switch
                    checked={a.status === "active"}
                    onCheckedChange={(v) => onUpdate(a.id, { status: v ? "active" : "inactive" })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(a); setOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={async () => {
                        if (confirm(`Delete ${a.accountName}? Linked transactions will also be removed.`)) {
                          try {
                            await onRemove(a.id);
                            toast.success("Account removed");
                          } catch {
                            toast.error("Could not remove account");
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  No accounts yet — add your first bank wallet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AccountSheet
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSubmit={async (data) => {
          try {
            if (editing) {
              await onUpdate(editing.id, data);
              toast.success("Account updated");
            } else {
              await onCreate(data);
              toast.success("Account added");
            }
            setOpen(false);
          } catch {
            toast.error(editing ? "Could not update account" : "Could not add account");
          }
        }}
      />
    </div>
  );
}

function AccountSheet({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: BankAccount | null;
  onSubmit: (a: Omit<BankAccount, "id" | "createdAt" | "color">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
    branch: "",
    swiftCode: "",
    currency: "UGX" as Currency,
    openingBalance: "0",
    currentBalance: "0",
    status: "active" as "active" | "inactive",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        accountName: initial.accountName,
        accountNumber: initial.accountNumber,
        bankName: initial.bankName,
        branch: initial.branch,
        swiftCode: initial.swiftCode,
        currency: initial.currency,
        openingBalance: String(initial.openingBalance),
        currentBalance: String(initial.currentBalance),
        status: initial.status,
      });
    } else {
      setForm({
        accountName: "", accountNumber: "", bankName: "", branch: "", swiftCode: "",
        currency: "UGX", openingBalance: "0", currentBalance: "0", status: "active",
      });
    }
  }, [open, initial]);

  const valid = form.accountName.trim() && form.accountNumber.trim() && form.bankName.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "Edit account" : "Add bank account"}</SheetTitle>
          <SheetDescription>Holds balances, branch & SWIFT details for reconciliation.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <Row label="Account name"><Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="Operations" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Bank"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Equity Bank" /></Row>
            <Row label="Branch"><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="Westlands" /></Row>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Account number"><Input className="font-mono" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Row>
            <Row label="SWIFT code"><Input className="font-mono" value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value })} placeholder="EQBLKENA" /></Row>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Row label="Currency">
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["UGX", "USD", "EUR", "GBP"] as Currency[]).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Opening balance"><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} /></Row>
            <Row label="Current balance"><Input type="number" value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: e.target.value })} /></Row>
          </div>
          <Row label="Status">
            <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm">
              <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
              <span>{form.status === "active" ? "Active" : "Inactive"}</span>
            </div>
          </Row>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" /> Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                accountName: form.accountName.trim(),
                accountNumber: form.accountNumber.trim(),
                bankName: form.bankName.trim(),
                branch: form.branch.trim(),
                swiftCode: form.swiftCode.trim().toUpperCase(),
                currency: form.currency,
                openingBalance: parseFloat(form.openingBalance) || 0,
                currentBalance: parseFloat(form.currentBalance) || 0,
                status: form.status,
              })
            }
          >
            <Check className="mr-1.5 h-4 w-4" /> Save account
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  ShoppingBag,
  Search,
  Calendar,
  User,
  FileText,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Paperclip,
  Upload,
  Eye,
  X,
  ShoppingCart,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { createOrder, deleteOrder, getCustomers, getEmployees, getItems, getOrders, updateOrder } from "@/services/api";
import type { Customer } from "@/services/api";
import type { Item } from "@/types/inventory";
import type { OrderItem, OrderStatus, QuotationAttachment, SalesOrder } from "@/types/sales-order";
import type { Employee } from "@/components/employees/employees-store";

export const Route = createFileRoute("/app/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Orders · Queenstech ERP" }] }),
});

const STATUS_META: Record<OrderStatus, { label: string; cls: string; icon: typeof Clock }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground", icon: FileText },
  confirmed: { label: "Confirmed", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: CheckCircle2 },
  in_progress: { label: "In progress", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Truck },
  delivered: { label: "Delivered", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

function nextLpo(orders: SalesOrder[]): string {
  const nums = orders
    .map((o) => parseInt(o.lpoNumber.split("-").pop() || "0", 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `LPO-${new Date().getFullYear()}-${String(next).padStart(4, "0")}`;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

function OrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDatabaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedEmployees, fetchedCustomers, fetchedItems] = await Promise.all([
        getOrders(),
        getEmployees().catch(() => []),
        getCustomers().catch(() => []),
        getItems().catch(() => []),
      ]);
      setOrders(fetchedOrders);
      setEmployees(fetchedEmployees);
      setCustomers(fetchedCustomers);
      setInventoryItems(fetchedItems);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load orders";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseOrders();
    const handleBranchChange = () => {
      loadDatabaseOrders();
    };
    window.addEventListener("qterp:branch-changed", handleBranchChange);

    return () => {
      window.removeEventListener("qterp:branch-changed", handleBranchChange);
    };
  }, [loadDatabaseOrders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        o.lpoNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerQuotation.toLowerCase().includes(q) ||
        o.handledBy.toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "confirmed" || o.status === "in_progress").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const value = orders.reduce((s, o) => s + (o.amount || 0), 0);
    return { total, pending, delivered, value };
  }, [orders]);

  async function handleCreate(order: SalesOrder) {
    setSaving(true);
    try {
      const created = await createOrder(order);
      setOrders((current) => [created, ...current]);
      toast.success(`${created.lpoNumber} created`);
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create order";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: OrderStatus) {
    try {
      const updated = await updateOrder(id, { status });
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      toast.success("Status updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status";
      toast.error(message);
    }
  }

  async function handleHandledByChange(id: string, handledBy: string) {
    try {
      const updated = await updateOrder(id, { handledBy });
      setOrders((current) => current.map((o) => (o.id === id ? updated : o)));
      toast.success(`Handled by updated to ${handledBy}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update handler";
      toast.error(message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOrder(id);
      setOrders((current) => current.filter((o) => o.id !== id));
      toast.success("Order removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove order";
      toast.error(message);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {orders.length} orders · LPOs from customers
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New order
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total orders" value={stats.total} icon={ShoppingBag} accent="bg-primary/10 text-primary" />
        <StatCard label="In pipeline" value={stats.pending} icon={Clock} accent="bg-amber-500/10 text-amber-600" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} accent="bg-emerald-500/10 text-emerald-600" />
        <StatCard
          label="Order value"
          value={`UGX ${stats.value.toLocaleString()}`}
          icon={FileText}
          accent="bg-blue-500/10 text-blue-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search LPO, customer, quotation, handler…"
            className="bg-white pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={loading ? "Loading orders" : orders.length === 0 ? "No orders yet" : "No matching orders"}
          description={
            loading
              ? "Fetching the latest sales orders from the database."
              : orders.length === 0
              ? "Create your first sales order from a customer LPO to get started."
              : "Try a different search or status filter."
          }
          actionLabel={!loading && orders.length === 0 ? "New order" : undefined}
          onAction={!loading && orders.length === 0 ? () => setFormOpen(true) : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead>LPO #</TableHead>
                <TableHead>Date received</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Quotation</TableHead>
                <TableHead>Delivery date</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const meta = STATUS_META[o.status];
                const StatusIcon = meta.icon;
                const overdue =
                  o.status !== "delivered" &&
                  o.status !== "cancelled" &&
                  new Date(o.dateToBeDelivered) < new Date(todayISO());
                return (
                  <TableRow key={o.id} className="group">
                    <TableCell className="font-mono text-sm font-medium">{o.lpoNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {o.dateReceived}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{o.customerName}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="space-y-1">
                        <p className="line-clamp-2 text-xs text-muted-foreground">{o.customerQuotation}</p>
                        {o.quotationAttachment && (
                          <a
                            href={o.quotationAttachment.dataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-muted"
                          >
                            <Paperclip className="h-3 w-3" />
                            {o.quotationAttachment.name}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm",
                          overdue ? "text-destructive font-medium" : "text-muted-foreground",
                        )}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {o.dateToBeDelivered}
                        {overdue && <span className="text-[10px] uppercase tracking-wider">overdue</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.handledBy}
                        onValueChange={(v) => handleHandledByChange(o.id, v)}
                      >
                        <SelectTrigger className="h-7 min-w-[150px] border-0 bg-transparent p-0 hover:bg-muted/40 font-normal shadow-none focus:ring-0">
                          <span className="inline-flex items-center gap-1.5 text-sm truncate">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                              {o.handledBy ? o.handledBy.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : "?"}
                            </span>
                            <span className="truncate">{o.handledBy || "Select employee"}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.name}>
                              <div className="flex items-center gap-2">
                                <span>{emp.name}</span>
                                <span className="text-xs text-muted-foreground">({emp.role || emp.department || "Staff"})</span>
                              </div>
                            </SelectItem>
                          ))}
                          {o.handledBy && !employees.some((e) => e.name === o.handledBy) && (
                            <SelectItem value={o.handledBy}>{o.handledBy}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      UGX {o.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) => handleStatusChange(o.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="h-7 w-[140px] border-0 bg-transparent p-0 hover:bg-muted/40 [&>svg]:opacity-0 group-hover:[&>svg]:opacity-100">
                          <Badge variant="outline" className={cn("gap-1 border-0", meta.cls)}>
                            <StatusIcon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_META[s].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => handleDelete(o.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <OrderFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        nextLpo={nextLpo(orders)}
        onCreate={handleCreate}
        submitting={saving}
        employees={employees}
        customers={customers}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof Clock;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function OrderFormSheet({
  open,
  onOpenChange,
  nextLpo,
  onCreate,
  submitting,
  employees,
  customers,
  inventoryItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nextLpo: string;
  onCreate: (o: SalesOrder) => void;
  submitting: boolean;
  employees: Employee[];
  customers: Customer[];
  inventoryItems: Item[];
}) {
  const [lpoNumber, setLpo] = useState(nextLpo);
  const [dateReceived, setDateReceived] = useState(todayISO());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerQuotation, setCustomerQuotation] = useState("");
  const [quotationAttachment, setQuotationAttachment] = useState<QuotationAttachment | null>(null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [dateToBeDelivered, setDelivery] = useState("");
  const [handledBy, setHandledBy] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setLpo(nextLpo);
      setDateReceived(todayISO());
      setSelectedCustomerId("");
      setCustomerName("");
      setCustomerQuotation("");
      setQuotationAttachment(null);
      setCartItems([{ id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }]);
      setDelivery("");
      setHandledBy(employees[0]?.name || "");
      setNotes("");
    }
  }, [open, nextLpo, employees]);

  const grandTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  }, [cartItems]);

  const valid =
    lpoNumber.trim() && dateReceived && customerName.trim() && dateToBeDelivered && handledBy.trim();

  function handleAttachment(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setQuotationAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result ?? ""),
      });
    };
    reader.readAsDataURL(file);
  }

  function handleAddItem() {
    setCartItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 },
    ]);
  }

  function handleRemoveItem(id: string) {
    setCartItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0
        ? next
        : [{ id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0, total: 0 }];
    });
  }

  function handleItemChange(id: string, field: keyof OrderItem, val: any) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        if (field === "quantity" || field === "unitPrice") {
          const q = field === "quantity" ? Number(val) || 0 : Number(item.quantity) || 0;
          const p = field === "unitPrice" ? Number(val) || 0 : Number(item.unitPrice) || 0;
          updated.total = q * p;
        }
        return updated;
      })
    );
  }

  function handleSelectInventoryItem(id: string, itemId: string) {
    const found = inventoryItems.find((i) => i.id === itemId);
    if (!found) return;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const qty = Number(item.quantity) || 1;
        const price = Number(found.sellingPrice) || 0;
        return {
          ...item,
          itemId: found.id,
          name: found.name,
          unitPrice: price,
          total: qty * price,
        };
      })
    );
  }

  function submit() {
    if (!valid) return;
    const cleanItems = cartItems
      .filter((i) => i.name.trim() !== "")
      .map((i) => ({
        ...i,
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        total: (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0),
      }));

    onCreate({
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived,
      customerName: customerName.trim(),
      customerId: selectedCustomerId || undefined,
      customerQuotation: customerQuotation.trim() || "—",
      quotationAttachment,
      dateToBeDelivered,
      handledBy: handledBy.trim(),
      status: "confirmed",
      amount: grandTotal,
      items: cleanItems.length > 0 ? cleanItems : undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[580px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New sales order</SheetTitle>
          <SheetDescription>Register a Local Purchase Order received from a customer.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="LPO number" icon={FileText}>
              <Input value={lpoNumber} onChange={(e) => setLpo(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Date received" icon={Calendar}>
              <Input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
            </Field>
          </div>

          <Field label="Customer name" icon={User}>
            <div className="space-y-2">
              <Select
                value={selectedCustomerId || "custom"}
                onValueChange={(val) => {
                  if (val === "custom") {
                    setSelectedCustomerId("");
                  } else {
                    const found = customers.find((c) => c.id === val);
                    if (found) {
                      setSelectedCustomerId(found.id);
                      setCustomerName(found.name);
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select from customers database..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom" className="font-medium text-muted-foreground">
                    Custom customer name
                  </SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.reference})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (selectedCustomerId) {
                    const matched = customers.find((c) => c.id === selectedCustomerId);
                    if (matched && matched.name !== e.target.value) {
                      setSelectedCustomerId("");
                    }
                  }
                }}
                placeholder="Customer name (or type custom name)..."
                className="bg-white"
              />
            </div>
          </Field>

          <Field label="Customer quotation details" icon={FileText}>
            <Textarea
              value={customerQuotation}
              onChange={(e) => setCustomerQuotation(e.target.value)}
              placeholder={"QT-0000 · Scope, line items, validity, payment terms…"}
              rows={3}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleAttachment(e.target.files?.[0])}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                {quotationAttachment ? "Replace file" : "Attach quotation (PDF or image)"}
              </Button>
              {quotationAttachment && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{quotationAttachment.name}</span>
                  <a href={quotationAttachment.dataUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    <Eye className="h-3 w-3" />
                  </a>
                  <button type="button" onClick={() => setQuotationAttachment(null)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </Field>

          {/* Cart Format - Multi Item List */}
          <div className="rounded-xl border border-border bg-slate-50/50 p-3 space-y-3 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                Order Line Items (Cart)
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddItem}
                className="h-7 px-2 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Add item
              </Button>
            </div>

            <div className="space-y-2.5">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-white p-2.5 space-y-2 shadow-sm dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Item #{index + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {inventoryItems.length > 0 && (
                    <Select
                      value={item.itemId || "custom"}
                      onValueChange={(v) => {
                        if (v === "custom") {
                          handleItemChange(item.id, "itemId", undefined);
                        } else {
                          handleSelectInventoryItem(item.id, v);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Select product from inventory..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom" className="font-medium text-muted-foreground">
                          Custom Item / Service
                        </SelectItem>
                        {inventoryItems.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{inv.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                (UGX {inv.sellingPrice.toLocaleString()})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Input
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                    placeholder="Item name or description"
                    className="h-8 text-xs"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Units (Qty)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Price (UGX)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground">Total (UGX)</Label>
                      <div className="h-8 flex items-center px-2.5 rounded-md border border-border bg-muted/40 font-mono text-xs font-medium text-foreground truncate">
                        {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total Footer */}
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              <span>Grand Amount</span>
              <span className="font-mono text-base font-bold">
                UGX {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery date" icon={Truck}>
              <Input type="date" value={dateToBeDelivered} onChange={(e) => setDelivery(e.target.value)} />
            </Field>
            <Field label="Handled by" icon={User}>
              <Select value={handledBy} onValueChange={setHandledBy}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{emp.name}</span>
                        <span className="text-xs text-muted-foreground">({emp.role || emp.department || "Staff"})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {handledBy && !employees.some((e) => e.name === handledBy) && (
                    <SelectItem value={handledBy}>{handledBy}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes, delivery instructions…"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting ? "Creating..." : "Create order"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

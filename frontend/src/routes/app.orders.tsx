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
  Minus,
  Download,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { createOrder, deleteOrder, getCustomers, getEmployees, getItems, getOrders, updateOrder } from "@/services/api";
import type { Customer } from "@/services/api";
import type { Item } from "@/types/inventory";
import type { OrderItem, OrderStatus, QuotationAttachment, SalesOrder } from "@/types/sales-order";
import type { Employee } from "@/components/employees/employees-store";
import { useRole } from "@/hooks/useRole";
import { useBranch } from "@/contexts/BranchContext";

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
  const { isAdmin } = useRole();
  const { currentBranchId } = useBranch();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

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
        (o.customerQuotation ? o.customerQuotation.toLowerCase().includes(q) : false) ||
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

  const branchScopedEmployees = useMemo(() => {
    return employees.filter((e) => {
      const statusOk = !e.status || e.status.toLowerCase() === "active" || e.status.toLowerCase() === "probation";
      if (!statusOk) return false;
      if (!currentBranchId) return true;
      return e.branchId === currentBranchId || !e.branchId;
    });
  }, [employees, currentBranchId]);

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
    if (!isAdmin) {
      toast.error("Admin access required to delete orders");
      return;
    }
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
                <TableHead>Items</TableHead>
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
                    <TableCell className="max-w-[260px]">
                      {o.items && o.items.length > 0 ? (
                        <div className="space-y-0.5">
                          <p className="line-clamp-2 text-xs font-medium text-foreground">
                            {o.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{o.items.length} line item{o.items.length > 1 ? "s" : ""}</p>
                        </div>
                      ) : o.customerQuotation ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{o.customerQuotation}</p>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
                          {branchScopedEmployees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.name}>
                              <div className="flex items-center gap-2">
                                <span>{emp.name}</span>
                                <span className="text-xs text-muted-foreground">({emp.role || emp.department || "Staff"})</span>
                              </div>
                            </SelectItem>
                          ))}
                          {o.handledBy && !branchScopedEmployees.some((e) => e.name === o.handledBy) && (
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
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-all hover:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                          onClick={() => setPreviewOrder(o)}
                          title="Preview order"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => handleDelete(o.id)}
                            title="Delete sales order"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                      </div>
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
        employees={branchScopedEmployees}
        customers={customers}
        inventoryItems={inventoryItems}
      />

      <OrderPreviewDialog
        order={previewOrder}
        onOpenChange={(open) => !open && setPreviewOrder(null)}
        onStatusChange={handleStatusChange}
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
  const [quotationAttachment, setQuotationAttachment] = useState<QuotationAttachment | null>(null);

  // Item Adder controls state
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [addItemName, setAddItemName] = useState<string>("");
  const [addItemPrice, setAddItemPrice] = useState<string>("");
  const [addItemQty, setAddItemQty] = useState<string>("1");

  // Static Cart items state
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
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
      setQuotationAttachment(null);
      setCartItems([]);
      setSelectedInventoryId("");
      setAddItemName("");
      setAddItemPrice("");
      setAddItemQty("1");
      setDelivery("");
      setHandledBy(employees[0]?.name || "");
      setNotes("");
    }
  }, [open, nextLpo, employees]);

  const grandTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  }, [cartItems]);

  const valid =
    lpoNumber.trim() &&
    dateReceived &&
    customerName.trim() &&
    dateToBeDelivered &&
    handledBy.trim() &&
    cartItems.length > 0;

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

  function handleSelectInventory(itemId: string) {
    if (itemId === "custom") {
      setSelectedInventoryId("");
      setAddItemName("");
      setAddItemPrice("0");
      return;
    }
    const found = inventoryItems.find((i) => i.id === itemId);
    if (found) {
      setSelectedInventoryId(found.id);
      setAddItemName(found.name);
      setAddItemPrice(String(found.sellingPrice || 0));
    }
  }

  function handleAddItemToCart() {
    const name = addItemName.trim();
    const price = parseFloat(addItemPrice) || 0;
    const qty = Math.max(1, parseInt(addItemQty, 10) || 1);
    if (!name) {
      toast.error("Please select or enter an item name");
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => (selectedInventoryId && i.itemId === selectedInventoryId) || i.name.toLowerCase() === name.toLowerCase()
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + qty;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          total: newQty * existing.unitPrice,
        };
        toast.success(`Updated ${name} quantity to ${newQty}`);
        return updated;
      }
      toast.success(`Added ${name} to cart`);
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          itemId: selectedInventoryId || undefined,
          name,
          quantity: qty,
          unitPrice: price,
          total: qty * price,
        },
      ];
    });

    // Reset adder form
    setSelectedInventoryId("");
    setAddItemName("");
    setAddItemPrice("");
    setAddItemQty("1");
  }

  function handleIncreaseQty(id: string) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const q = item.quantity + 1;
        return { ...item, quantity: q, total: q * item.unitPrice };
      })
    );
  }

  function handleDecreaseQty(id: string) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const q = Math.max(1, item.quantity - 1);
        return { ...item, quantity: q, total: q * item.unitPrice };
      })
    );
  }

  function handleRemoveItem(id: string) {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }

  function submit() {
    if (!valid) return;
    const cleanItems = cartItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      total: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
    }));

    onCreate({
      id: crypto.randomUUID(),
      lpoNumber: lpoNumber.trim(),
      dateReceived,
      customerName: customerName.trim(),
      customerId: selectedCustomerId || undefined,
      quotationAttachment,
      dateToBeDelivered,
      handledBy: handledBy.trim(),
      status: "confirmed",
      amount: grandTotal,
      items: cleanItems,
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

          {/* Cart Section - Interactive POS / E-Commerce Style */}
          <div className="rounded-xl border border-border bg-slate-50/50 p-3.5 space-y-3 dark:bg-slate-900/40">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Order Line Items (Cart)
              </Label>
              <Badge variant="outline" className="text-[11px] font-mono bg-white">
                {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
              </Badge>
            </div>

            {/* Item Adder Controls */}
            <div className="rounded-lg border border-border bg-white p-3 space-y-2.5 shadow-sm dark:bg-slate-950">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Add Product / Item to Order
              </span>

              {inventoryItems.length > 0 && (
                <Select value={selectedInventoryId || "custom"} onValueChange={handleSelectInventory}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Select product from inventory..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom" className="font-medium text-muted-foreground">
                      + Custom / Other Item
                    </SelectItem>
                    {inventoryItems.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{inv.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            (UGX {inv.sellingPrice.toLocaleString()})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    value={addItemName}
                    onChange={(e) => {
                      setAddItemName(e.target.value);
                      if (selectedInventoryId) {
                        const matched = inventoryItems.find((i) => i.id === selectedInventoryId);
                        if (matched && matched.name !== e.target.value) {
                          setSelectedInventoryId("");
                        }
                      }
                    }}
                    placeholder="Item name / description"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <Input
                    type="number"
                    min="0"
                    value={addItemPrice}
                    onChange={(e) => setAddItemPrice(e.target.value)}
                    placeholder="Price (UGX)"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Input
                    type="number"
                    min="1"
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                    placeholder="Qty"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddItemToCart}
                    className="h-8 w-full text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Cart Items Static List */}
            {cartItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-white/60 p-4 text-center dark:bg-slate-950/60">
                <ShoppingCart className="mx-auto h-6 w-6 text-muted-foreground/60" />
                <p className="mt-1 text-xs text-muted-foreground font-medium">Cart is empty</p>
                <p className="text-[11px] text-muted-foreground/80">Select a product or enter item details above to add items to your cart.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm dark:bg-slate-950"
                  >
                    {/* Static Item Info */}
                    <div className="min-w-[130px] flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground">#{index + 1}</span>
                        <h4 className="text-xs font-semibold text-foreground truncate">{item.name}</h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        UGX {item.unitPrice.toLocaleString()} / unit
                      </p>
                    </div>

                    {/* Quantity Stepper with Decrease (-) & Increase (+) buttons */}
                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1 border border-border">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDecreaseQty(item.id)}
                        disabled={item.quantity <= 1}
                        className="h-6 w-6 rounded-md text-foreground hover:bg-white hover:shadow-xs disabled:opacity-30"
                        title="Decrease units"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-mono text-xs font-bold text-foreground">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleIncreaseQty(item.id)}
                        className="h-6 w-6 rounded-md text-foreground hover:bg-white hover:shadow-xs"
                        title="Increase units"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Static Line Total */}
                    <div className="text-right min-w-[90px]">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        UGX {item.total.toLocaleString()}
                      </span>
                    </div>

                    {/* Delete Action Button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Remove item from cart"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Grand Total Footer */}
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary">
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

function OrderPreviewDialog({
  order,
  onOpenChange,
  onStatusChange,
  inventoryItems,
}: {
  order: SalesOrder | null;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  inventoryItems: Item[];
}) {
  const open = Boolean(order);
  if (!order) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }
  const statusMeta = STATUS_META[order.status];
  const StatusIcon = statusMeta.icon;
  const lineItems = order.items ?? [];
  const subtotal = lineItems.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const amount = Number(order.amount) || subtotal || 0;
  const attachment = order.quotationAttachment;
  const isImage = attachment?.type.startsWith("image/");
  const isPdf = attachment?.type === "application/pdf" || attachment?.name.toLowerCase().endsWith(".pdf");

  const invMap = useMemo(() => {
    const m = new Map<string, Item>();
    inventoryItems.forEach((it) => {
      if (it.id) m.set(it.id, it);
    });
    return m;
  }, [inventoryItems]);

  type TimelineEvent = {
    icon: typeof Clock;
    title: string;
    description?: string;
    date?: string;
    tone?: "default" | "primary" | "emerald" | "amber" | "rose" | "muted";
  };
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    const events: TimelineEvent[] = [];
    events.push({
      icon: FileText,
      title: "Order created",
      date: order.createdAt ? order.createdAt.slice(0, 10) : order.dateReceived,
      tone: "primary",
    });
    if (order.dateReceived) {
      events.push({
        icon: Calendar,
        title: "Order received / entered",
        date: order.dateReceived,
        tone: "muted",
      });
    }
    if (order.handledBy) {
      events.push({
        icon: User,
        title: "Assigned to " + order.handledBy,
        description: "Current ownership assignment",
        date: order.dateReceived,
        tone: "primary",
      });
    }
    events.push({
      icon: StatusIcon,
      title: "Status: " + statusMeta.label,
      description: "Current order state",
      date: order.updatedAt ? order.updatedAt.slice(0, 10) : undefined,
      tone:
        order.status === "delivered" ? "emerald" :
        order.status === "cancelled" ? "rose" :
        order.status === "in_progress" ? "amber" : "default",
    });
    if (order.dateToBeDelivered) {
      const isPast = new Date(order.dateToBeDelivered) < new Date(new Date().toISOString().slice(0, 10));
      const done = order.status === "delivered" || order.status === "cancelled";
      const delivered = order.status === "delivered";
      events.push({
        icon: Truck,
        title: delivered ? "Delivered on" : done ? "Delivery target was" : isPast ? "Overdue delivery (was due)" : "Scheduled delivery",
        date: order.dateToBeDelivered,
        tone: delivered ? "emerald" : done ? "muted" : isPast ? "rose" : "primary",
      });
    }
    if (order.updatedAt && order.createdAt && order.updatedAt.slice(0, 10) !== order.createdAt.slice(0, 10)) {
      events.push({
        icon: Clock,
        title: "Order details last updated",
        date: order.updatedAt.slice(0, 10),
        tone: "muted",
      });
    }
    return events;
  }, [order, StatusIcon, statusMeta.label]);

  const sections: string[] = [
    "meta",
    "particulars",
    ...(order.customerQuotation || order.notes ? ["notes" as const] : []),
    ...(attachment ? ["attachment" as const] : []),
    "totals",
    "timeline",
  ];
  const sectionIndex = (key: string) => Math.max(0, sections.indexOf(key));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,720px)] overflow-hidden p-0">
        {/* Header band */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white px-6 py-5 pr-14"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -left-14 -bottom-20 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                <ShoppingBag className="h-5.5 w-5.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-xl font-semibold tracking-wide">{order.lpoNumber}</h2>
                  <Badge variant="outline" className="border-0 bg-white/15 text-white ring-1 ring-white/25 backdrop-blur">
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusMeta.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-white/75">Queenstech ERP · Sales order preview</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scrollable content */}
        <div className="max-h-[calc(92vh-200px)] overflow-y-auto space-y-4 bg-muted/20 px-6 py-5">
          {/* Meta grid */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("meta"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3 w-3 text-[#003399]" />
                Date received
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">{order.dateReceived}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <User className="h-3 w-3 text-[#003399]" />
                Customer
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground truncate" title={order.customerName}>
                {order.customerName}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3.5 shadow-sm hover:shadow-[0_0_0_1px_rgba(0,51,153,0.08)] transition-shadow">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Truck className="h-3 w-3 text-[#003399]" />
                Delivery date
              </div>
              <div className="mt-1.5 text-sm font-medium text-foreground">{order.dateToBeDelivered}</div>
            </div>
          </motion.div>

          {/* Particulars table (enriched with SKU + description from inventory) */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("particulars"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-white overflow-hidden shadow-sm"
          >
            <div className="border-b border-[#003399]/15 bg-gradient-to-r from-[#003399]/8 via-[#003399]/5 to-transparent px-4 py-2.5 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Particulars
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {lineItems.length} line{lineItems.length === 1 ? "" : "s"}
              </div>
            </div>
            {lineItems.length > 0 ? (
              <>
                <div className="border-b border-border/80 bg-[#003399]/[0.03] px-4 py-2 grid grid-cols-[1fr_70px_120px_120px] gap-3 items-center text-[10px] font-semibold uppercase tracking-wider text-[#003399]/70">
                  <span>Item / SKU / Description</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Amount</span>
                </div>
                <div className="divide-y divide-border/70">
                  {lineItems.map((it, idx) => {
                    const match = it.itemId ? invMap.get(it.itemId) : undefined;
                    return (
                      <motion.div
                        key={it.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 + idx * 0.03, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="grid grid-cols-[1fr_70px_120px_120px] gap-3 items-start px-4 py-3 text-sm hover:bg-[#003399]/[0.025] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-medium text-foreground truncate">{it.name}</div>
                            {match ? (
                              <span className="inline-flex items-center rounded border border-[#003399]/25 bg-[#003399]/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#003399] shadow-[0_0_0_1px_rgba(0,51,153,0.04)]">
                                SKU {match.sku}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/5 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                Free-text line
                              </span>
                            )}
                          </div>
                          <div
                            className="mt-1 text-[11px] text-muted-foreground leading-snug line-clamp-2"
                            title={match?.description || it.name}
                          >
                            {match?.description || it.name}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs mt-1 text-muted-foreground">× {it.quantity}</div>
                        <div className="text-right font-mono text-xs mt-1 text-foreground">UGX {(Number(it.unitPrice) || 0).toLocaleString()}</div>
                        <div className="text-right font-mono text-sm font-semibold text-[#003399]">
                          UGX {(Number(it.total) || 0).toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#003399]/8 ring-1 ring-[#003399]/15">
                  <FileText className="h-5 w-5 text-[#003399]/70" />
                </div>
                <div className="text-sm font-semibold text-foreground">No line items added yet</div>
                {order.customerQuotation ? (
                  <div className="mt-2 rounded-lg border border-dashed border-[#003399]/20 bg-[#003399]/[0.025] px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed text-left">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#003399]">
                      <FileText className="h-3 w-3" />
                      From customer quotation
                    </div>
                    {order.customerQuotation}
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Particulars will appear here when line items are added to this order.
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Quotation / Notes */}
          {sections.includes("notes") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sectionIndex("notes"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-border bg-white p-4 space-y-3 shadow-sm"
            >
              {order.customerQuotation && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    <FileText className="h-3 w-3 text-[#003399]" />
                    Customer quotation
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-[#003399]/[0.03] rounded-lg px-3 py-2 border border-[#003399]/15">
                    {order.customerQuotation}
                  </p>
                </div>
              )}
              {order.notes && (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    <FileText className="h-3 w-3 text-[#003399]" />
                    Internal notes
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {order.notes}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Attachment preview */}
          {sections.includes("attachment") && attachment && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * sectionIndex("attachment"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Paperclip className="h-3 w-3 text-[#003399]" />
                  Quotation attachment
                </div>
                <div className="text-[11px] text-muted-foreground font-mono truncate max-w-[260px]">
                  {attachment.name}
                </div>
              </div>
              <div className="rounded-lg border border-[#003399]/15 bg-[#003399]/[0.02] flex items-center justify-center min-h-[160px] max-h-[300px] overflow-hidden">
                {isImage && (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="max-h-[290px] max-w-full object-contain p-2 rounded-md transition-transform hover:scale-[1.01] duration-300"
                  />
                )}
                {isPdf && (
                  <iframe
                    title={attachment.name}
                    src={attachment.dataUrl}
                    className="h-[280px] w-full rounded-md border border-border/60 bg-white"
                  />
                )}
                {!isImage && !isPdf && (
                  <div className="py-8 px-6 text-center">
                    <Paperclip className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">{attachment.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">This file type can only be downloaded.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" asChild>
                  <a href={attachment.dataUrl} target="_blank" rel="noreferrer">
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="bg-[#003399] hover:bg-[#00297a] text-white shadow-[0_0_0_1px_rgba(0,51,153,0.08),0_4px_14px_-4px_rgba(0,51,153,0.4)] hover:shadow-[0_0_0_1px_rgba(0,51,153,0.12),0_6px_20px_-4px_rgba(0,51,153,0.5)] transition-shadow"
                  asChild
                >
                  <a href={attachment.dataUrl} download={attachment.name}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Download
                  </a>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Totals */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("totals"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-[#003399]/25 bg-gradient-to-br from-[#003399]/10 via-[#003399]/6 to-transparent p-4 space-y-2 shadow-[0_0_0_1px_rgba(0,51,153,0.04)]"
          >
            {lineItems.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({lineItems.length} item{lineItems.length === 1 ? "" : "s"})</span>
                <span className="font-mono text-foreground">UGX {subtotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[#003399]/20">
              <span className="text-sm font-semibold text-[#003399]">Order total</span>
              <span className="font-mono text-lg font-bold text-[#003399] drop-shadow-[0_0_1px_rgba(0,51,153,0.15)]">UGX {amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 mt-1 border-t border-[#003399]/15">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3 w-3" />
                Handled by
              </span>
              <span className="font-medium text-foreground">
                {order.handledBy || "—"}
              </span>
            </div>
          </motion.div>

          {/* Timeline / Transaction history */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * sectionIndex("timeline"), duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#003399] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Timeline &amp; activity
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{timelineEvents.length} events</div>
            </div>
            <ol className="relative border-l border-[#003399]/20 pl-5 space-y-3.5 ml-1">
              {timelineEvents.map((ev, idx) => {
                const tone =
                  ev.tone === "emerald" ? "bg-emerald-500 text-white ring-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
                  ev.tone === "rose" ? "bg-rose-500 text-white ring-rose-500/20 shadow-[0_0_0_1px_rgba(244,63,94,0.08)]" :
                  ev.tone === "amber" ? "bg-amber-500 text-white ring-amber-500/20 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]" :
                  ev.tone === "muted" ? "bg-muted text-muted-foreground ring-muted-foreground/10" :
                  "bg-[#003399] text-white ring-[#003399]/20 shadow-[0_0_0_1px_rgba(0,51,153,0.08)]";
                const EventIcon = ev.icon;
                return (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, x: -3 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + idx * 0.04, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    <span
                      className={`absolute -left-[29px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-4 ${tone}`}
                    >
                      <EventIcon className="h-3 w-3" />
                    </span>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{ev.title}</div>
                        {ev.description && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">{ev.description}</div>
                        )}
                      </div>
                      {ev.date && (
                        <div className="text-[11px] font-mono text-muted-foreground shrink-0">{ev.date}</div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <Select
              value={order.status}
              onValueChange={(v) => {
                onStatusChange(order.id, v as OrderStatus);
              }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <Badge variant="outline" className={cn("gap-1 border-0", statusMeta.cls)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusMeta.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => {
                  const m = STATUS_META[s];
                  const I = m.icon;
                  return (
                    <SelectItem key={s} value={s}>
                      <div className="flex items-center gap-2">
                        <I className="h-3.5 w-3.5" />
                        <span>{m.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              size="sm"
              className="bg-[#003399] hover:bg-[#00297a] text-white"
              onClick={() => onOpenChange(false)}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
